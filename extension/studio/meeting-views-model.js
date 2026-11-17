import {isApplicationRecord,meetingApplicationId,meetingIsPast,meetingStatus,meetingRound,compareMeetingBoardRows} from './meeting-model.js';
import {localMeetingTime} from './meeting-timezone.js';
import {matchesApplicationDate} from './application-filter-model.js';

export const MEETING_VIEW_KEY='meeting-view:v1';
export const MEETING_VIEWS=[['calendar','Calendar'],['progress','Progress']];
export const MEETING_STAGES=[['screen','Screening'],['interview','Interview'],['rejected','Rejected'],['archived','Failed'],['offer','Offer']];
export const validMeetingView=value=>MEETING_VIEWS.some(([key])=>key===value)?value:'calendar';
export const MEETING_PROGRESS_SORTS=[['next','Next meeting'],['stage','Furthest stage'],['company','Company A–Z'],['role','Role A–Z'],['earliest','Earliest meeting'],['latest','Latest meeting']];
export const meetingDay=(instant,timeZone)=>localMeetingTime(instant,timeZone).slice(0,10);

export function shiftMeetingMonth(month,amount){
  const [year,index]=month.split('-').map(Number);
  return new Date(Date.UTC(year,index-1+amount,1)).toISOString().slice(0,7);
}
export function meetingMonthDays(month){
  const [year,index]=month.split('-').map(Number),first=new Date(Date.UTC(year,index-1,1));
  return Array.from({length:42},(_,i)=>new Date(Date.UTC(year,index-1,1-first.getUTCDay()+i)).toISOString().slice(0,10));
}
export function meetingDayLabel(day,options={}){
  return new Intl.DateTimeFormat(undefined,{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',...options}).format(new Date(`${day}T12:00:00Z`));
}
export function meetingDayRange(record,timeZone){
  const start=Date.parse(record.meeting?.startsAt),end=Date.parse(record.meeting?.endsAt);
  if(!Number.isFinite(start))return {from:'',to:''};
  return {from:meetingDay(start,timeZone),to:meetingDay(Number.isFinite(end)&&end>start?end-1:start,timeZone)};
}
export function meetingsOnDay(records,day,timeZone){
  return meetingDayAgendas(records,[day],timeZone).get(day);
}
export function meetingDayAgendas(records,days,timeZone){
  // Convert each appointment once per render, rather than once for every calendar cell.
  const ranges=records.map(record=>({record,...meetingDayRange(record,timeZone)}));
  return new Map(days.map(day=>[day,ranges.filter(({from,to})=>from&&from<=day&&to>=day).map(({record})=>record)
    .sort((a,b)=>Date.parse(a.meeting.startsAt)-Date.parse(b.meeting.startsAt)||a.id.localeCompare(b.id))]));
}

// Historical entries share their original application; outcomes are never appointments.
export function meetingEvents(records,now=Date.now()){
  const events=new Map(),closed=new Set(records.filter(isApplicationRecord).map(meetingApplicationId));
  function add(parent,entry,historical=false){
    const kind=entry.meeting?.kind||entry.status;
    if(!['screen','interview'].includes(kind)||!Number.isFinite(Date.parse(entry.meeting?.startsAt)))return;
    const applicationId=meetingApplicationId(parent),isClosed=closed.has(applicationId);
    if(isClosed&&!meetingIsPast(entry.meeting,now))return;
    const outcome=isApplicationRecord(entry),id=outcome?`${entry.id}:last-meeting`:entry.id;
    const {applicationStage,history,...meeting}=entry.meeting;
    const event={...parent,...entry,id,applicationId,status:kind,meeting,historyOnly:historical||outcome||isClosed};
    if(!events.has(id)||!event.historyOnly)events.set(id,event);
  }
  for(const record of records){
    add(record,record);
    for(const entry of record.meetingHistory||record.meeting?.history||[])add(record,entry,true);
  }
  return [...events.values()];
}
export function calendarMeetingData(currentRecords,sourceRecords,filters,timeZone,now=Date.now()){
  const query=(filters.query||'').trim().toLowerCase();
  const eligible=currentRecords.filter(record=>MEETING_STAGES.some(([key])=>key===record.status)
    &&(!filters.status||filters.status==='all'||record.status===filters.status)
    &&(!query||[record.companyName,record.jobTitle].some(value=>(value||'').toLowerCase().includes(query))));
  const applications=new Set(eligible.map(meetingApplicationId));
  const events=meetingEvents(sourceRecords,now).filter(record=>{
    if(!applications.has(meetingApplicationId(record)))return false;
    const end=Date.parse(record.meeting.endsAt),start=Date.parse(record.meeting.startsAt);
    return matchesApplicationDate(record.meeting.startsAt,{...filters,timezone:timeZone},now,new Date(Number.isFinite(end)&&end>start?end-1:start).toISOString());
  });
  const unscheduled=filters.startDate||filters.endDate||(filters.period&&filters.period!=='all')?[]:eligible.filter(row=>!isApplicationRecord(row)&&!Number.isFinite(Date.parse(row.meeting?.startsAt)));
  return {events,unscheduled};
}
export function meetingProgressData(visibleRecords,sourceRecords,now=Date.now()){
  const applications=new Map(),events=meetingEvents(sourceRecords,now).filter(event=>!['cancelled','draft','no_show'].includes(event.meeting?.lifecycle));
  const rank=record=>isApplicationRecord(record)?3:record.status==='interview'?2:1;
  for(const record of visibleRecords){
    if(!['screen','interview'].includes(record.status))continue;
    const id=meetingApplicationId(record),current=applications.get(id);
    if(!current||rank(record)>rank(current)||rank(record)===rank(current)&&compareMeetingBoardRows(record,current)<0)applications.set(id,record);
  }
  const rows=[...applications.values()].sort(compareMeetingBoardRows).map(record=>{
    const history=events.filter(event=>meetingApplicationId(event)===meetingApplicationId(record));
    const steps=Array.from({length:7},(_,index)=>{
      const candidates=history.filter(event=>index===0?event.status==='screen':event.status==='interview'&&meetingRound(event.meeting.round)===index)
        .sort((a,b)=>Date.parse(b.meeting.startsAt)-Date.parse(a.meeting.startsAt));
      const currentStep=record.status==='screen'?0:record.status==='interview'?meetingRound(record.meeting?.round):-1;
      const event=candidates[0]||(currentStep===index&&Number.isFinite(Date.parse(record.meeting?.startsAt))&&!['cancelled','draft','no_show'].includes(record.meeting?.lifecycle)?record:undefined);
      return {label:index===0?'Screening':`Round ${index}`,event,result:event?meetingStatus(event.meeting,now):'empty',sessions:candidates.length};
    });
    return {record,steps};
  }).filter(row=>row.steps.some(step=>step.event&&step.result!=='failed'));
  return {rows,counts:Object.fromEntries(MEETING_STAGES.map(([key])=>[key,rows.filter(row=>row.record.status===key).length]))};
}

const progressEvents=row=>row.steps.filter(step=>['passed','pending','upcoming','needs_action'].includes(step.result)&&step.event).map(step=>step.event);
export function sortMeetingProgress(rows,sort='next',now=Date.now()){
  const names=new Intl.Collator(undefined,{sensitivity:'base',numeric:true});
  const latest=row=>Math.max(-Infinity,...progressEvents(row).map(event=>Date.parse(event.meeting.startsAt)).filter(Number.isFinite));
  const next=row=>Math.min(Infinity,...progressEvents(row).filter(event=>Date.parse(event.meeting.endsAt||event.meeting.startsAt)>=now).map(event=>Math.max(Number(now),Date.parse(event.meeting.startsAt))));
  const stage=row=>row.steps.reduce((value,step,index)=>step.event&&['passed','pending','upcoming'].includes(step.result)?index:value,-1);
  const compareText=(a,b)=>!a!==!b?(a?-1:1):names.compare(a||'',b||'');
  return [...rows].sort((a,b)=>{
    const byCompany=compareText(a.record.companyName?.trim(),b.record.companyName?.trim()),byRole=compareText(a.record.jobTitle?.trim(),b.record.jobTitle?.trim());
    const primary=sort==='company'?byCompany:sort==='role'?byRole:sort==='stage'?stage(b)-stage(a):sort==='next'?next(a)-next(b):sort==='earliest'?latest(a)-latest(b):latest(b)-latest(a);
    return primary||(['stage','next'].includes(sort)?latest(b)-latest(a):0)||byCompany||byRole||meetingApplicationId(a.record).localeCompare(meetingApplicationId(b.record));
  });
}

