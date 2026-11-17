import {createApplicationDocuments} from './application-documents.js';
import {readWorkspaceSummary} from './workspace-summary.js';
import {applicationDocumentRecord} from './record-presentation.js';
import {createMeetingComponents} from './meeting-card.js';
import {getDockMeetings,DOCK_MEETING_KEYS} from './dock-meetings-data.js';
import {previousMeetingHistory,hasPreviousMeetings,previousMeetingLabel,applicationConversation,meetingIsPast,meetingRange,meetingLink} from './meeting-model.js';
import {watchMeetingClock,meetingTimezoneLabel} from './meeting-timezone.js';
import {observeMeetingInitialScroll} from './meeting-scroll.js';
import {openDashboard} from './dock.js';
import {meetingAlerts} from './meeting-alerts.js';
import {openMeetingWorkflow,updateWorkflowAttention} from './meeting-workflow-view.js';
import {focusNextAttention,restoreAttentionHighlight} from './meeting-attention.js';
import {createDockState} from './dock-state.js';

export function mountDockMeetings(host,{browser=globalThis.chrome,onDashboard,requestTimeoutMs=10000}={}){
  const doc=host.ownerDocument,win=doc.defaultView;let documentRecords=[];
  // These shared cards, tags and conversation bodies are stateless element trees.
  // Render them directly in the dock's DOM without loading the web page's React app.
  function h(type,props,...children){
    if(typeof type==='function')return type({...props,children});
    const node=type==='fragment'?doc.createDocumentFragment():['svg','path','circle','rect'].includes(type)?doc.createElementNS('http://www.w3.org/2000/svg',type):doc.createElement(type);
    for(const [key,value]of Object.entries(props||{})){
      if(value===undefined||value===null||key==='key')continue;
      if(key==='style'){for(const [name,content]of Object.entries(value))node.style.setProperty(name,content);}
      else if(key==='value')node.value=value;
      else if(key.startsWith('on'))node.addEventListener(key.slice(2).toLowerCase(),value);
      else node.setAttribute(key==='className'?'class':key==='dateTime'?'datetime':key==='strokeWidth'?'stroke-width':key==='strokeLinecap'?'stroke-linecap':key==='strokeLinejoin'?'stroke-linejoin':key,String(value));
    }
    for(const child of children.flat(Infinity))if(child!==false&&child!==true&&child!==null&&child!==undefined)node.append(child.nodeType?child:doc.createTextNode(String(child)));
    return node;
  }
  const ApplicationDocuments=createApplicationDocuments({createElement:h});
  const {MeetingCard,MeetingTags,MeetingConversation}=createMeetingComponents({createElement:h,Fragment:'fragment'});
  const icon=name=>h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round',strokeLinejoin:'round','aria-hidden':true},h('path',{d:{dashboard:'M3 10 12 3l9 7v11h-6v-7H9v7H3Z',calendar:'M14 3h7v7M21 3l-9 9M10 3H3v18h18v-7',refresh:'M20 7a9 9 0 1 0 1 8M20 3v5h-5',now:'M12 8v4l3 2M21 12a9 9 0 1 1-9-9M16 3h5v5M21 3l-5 5',back:'m15 18-6-6 6-6'}[name]}));
  const actionButton=(action,label,symbol)=>h('button',{type:'button',className:'dock-meetings-icon','data-meeting-action':action,'aria-label':label,title:label},icon(symbol));
  let alive=true,visible=false,revision=0,state={records:[],sourceRecords:[],timeZone:'UTC'},selectedId=null,tab='details',previousId=null,stopClock,stopScroll,now=Date.now(),scrollTop=0,loaded=false;
  const savedView=createDockState({browser,scope:'meetings'});
  const back=actionButton('dashboard','Back to Dashboard','back'),currentButton=actionButton('now','Jump to now','now'),full=actionButton('calendar','Open full calendar','calendar'),refreshButton=actionButton('refresh','Refresh meetings','refresh');
  back.className='dock-meetings-back';back.append(h('span',null,'Dashboard'));
  const count=h('span',{className:'dock-meetings-count'}),zone=h('p',{className:'dock-meetings-zone'}),feedback=h('p',{className:'meeting-error',role:'status',hidden:true});
  const content=h('div',{className:'dock-meetings-content'});
  const root=h('section',{id:'dock-meetings',className:'dock-meetings','aria-label':'Meetings'},h('header',{className:'dock-meetings-navigation'},h('div',{className:'dock-meetings-back-row'},back),h('div',{className:'dock-meetings-heading'},h('div',{className:'dock-meetings-title'},h('h2',null,'Meetings'),count),zone),currentButton,full,refreshButton),feedback,content);
  host.replaceChildren(root);
  function remember(){const list=content.querySelector('.meeting-extension-list');if(list)scrollTop=list.scrollTop;void savedView.patch({selectedId,tab,previousId,scrollTop}).catch(()=>{});}
  let scrollSave;
  function rememberScroll(){clearTimeout(scrollSave);scrollSave=setTimeout(remember,150);}
  content.addEventListener('scroll',rememberScroll,true);
  const attention=h('button',{type:'button',className:'workflow-attention',onClick:focusNextAction});root.querySelector('.dock-meetings-back-row').append(h('span',{className:'workflow-attention-slot'},attention));
  function focusNextAction(){selectedId=null;render();stopScroll?.();stopScroll=null;const id=focusNextAttention(content);if(id)root.dataset.initialFocus=id;remember();}
  function jumpToNow(){selectedId=null;now=Date.now();delete root.dataset.initialFocus;render();remember();}
  function showError(error){feedback.textContent=error?.message||String(error);feedback.hidden=false;}
  function render(){
    if(!alive)return;
    const alerts=meetingAlerts(state.records,state.timeZone,now);updateWorkflowAttention(attention,alerts);attention.title='Highlight today’s meetings and meetings needing action';
    zone.textContent=meetingTimezoneLabel(state.timeZone,now);zone.title=zone.textContent;count.textContent=loaded?state.records.length:'…';count.setAttribute('aria-label',`${state.records.length} screening and interview meetings`);stopScroll?.();stopScroll=null;
    const record=state.records.find(row=>row.id===selectedId);
    if(selectedId&&!record){selectedId=null;scrollTop=0;}
    if(record){renderDetails(record);return;}
    const old=content.querySelector('.meeting-extension-list');if(old)scrollTop=old.scrollTop;
    const list=h('div',{className:'meeting-extension-list',tabindex:0,'aria-label':'Screening and interview meetings'},
      ...state.records.map(record=>h(MeetingCard,{record,now,timeZone:state.timeZone,onUpdate:(record,initialAction)=>openMeetingWorkflow(root,{browser,recordId:record.id,initialAction,onSaved:()=>refresh()}),onOpen:openMeeting})));
    if(!state.records.length)list.append(h('p',{className:'meeting-empty'},loaded?'No screening or interview meetings yet.':'Loading meetings…'));
    content.replaceChildren(h('div',{className:'meeting-extension-view'},h('div',{className:'meeting-extension-column','data-test':'applications-board-column-combined'},list)));
    list.scrollTop=scrollTop;
    restoreAttentionHighlight(content);
    if(visible&&loaded&&!root.dataset.initialFocus){
      stopScroll=observeMeetingInitialScroll(content,['combined'],{onFocus:id=>{root.dataset.initialFocus=id;}});
    }
  }
  function openMeeting(record){void readWorkspaceSummary(browser).then(summary=>{documentRecords=summary.applications;if(alive&&selectedId===record.id)render();}).catch(showError);scrollTop=content.querySelector('.meeting-extension-list')?.scrollTop||scrollTop;selectedId=record.id;tab=meetingIsPast(record.meeting,now)?'transcript':'details';previousId=null;render();remember();content.querySelector('[data-meeting-action="list"]').focus();}
  function summary(record){const range=meetingRange(record.meeting,state.timeZone);return h('div',{className:'meeting-summary'},h('time',{dateTime:record.meeting?.startsAt},record.eventType==='rescheduled'&&!record.meeting?.startsAt?'Original time not recorded':`${range.date}${range.time?' · '+range.time:''}`),h(MeetingTags,{record,now}),h('p',null,'Interviewer: ',record.meeting?.interviewer||'Not specified'));}
  function renderDetails(record){
    const meeting=record.meeting||{},past=meetingIsPast(meeting,now),tabs=[['details','Details'],...past?[['transcript','Transcript']]:[],...hasPreviousMeetings(record)?[['previous','Previous meetings']]:[],['chat','Chat history'],['application','Application']];
    if(!tabs.some(([key])=>key===tab))tab='details';
    const body=h('div',{className:'dock-meeting-details','data-meeting-id':record.id},
      h('header',{className:'dock-meeting-details-heading'},actionButton('list','Back to meetings','back'),h('div',null,h('h3',null,record.companyName),h('p',{className:'dock-meeting-role'},record.jobTitle))),
      h('nav',{className:'meeting-history-tabs','aria-label':'Meeting details'},...tabs.map(([key,label])=>h('button',{type:'button','aria-pressed':key===tab,onClick:()=>{tab=key;render();remember();}},label))));
    body.querySelector('.dock-meeting-details-heading').append(h('button',{type:'button',className:'workflow-button primary',onClick:()=>openMeetingWorkflow(root,{browser,recordId:record.id,onSaved:()=>refresh()})},'Update'));
    if(tab==='application')body.append(h(ApplicationDocuments,{record:applicationDocumentRecord(record,documentRecords),browser}));
    else if(tab==='chat')body.append(h(MeetingConversation,{conversation:applicationConversation(record,state.sourceRecords),timeZone:state.timeZone}));
    else if(tab==='previous'){
      const history=previousMeetingHistory(record,state.sourceRecords,now),active=history.find(row=>row.id===previousId)||history.at(-1);
      if(!active)body.append(h('p',{className:'meeting-empty'},'No previous meetings yet.'));
      else body.append(h('nav',{className:'meeting-history-tabs meeting-previous-tabs','aria-label':'Previous meetings'},...history.map(entry=>h('button',{type:'button','aria-pressed':entry.id===active.id,onClick:()=>{previousId=entry.id;render();remember();}},previousMeetingLabel(entry)))),summary(active),h('div',{className:'meeting-history'},active.eventType==='rescheduled'?h('label',{className:'meeting-field'},h('span',null,'Transcript'),h('textarea',{rows:5,readOnly:true,value:active.meeting.transcript,'aria-label':'Transcript'})):h('p',null,active.meeting.transcript||'No transcript saved yet.')));
    }else{
      body.append(summary(record));
      if(tab==='transcript')body.append(h('div',{className:'meeting-history'},h('p',null,meeting.transcript||'No transcript saved yet.')));
      else if(!past&&meeting.mode==='phone')body.append(h('div',{className:'meeting-phone'},h('h4',null,'Phone number'),h('p',{className:'meeting-phone-number'},meeting.phone||'No phone number saved.')));
      else if(!past){const link=meetingLink(meeting.joinUrl);body.append(h('div',{className:'meeting-video'},h('h4',null,'Meeting link'),link?h('a',{href:link,target:'_blank',rel:'noopener noreferrer',className:'meeting-url'},'Join video meeting'):h('p',null,'Not scheduled. Open the full calendar to add meeting details.')));}
    }
    content.replaceChildren(body);
  }
  async function refresh(){
    const current=++revision;feedback.hidden=true;refreshButton.disabled=true;root.setAttribute('aria-busy','true');
    try{const next=await getDockMeetings(browser,requestTimeoutMs);if(!alive||current!==revision)return;state=next;loaded=true;render();}
    catch(error){if(alive&&current===revision){showError(error);if(!loaded)content.replaceChildren(h('p',{className:'meeting-empty'},'Meetings could not load. Use Refresh to retry.'));}}
    finally{if(alive&&current===revision){refreshButton.disabled=false;root.removeAttribute('aria-busy');}}
  }
  function click(event){const action=event.target.closest('[data-meeting-action]')?.dataset.meetingAction;
    if(action==='dashboard'){setVisible(false);onDashboard?.();}
    else if(action==='list'){selectedId=null;render();remember();content.querySelector(`[data-meeting-id] .meeting-card-main`)?.focus({preventScroll:true});}
    else if(action==='refresh')void refresh();
    else if(action==='now')jumpToNow();
    else if(action==='calendar')void openDashboard('/meetings',browser).catch(showError);
  }
  function setVisible(next){visible=next;stopClock?.();stopClock=null;stopScroll?.();stopScroll=null;if(next){stopClock=watchMeetingClock(value=>{now=value;if(loaded)render();},{window:win,cadence:30000});}else{revision++;root.removeAttribute('aria-busy');refreshButton.disabled=false;}}
  const changed=(changes,area)=>{if(visible&&area==='local'&&DOCK_MEETING_KEYS.some(key=>changes[key]))void refresh();};
  root.addEventListener('click',click);browser.storage.onChanged.addListener(changed);render();
  return {root,show({focusNeeded=false,restore=false}={}){selectedId=null;setVisible(true);return (restore?savedView.ready.then(saved=>{if(!alive||!visible)return;if(restore&&saved){selectedId=typeof saved.selectedId==='string'?saved.selectedId:null;tab=['details','transcript','previous','chat','application'].includes(saved.tab)?saved.tab:'details';previousId=typeof saved.previousId==='string'?saved.previousId:null;scrollTop=Number.isFinite(saved.scrollTop)?Math.max(0,saved.scrollTop):0;root.dataset.initialFocus='restored';}return refresh();}):refresh()).then(()=>{if(alive&&visible&&!restore){if(focusNeeded)focusNextAction();else jumpToNow();}});},setVisible,close(){clearTimeout(scrollSave);if(loaded)remember();alive=false;revision++;stopClock?.();stopScroll?.();content.removeEventListener('scroll',rememberScroll,true);root.removeEventListener('click',click);browser.storage.onChanged.removeListener(changed);root.remove();}};
}
