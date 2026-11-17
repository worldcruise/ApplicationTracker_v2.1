import {isApplicationRecord,meetingIsPast,meetingStatus,MEETING_STATUS_LABELS} from './meeting-model.js';
import {workflowMode,nextStep} from './meeting-workflow-model.js';
export function updateActions(record,now=Date.now()){
  if(!record||isApplicationRecord(record))return [];
  const past=meetingIsPast(record.meeting,now),result=record.meeting?.result,mode=workflowMode(record,now);
  return [...mode==='complete'||past?[{id:'complete',label:'Add transcript & follow-up',badge:'Pending'}]:[],
    ...nextStep(record)?[{id:'advance',label:'Next step',badge:record.status==='applied'?'Screening':'Passed',disabled:mode==='complete'}]:[],
    ...record.status!=='applied'&&record.meeting?.lifecycle!=='completed'&&!['passed','failed'].includes(result)?[{id:'reschedule',label:'Reschedule',badge:'Upcoming'}]:[],
    {id:'failed',label:'Record outcome',badge:record.status==='applied'?'Rejected':'Failed'},...past?[{id:'offer',label:'Record offer',badge:'Offer'}]:[]];
}
export function recordStatusLabel(record,now=Date.now()){
  if(record.status==='applied')return 'Applied';
  if(isApplicationRecord(record))return {offer:'Offer',rejected:'Rejected',archived:'Failed'}[record.status];
  return MEETING_STATUS_LABELS[meetingStatus(record.meeting,now)]||'Pending';
}
