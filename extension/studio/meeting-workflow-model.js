import {meetingNeedsAction,meetingIsPast,meetingRound,isApplicationRecord,meetingRecordUpdate,validateMeeting,meetingApplicationId} from './meeting-model.js';

export const workflowVersion=record=>JSON.stringify(record);
export function attentionMeetings(records,now=Date.now()){
  return records.filter(row=>meetingNeedsAction(row.meeting,now)).sort((a,b)=>Date.parse(a.meeting.endsAt)-Date.parse(b.meeting.endsAt)||a.id.localeCompare(b.id));
}
export function applicationMeeting(applicationId,records,now=Date.now()){
  const rows=records.filter(row=>meetingApplicationId(row)===applicationId);
  return attentionMeetings(rows,now)[0]||rows.find(isApplicationRecord)||[...rows].sort((a,b)=>(b.status==='interview')-(a.status==='interview')||meetingRound(b.meeting?.round)-meetingRound(a.meeting?.round)||Date.parse(b.meeting?.startsAt)-Date.parse(a.meeting?.startsAt))[0];
}
export function workflowMode(record,now=Date.now()){
  if(!record)return 'choose';
  if(meetingNeedsAction(record.meeting,now))return 'complete';
  if(isApplicationRecord(record))return 'closed';
  if(record.status==='applied')return 'advance';
  return record.meeting?.startsAt&&!meetingIsPast(record.meeting,now)?'reschedule':nextStep(record)?'advance':'decision';
}
export function nextStep(record){
  if(record.status==='applied')return {status:'screen',round:null,label:'Schedule screening'};
  if(record.status==='screen')return {status:'interview',round:1,label:'Schedule interview · Round 1'};
  const round=meetingRound(record.meeting?.round);
  return round>=6||record.meeting?.topics?.includes('final')?null:{status:'interview',round:round+1,label:`Schedule interview · Round ${round+1}`};
}
const required=(value,label,max=10000)=>{if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(`Enter ${label}.`);return value.trim();};
export function applyMeetingWorkflow(records,recordId,action,fields={},now=Date.now(),mutationId=crypto.randomUUID()){
  const record=records.find(row=>row.id===recordId);
  if(!record)throw Error('This meeting is no longer available.');
  const stamp=new Date(now).toISOString(),meeting=record.meeting||{};
  let updated,created;
  if(action==='complete'){
    if(!meetingIsPast(meeting,now)||!meeting.endsAt||['cancelled','draft','no_show'].includes(meeting.lifecycle))throw Error('Complete this meeting after it has ended.');
    const transcript=String(fields.transcript||'').trim(),transcriptUnavailableReason=String(fields.transcriptUnavailableReason||'').trim();
    if(!transcript&&!transcriptUnavailableReason)throw Error('Add the transcript or explain why it is unavailable.');
    if(transcript.length>1048576)throw Error('Keep the transcript within 1 MiB.');
    const followUpNotRequiredReason=String(fields.followUpNotRequiredReason||'').trim();
    let followUp=null,messages=record.conversationMessages||[];
    if(!followUpNotRequiredReason){
      const email=fields.email||{},sent=Date.parse(email.sentAt);
      if(!email.confirmedAlreadySent)throw Error('Confirm this email was already sent.');
      if(!Number.isFinite(sent)||sent<Date.parse(meeting.endsAt)||sent>Number(now))throw Error('The email time must be after the meeting ended and before now.');
      const sender=required(email.from,'the sender email',300),recipient=required(email.to,'the recipient email',300);
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sender)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient))throw Error('Enter valid sender and recipient email addresses.');
      followUp={id:meeting.review?.followUp?.id||`${mutationId}:follow-up`,meetingId:record.id,channel:'email',purpose:'follow_up',sender:{email:sender},recipients:[{email:recipient}],subject:required(email.subject,'a subject',500),sentAt:new Date(sent).toISOString(),body:required(email.body,'the email content',131072)};
      messages=[...messages.filter(message=>message.id!==followUp.id),followUp];
    }
    updated={...record,updatedAt:stamp,conversationMessages:messages,meeting:{...meeting,transcript,result:['passed','failed'].includes(meeting.result)?meeting.result:'pending',lifecycle:'completed',review:{required:true,completedAt:stamp,transcriptUnavailableReason,followUpNotRequiredReason,followUp}}};
  }else if(action==='reschedule'){
    if(isApplicationRecord(record)||meeting.lifecycle==='completed'||['passed','failed'].includes(meeting.result))throw Error('Create a new appointment for a completed meeting.');
    if(meetingIsPast(meeting,now)&&!fields.didNotOccur)throw Error('Confirm that the original meeting did not take place.');
    const schedule=validateMeeting({...meeting,...fields,round:meetingRound(meeting.round),result:'pending'},fields.timeZone,meeting);
    if(Date.parse(schedule.startsAt)<=Number(now))throw Error('Choose a future time for the rescheduled meeting.');
    updated=meetingRecordUpdate(record,{meeting:{...schedule,lifecycle:'scheduled',transcript:'',review:{required:true,completedAt:null,followUp:null}}},now);
    if(updated.meeting.scheduleHistory?.length===meeting.scheduleHistory?.length)throw Error('Choose a different meeting time to reschedule.');
  }else if(action==='advance'){
    const next=nextStep(record);if(!next||isApplicationRecord(record))throw Error('Record an offer or decision for this application.');
    if(record.status!=='applied'){
      if(!meetingIsPast(meeting,now)||meetingNeedsAction(meeting,now))throw Error('Complete the current meeting before advancing.');
      if(!fields.confirmPassed)throw Error('Confirm that this meeting passed before scheduling the next step.');
      const peers=records.filter(row=>meetingApplicationId(row)===meetingApplicationId(record)&&row.id!==record.id);
      if(peers.some(row=>row.status===next.status&&meetingRound(row.meeting?.round)>=meetingRound(next.round)))throw Error('The next step already exists. Open its meeting instead.');
      if(peers.some(row=>row.status===record.status&&meetingRound(row.meeting?.round)===meetingRound(meeting.round)&&row.meeting?.result!=='passed'&&!['cancelled'].includes(row.meeting?.lifecycle)))throw Error('Resolve the other sessions in this round first.');
    }
    const scheduled=validateMeeting({...fields,round:next.round||1,result:'pending',topics:[]},fields.timeZone);
    if(Date.parse(scheduled.startsAt)<=Number(now))throw Error('Choose a future time for the next meeting.');
    const {confirmPassed,timeZone,...clean}=scheduled;
    created={id:`meeting:${mutationId}`,applicationId:meetingApplicationId(record),companyName:record.companyName,jobTitle:record.jobTitle,jobLink:record.jobLink,status:next.status,date:stamp,updatedAt:stamp,meeting:{...clean,kind:next.status,round:next.round,lifecycle:'scheduled',transcript:'',review:{required:true,completedAt:null,followUp:null}}};
    updated={...record,updatedAt:stamp,...record.status==='applied'?{}:{meeting:{...meeting,result:'passed'}}};
  }else if(action==='failed'||action==='offer'){
    const reason=required(fields.reason,'the decision or reason');
    if(action==='failed'&&!meetingIsPast(meeting,now)&&record.status!=='applied')throw Error('Record a failed result after the meeting ends.');
    updated={...record,status:action==='offer'?'offer':record.status==='applied'?'rejected':'archived',updatedAt:stamp,outcomeReason:reason,...record.meeting?{meeting:{...meeting,result:action==='failed'?'failed':meeting.result}}:{}};
  }else throw Error('Choose a supported update.');
  return {records:[...records.map(row=>row.id===recordId?updated:row),...created?[created]:[]],updated,created};
}
