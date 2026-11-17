import {loadMeetingSamples,MEETING_SAMPLES_KEY} from './meeting-samples.mjs';
import {isApplicationRecord,projectMeetingRecords} from '../../extension/studio/meeting-model.js';
import {sampleSalary,sampleApplicationDocuments,sampleJobDescription} from './sample-documents.mjs';

export const APPLICATION_SAMPLES_KEY='meeting-application-overrides:v1';
export const APPLICATION_DOCUMENTS_KEY='meeting-application-documents:v1';
export const APPLICATION_SAMPLE_KEYS=[MEETING_SAMPLES_KEY,APPLICATION_SAMPLES_KEY,APPLICATION_DOCUMENTS_KEY];
const stages=['applied','screen','interview','offer','rejected','archived'];
const writes=new WeakMap();

// Meeting rounds share an application ID. Keep demo applications separate from
// appliedList so examples never enter real submission or remote-sync workflows.
export function createApplicationSamples(meetings,overrides={},now=Date.now(),documents={}){
  const groups=new Map();
  for(const row of meetings){
    if(!row.isMock||!row.applicationId?.startsWith('mock-application:'))continue;
    if(!groups.has(row.applicationId))groups.set(row.applicationId,[]);
    groups.get(row.applicationId).push(row);
  }
  return [...groups].flatMap(([id,source])=>{
    const override=overrides[id]||{};if(override.deleted)return [];
    const rows=projectMeetingRecords(source),rank=row=>isApplicationRecord(row)?3:row.status==='interview'?2:1;
    const latest=[...rows].sort((a,b)=>rank(b)-rank(a)||(Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||(Date.parse(b.meeting?.startsAt)||0)-(Date.parse(a.meeting?.startsAt)||0)||a.id.localeCompare(b.id))[0];
    const events=source.flatMap(row=>[row,...row.meetingHistory||[]]);
    const dates=events.flatMap(row=>[row.date,row.meeting?.startsAt,...(row.conversationMessages||[]).map(message=>message.sentAt)]).map(Date.parse).filter(Number.isFinite);
    const applied=new Date(Math.min(Number(now),...dates)-86400000).toISOString();
    return [{id,applicationId:id,isMock:true,companyName:latest.companyName,jobTitle:latest.jobTitle,jobLink:source[0].jobLink||'',companyLink:source[0].companyLink||'',status:latest.status,description:sampleJobDescription(latest.companyName,latest.jobTitle),date:applied,updatedAt:latest.updatedAt||applied,profileName:'',notes:'Demo application based on the meetings for this company and role.',salary:sampleSalary(id,source[0].jobTitle),...override,...(documents[id]||sampleApplicationDocuments(id,source[0].companyName,source[0].jobTitle,applied))}];
  });
}

async function snapshot(browser){
  const meetings=await loadMeetingSamples(browser),saved=await browser.storage.local.get(APPLICATION_SAMPLES_KEY),overrides=saved[APPLICATION_SAMPLES_KEY]||{};
  if(typeof overrides!=='object'||Array.isArray(overrides))throw Error('The demo applications could not be read.');
  const savedDocuments=(await browser.storage.local.get(APPLICATION_DOCUMENTS_KEY))[APPLICATION_DOCUMENTS_KEY]||{},documents={...savedDocuments};
  let changed=false;
  for(const row of createApplicationSamples(meetings))if(!documents[row.id]){documents[row.id]={resume:row.resume,coverLetterRaw:row.coverLetterRaw,coverLetterEnabled:row.coverLetterEnabled};changed=true;}
  if(changed)await browser.storage.local.set({[APPLICATION_DOCUMENTS_KEY]:documents});
  return {meetings,overrides,documents};
}
function serial(browser,action){
  const storage=browser.storage.local,run=(writes.get(storage)||Promise.resolve()).then(action);
  writes.set(storage,run.catch(()=>{}));return run;
}
export function loadApplicationSamples(browser=globalThis.chrome){
  return serial(browser,async()=>{const {meetings,overrides,documents}=await snapshot(browser);return createApplicationSamples(meetings,overrides,Date.now(),documents);});
}

export function updateApplicationSample(id,fields,browser=globalThis.chrome){
  const storage=browser.storage.local;
  return serial(browser,async()=>{
    const {meetings,overrides,documents}=await snapshot(browser),available=createApplicationSamples(meetings);
    if(id===null&&fields===null){for(const row of available)overrides[row.id]={...overrides[row.id],deleted:true};}
    else{
      if(!available.some(row=>row.id===id)||(overrides[id]?.deleted&&fields?.deleted!==false))throw Error('This demo application is no longer available.');
      const next={...overrides[id],updatedAt:new Date().toISOString()};
      if(fields===null)next.deleted=true;
      else{
        if(fields.deleted===false)delete next.deleted;
        for(const key of ['companyName','jobTitle','companyLink','jobLink','date','status'])if(Object.hasOwn(fields,key))next[key]=fields[key];
        if(next.status&&!stages.includes(next.status))throw Error('Choose an available application stage.');
        if(next.date&&!Number.isFinite(Date.parse(next.date)))throw Error('Choose a valid application date.');
      }
      overrides[id]=next;
    }
    await storage.set({[APPLICATION_SAMPLES_KEY]:overrides});
    return createApplicationSamples(meetings,overrides,Date.now(),documents);
  });
}

export function createUseApplicationSamples(React){
  return function useApplicationSamples(enabled=true){
    const [records,setRecords]=React.useState([]),[error,setError]=React.useState('');
    React.useEffect(()=>{
      if(!enabled)return;
      let alive=true,revision=0;
      const refresh=async()=>{const current=++revision;try{const rows=await loadApplicationSamples();if(alive&&current===revision){setRecords(rows);setError('');}}catch(reason){if(alive&&current===revision)setError(reason.message);}};
      const changed=(changes,area)=>{if(area==='local'&&APPLICATION_SAMPLE_KEYS.some(key=>changes[key]))void refresh();};
      chrome.storage.onChanged.addListener(changed);void refresh();
      return()=>{alive=false;revision++;chrome.storage.onChanged.removeListener(changed);};
    },[enabled]);
    return {records,error,update:async(id,fields)=>{const rows=await updateApplicationSample(id,fields);setRecords(rows);}};
  };
}
