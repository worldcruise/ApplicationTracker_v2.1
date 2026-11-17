import {readDockMeetings,meetingSourceRows,MEETING_EVENTS_KEY} from './dock-meetings-data.js';
import {applyMeetingWorkflow,workflowVersion} from './meeting-workflow-model.js';
import {withRequestDeadline} from './request-deadline.js';

const RECEIPTS='application-meeting-receipts:v1';
export async function readMeetingWorkflow(browser=chrome){
  const [meetings,saved]=await Promise.all([readDockMeetings(browser),browser.storage.local.get('appliedList')]);
  return {records:meetings.sourceRecords,applications:meetingSourceRows(saved.appliedList||[]),timeZone:meetings.timeZone};
}
export function createMeetingWorkflowService(browser=chrome){
  let tail=Promise.resolve();
  return {read:()=>readMeetingWorkflow(browser),mutate(payload){
    const task=tail.then(async()=>{
      if(!payload||typeof payload.mutationId!=='string'||!payload.mutationId||payload.mutationId.length>128)throw Error('Invalid update request.');
      const saved=await browser.storage.local.get([RECEIPTS,MEETING_EVENTS_KEY,'appliedList']),receipts=saved[RECEIPTS]||{};
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),value=>value.toString(16).padStart(2,'0')).join('');
      if(receipts[payload.mutationId]){if(receipts[payload.mutationId]!==digest)throw Error('This update identifier was already used.');return readMeetingWorkflow(browser);}
      const state=await readMeetingWorkflow(browser),record=state.records.find(row=>row.id===payload.recordId);
      if(!record)throw Error('This application or meeting is no longer available.');
      if(workflowVersion(record)!==payload.expectedVersion)throw Error('This meeting changed. Close and reopen the update to review its latest details.');
      const result=applyMeetingWorkflow(state.records,record.id,payload.action,payload.fields,Date.now(),payload.mutationId),applicationId=record.applicationId||record.id;
      const roots=meetingSourceRows(saved.appliedList||[]),index=roots.findIndex(row=>row.id===applicationId);
      if(index<0)throw Error('This application was removed.');
      const latest=result.created||result.updated,events=(saved[MEETING_EVENTS_KEY]||[]).filter(row=>row.applicationId!==applicationId);
      for(const row of result.records.filter(row=>(row.applicationId||row.id)===applicationId&&row.meeting))events.push({...row,applicationId});
      const applications=[...saved.appliedList];applications[index]={...applications[index],status:latest.status,updatedAt:latest.updatedAt};
      receipts[payload.mutationId]=digest;
      await browser.storage.local.set({appliedList:applications,[MEETING_EVENTS_KEY]:events,[RECEIPTS]:Object.fromEntries(Object.entries(receipts).slice(-200))});
      return readMeetingWorkflow(browser);
    });tail=task.catch(()=>{});return task;
  }};
}
export function getMeetingWorkflow(browser=globalThis.chrome){return withRequestDeadline(browser.workflow?browser.workflow.read():readMeetingWorkflow(browser));}
export async function saveMeetingWorkflow(payload,browser=globalThis.chrome){
  if(browser.workflow)return withRequestDeadline(browser.workflow.mutate(payload));
  const reply=await withRequestDeadline(browser.runtime.sendMessage({type:'meeting-workflow:request',payload}));
  if(!reply?.ok)throw Error(reply?.error?.message||'The meeting update could not be saved.');return reply.result;
}
export function configureMeetingWorkflow(browser=chrome){
  const service=createMeetingWorkflowService(browser),base=browser.runtime.getURL('');
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='meeting-workflow:request')return false;
    if(sender.id!==browser.runtime.id||!['options.html','sidepanel.html'].some(page=>(sender.url||'').split(/[?#]/)[0]===base+page))return false;
    service.mutate(message.payload).then(result=>respond({ok:true,result}),error=>respond({ok:false,error:{message:error.message}}));return true;
  });return service;
}
