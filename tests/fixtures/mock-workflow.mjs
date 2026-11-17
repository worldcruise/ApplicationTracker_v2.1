import {loadMeetingSamples,MEETING_SAMPLES_KEY} from './meeting-samples.mjs';
import {loadApplicationSamples,APPLICATION_SAMPLES_KEY} from './application-samples.mjs';
import {resolveMeetingTimezone,MEETING_TIMEZONE_KEY} from '../../extension/studio/meeting-timezone.js';
import {applyMeetingWorkflow,workflowVersion} from '../../extension/studio/meeting-workflow-model.js';
import {withRequestDeadline} from '../../extension/studio/request-deadline.js';

const RECEIPTS='meeting-workflow-receipts:v1';
export async function readMockWorkflow(browser=globalThis.chrome){
  const applications=await loadApplicationSamples(browser),rows=await loadMeetingSamples(browser),saved=await browser.storage.local.get(MEETING_TIMEZONE_KEY);
  const visible=new Set(applications.map(row=>row.id));
  return {records:rows.filter(row=>visible.has(row.applicationId)),applications,timeZone:resolveMeetingTimezone(saved[MEETING_TIMEZONE_KEY])};
}
export function createMockWorkflowService(browser){
  let tail=Promise.resolve();
  return {read:()=>readMockWorkflow(browser),mutate(payload){
    const run=tail.then(async()=>{
      if(!payload||typeof payload.mutationId!=='string'||payload.mutationId.length>128)throw Error('Invalid update request.');
      const saved=await browser.storage.local.get([RECEIPTS,APPLICATION_SAMPLES_KEY]),receipts=saved[RECEIPTS]||{};
      const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),byte=>byte.toString(16).padStart(2,'0')).join('');
      if(receipts[payload.mutationId]){
        if(receipts[payload.mutationId]!==signature)throw Error('This update identifier was already used.');
        return readMockWorkflow(browser);
      }
      const rows=await loadMeetingSamples(browser),record=rows.find(row=>row.id===payload.recordId);
      if(!record?.isMock||saved[APPLICATION_SAMPLES_KEY]?.[record.applicationId]?.deleted)throw Error('This demo record is no longer available.');
      if(workflowVersion(record)!==payload.expectedVersion)throw Error('This meeting changed. Your draft is retained. Close and reopen the update to review the latest record.');
      const result=applyMeetingWorkflow(rows,payload.recordId,payload.action,payload.fields,Date.now(),payload.mutationId);
      if(result.updated.meeting)result.updated.meeting.applicationStage=result.updated.status;
      const overrides={...saved[APPLICATION_SAMPLES_KEY]};
      if(['advance','failed','offer'].includes(payload.action))overrides[record.applicationId]={...overrides[record.applicationId],status:result.created?.status||result.updated.status,updatedAt:result.updated.updatedAt};
      receipts[payload.mutationId]=signature;
      await browser.storage.local.set({[MEETING_SAMPLES_KEY]:result.records,[APPLICATION_SAMPLES_KEY]:overrides,[RECEIPTS]:Object.fromEntries(Object.entries(receipts).slice(-200))});
      return readMockWorkflow(browser);
    });tail=run.catch(()=>{});return run;
  }};
}
export function getMockWorkflow(browser=globalThis.chrome){return withRequestDeadline(browser.workflow?browser.workflow.read():readMockWorkflow(browser));}
export async function saveMockWorkflow(payload,browser=globalThis.chrome){
  if(browser.workflow)return withRequestDeadline(browser.workflow.mutate(payload));
  const reply=await withRequestDeadline(browser.runtime.sendMessage({type:'meeting-workflow:request',payload}));
  if(!reply?.ok)throw Error(reply?.error?.message||'Reload the extension to connect the update workflow.');
  return reply.result;
}
