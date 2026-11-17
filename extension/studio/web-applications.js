import {mountJobRecords} from './job-records-view.js';
import {createUseWorkspaceSummary,navigateWorkspace} from './workspace-summary.js';
import {withRequestDeadline} from './request-deadline.js';

export function createWebApplications(React,{Applications,Board}){
  const h=React.createElement,useSummary=createUseWorkspaceSummary(React);
  function Queue({add=false,layout='cards'}){
    const ref=React.useRef(null),controller=React.useRef(null),latestLayout=React.useRef(layout),[error,setError]=React.useState('');latestLayout.current=layout;
    React.useEffect(()=>{controller.current?.setLayout(layout);},[layout]);
    React.useEffect(()=>{let alive=true,view;const mount=async()=>{try{
      const reply=await withRequestDeadline(chrome.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_STATE',payload:{}}));
      if(!reply?.ok)throw Error(reply?.error?.message||'The queue could not load.');if(!alive)return;
      view=mountJobRecords(ref.current,{stateKeyPrefix:'web-records-ui:v1',searchQueue:true,onDashboard:()=>navigateWorkspace('/dashboard')});controller.current=view;await view.show(add?'applications':'queue');if(!alive)return;view.setLayout(latestLayout.current);if(add)view.root.querySelector('[data-command=add]').click();
    }catch(reason){if(alive)setError(reason.message);}};void mount();return()=>{alive=false;view?.close();};},[add]);
    return h('div',{className:'web-queue'},error&&h('p',{className:'web-message web-error',role:'alert'},error),h('div',{ref}));
  }
  return function WebApplications(){
    const {state}=useSummary(),readTab=()=>new URLSearchParams(location.hash.split('?')[1]||'').get('tab')==='queue'?'queue':'applications';
    const [tab,setTab]=React.useState(readTab),[add,setAdd]=React.useState(()=>location.hash.includes('add=1'));
    const [views,setViews]=React.useState({applications:'list',queue:'cards'}),interacted=React.useRef(false);
    React.useEffect(()=>{let alive=true;chrome.storage.local.get('application-views:v1').then(saved=>{const next=saved['application-views:v1'];if(alive&&!interacted.current&&next)setViews({applications:['list','cards','board'].includes(next.applications)?next.applications:'list',queue:next.queue==='list'?'list':'cards'});});return()=>{alive=false;};},[]);
    const [viewError,setViewError]=React.useState('');
    function changeView(value){interacted.current=true;const next={...views,[tab]:value};setViews(next);chrome.storage.local.set({'application-views:v1':next}).catch(reason=>setViewError(reason.message));}
    React.useEffect(()=>{const change=()=>{setTab(readTab());setAdd(location.hash.includes('add=1'));};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
    return h('section',{className:'web-applications-workspace'},h('header',{className:'applications-page-heading'},h('span',{className:'web-eyebrow'},'Your search, in motion'),h('h1',null,'Applications')),
      h('nav',{className:'workspace-tabs','aria-label':'Application workspace'},...['applications','queue'].map(key=>h('button',{key,type:'button','aria-pressed':tab===key,onClick:()=>{setTab(key);setAdd(false);navigateWorkspace(key==='queue'?'/?tab=queue':'/');}},key==='queue'?'Job Queues':'Applications',h('span',{className:'workspace-count'},state?(key==='queue'?state.queue.total:state.applications.length):'…')))),
      h('nav',{className:'record-view-switcher','aria-label':`${tab==='queue'?'Job queue':'Application'} views`},...['list','cards',...tab==='applications'?['board']:[]].map(view=>h('button',{key:view,type:'button','data-record-view':view,'aria-pressed':views[tab]===view,onClick:()=>changeView(view)},view==='cards'?'Cards':view==='board'?'Board':'List'))),
      viewError&&h('p',{role:'alert'},viewError),tab==='queue'?h(Queue,{layout:views.queue}):add?h(Queue,{add:true,layout:views.applications}):views.applications==='board'?h(Board):h(Applications,{view:views.applications}));
  };
}
