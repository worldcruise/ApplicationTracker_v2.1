import {DASHBOARD_MARKUP} from './reference-dashboard-markup.js';
import {mountReferenceDashboard} from './reference-dashboard.js';
import {mountJobRecords} from './job-records-view.js';
import {mountAIApply} from './ai-apply-view.js';
import {studioStorage} from './storage.js';
import {withRequestDeadline} from './request-deadline.js';
import {mountDockMeetings} from './dock-meetings-view.js';
import {createDockState} from './dock-state.js';

export function mountDockDashboard(host,{browser=globalThis.chrome,privateStorage=studioStorage,onResumeInput,showProfileSelector=false,applyAccess='',initialView}={}) {
  host.innerHTML=DASHBOARD_MARKUP;
  const doc=host.ownerDocument,root=host.querySelector('#at-reference-dock'),main=root.querySelector('.rd-main');
  const recordsHost=doc.createElement('div'),applyHost=doc.createElement('div'),meetingsHost=doc.createElement('div');recordsHost.hidden=applyHost.hidden=meetingsHost.hidden=true;
  for(const view of [recordsHost,applyHost,meetingsHost])view.className='dock-view-host';
  main.before(recordsHost,applyHost,meetingsHost);let records,apply,meetings,viewRequest=0,alive=true;
  const navigation=createDockState({browser,scope:'dock'});
  async function ensureRecords(){const reply=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_STATE',payload:{}}));if(!reply?.ok)throw Error(reply?.error?.message||'The queue could not load.');}
  function showView(name){
    void navigation.patch({view:name}).catch(()=>{});
    root.dataset.dockView=name;main.hidden=name!=='dashboard';recordsHost.hidden=!['applications','queue'].includes(name);applyHost.hidden=name!=='apply';meetingsHost.hidden=name!=='meetings';
    if(records){records.root.hidden=recordsHost.hidden;records.root.dataset.dockSection=name==='queue'?'apply':'applications';records.root.querySelector('.jr-header').hidden=name==='queue';records.root.querySelector('.jr-manage-menu').hidden=true;records.root.querySelector('[data-command=manage]').setAttribute('aria-expanded','false');}
    if(apply)apply.root.hidden=applyHost.hidden;
    if(meetings){meetings.root.hidden=meetingsHost.hidden;meetings.setVisible(!meetingsHost.hidden);}root.querySelector('#rd-feedback').hidden=true;
  }
  function dashboard(){viewRequest++;showView('dashboard');}
  function showMeetings(focusNeeded=false,{restore=false}={}){
    viewRequest++;meetings ||= mountDockMeetings(meetingsHost,{browser,onDashboard:dashboard});
    showView('meetings');return meetings.show({focusNeeded,restore});
  }
  async function showApplications(tab='applications',url,{restore=false}={}){
    if(tab==='queue')return showApply(undefined,{panel:'results'});
    const current=++viewRequest;await ensureRecords();if(!alive||current!==viewRequest)return;
    records ||= mountJobRecords(recordsHost,{browser,privateStorage,onResumeInput,cardsOnly:true,onDashboard:dashboard,onApply:showApply});
    records.root.querySelector('.jr-tabs').hidden=true;
    records.root.querySelector('.jr-header h2').textContent='Applications';
    records.root.querySelector('#jr-main-panel').setAttribute('aria-label',tab==='queue'?'Job Queues':'Applications');
    showView(tab==='queue'?'queue':'applications');await records.show(tab,url,{restore});
  }
  async function showApply(jobId,options={}){
    const current=++viewRequest;await ensureRecords();if(!alive||current!==viewRequest)return;
    apply ||= mountAIApply(applyHost,{browser,onDashboard:dashboard,access:applyAccess});
    showView('apply');await apply.show(jobId,options);
  }
  const unmount=mountReferenceDashboard(root,browser,{onApplications:showApplications,onApply:()=>showApply(),onMeetings:showMeetings,showProfileSelector,privateStorage});
  const ready=(async()=>{const request=viewRequest,saved=await navigation.ready;if(!alive||request!==viewRequest)return;const view=initialView||saved.view;if(view==='apply'||view==='queue')await showApply(undefined,{restore:true});else if(view==='applications')await showApplications('applications',undefined,{restore:true});else if(view==='meetings')await showMeetings(false,{restore:true});})();
  return {root,ready,showApply,showApplications,showMeetings,async editResume(id){await showApply(id,{panel:'results'});},close(){alive=false;viewRequest++;records?.close();apply?.close();meetings?.close();unmount();}};
}
