import {DASHBOARD_MARKUP} from './reference-dashboard-markup.js';
import {mountReferenceDashboard} from './reference-dashboard.js';
import {mountJobRecords} from './job-records-view.js';
import {mountApplyDock} from './apply-dock-view.js';
import {studioStorage} from './storage.js';

export function mountDockDashboard(host,{browser=globalThis.chrome,privateStorage=studioStorage}={}) {
  host.innerHTML=DASHBOARD_MARKUP;
  const doc=host.ownerDocument,root=host.querySelector('#at-reference-dock'),main=root.querySelector('.rd-main');
  const recordsHost=doc.createElement('div'),applyHost=doc.createElement('div');recordsHost.hidden=applyHost.hidden=true;
  main.before(recordsHost,applyHost);let records,apply;
  async function ensureSamples(){const reply=await browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_SEED_SAMPLES',payload:{}});if(!reply?.ok)throw Error(reply?.error?.message||'The sample queue could not load.');}
  function showView(name){main.hidden=name!=='dashboard';recordsHost.hidden=name!=='records';applyHost.hidden=name!=='apply';if(records)records.root.hidden=recordsHost.hidden;if(apply)apply.root.hidden=applyHost.hidden;root.querySelector('#rd-feedback').hidden=true;}
  async function showApplications(tab='applications',url){
    await ensureSamples();
    records ||= mountJobRecords(recordsHost,{browser,privateStorage,onDashboard(){showView('dashboard');},onApply:showApply});
    showView('records');await records.show(tab,url);
  }
  async function showApply(jobId){
    await ensureSamples();
    apply ||= mountApplyDock(applyHost,{browser,privateStorage,onDashboard(){showView('dashboard');},onQueue:async id=>{await showApplications('queue');if(id)await records.select(id);},onApplication:async id=>{await showApplications('applications');await records.select(id);}});
    showView('apply');await apply.show(jobId);
  }
  const unmount=mountReferenceDashboard(root,browser,{onApplications:showApplications,onApply:()=>showApply()});
  return {root,showApply,showApplications,close(){records?.close();apply?.close();unmount();}};
}
