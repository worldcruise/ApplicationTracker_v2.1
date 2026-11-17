import {getDockMeetings,DOCK_MEETING_KEYS} from './dock-meetings-data.js';
import {withRequestDeadline} from './request-deadline.js';
import {studioStorage} from './storage.js';
import {meetingAlerts} from './meeting-alerts.js';

const pending=new WeakMap();
export const WORKSPACE_KEYS=[...DOCK_MEETING_KEYS,'profile','dailyGoal'];
export function summarizeQueue(jobs=[]){
  return {total:jobs.length,ready:jobs.filter(row=>row.status==='Ready').length,generating:jobs.filter(row=>row.status==='Generating').length,failed:jobs.filter(row=>row.status==='Failed').length,jobs};
}
export function readWorkspaceSummary(browser=globalThis.chrome){
  if(pending.has(browser))return pending.get(browser);
  const run=(async()=>{
    const [reply,meetings]=await Promise.all([withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_STATE',payload:{}})),getDockMeetings(browser)]);
    if(!reply?.ok||!reply.result)throw Error(reply?.error?.message||'Workspace totals could not load.');
    return {candidate:reply.result.candidate,applications:reply.result.applications||[],queue:summarizeQueue(reply.result.jobs),meetings,alerts:meetingAlerts(meetings.records,meetings.timeZone)};
  })().finally(()=>pending.delete(browser));pending.set(browser,run);return run;
}
export function watchWorkspace(refresh,browser=globalThis.chrome,privateStorage=studioStorage){
  const changed=(changes,area)=>{if(area==='local'&&WORKSPACE_KEYS.some(key=>changes[key]))refresh();};
  const privateChanged=changes=>{if(changes['dock-job-records:v1'])refresh();};
  browser.storage.onChanged.addListener(changed);privateStorage.onChanged.addListener(privateChanged);
  const timer=setInterval(refresh,30000);
  return()=>{clearInterval(timer);browser.storage.onChanged.removeListener(changed);privateStorage.onChanged.removeListener(privateChanged);};
}
export function createUseWorkspaceSummary(React){
  return function useWorkspaceSummary(){
    const [state,setState]=React.useState(null),[error,setError]=React.useState('');
    React.useEffect(()=>{let alive=true,revision=0;const refresh=async()=>{const current=++revision;try{const next=await readWorkspaceSummary();if(alive&&current===revision){setState(next);setError('');}}catch(reason){if(alive&&current===revision)setError(reason.message);}};const stop=watchWorkspace(refresh);void refresh();return()=>{alive=false;revision++;stop();};},[]);
    return {state,error};
  };
}
export function navigateWorkspace(path){
  location.hash=`#${path}`;
  // The existing hash router also listens to popstate for imperative navigation.
  window.dispatchEvent(new Event('popstate'));
}
