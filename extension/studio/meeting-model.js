import {resolveMeetingTimezone,meetingTimeToISO} from './meeting-timezone.js';
export {localMeetingTime} from './meeting-timezone.js';
export const MEETING_DETAILS_KEY='meeting-details:v1';
export const INTERVIEW_COLORS=['#eeebff','#d7ceff','#b3a0f5','#8964d7','#6941b0','#452574'];
export const MEETING_TOPIC_TAGS=[['panel','Panel'],['marathon','Marathon'],['final','Final'],['technical','Technical'],['system_design','System Design'],['live_coding','Live Coding'],['behavioral','Behavioral'],['cultural','Cultural']];
export const isApplicationRecord=record=>['offer','rejected','archived'].includes(record.status);
export const meetingApplicationId=record=>record.applicationId||record.id;
export const MEETING_STATUS_LABELS={upcoming:'Upcoming',pending:'Pending',passed:'Passed',failed:'Failed'};
export const MEETING_GROUPS=[
  {id:'active',label:'Screening & Interview',statuses:['screen','interview']},
  {id:'closed',label:'Rejected & Failed',statuses:['rejected','archived']},
  {id:'offers',label:'Offers',statuses:['offer']},
];

export function meetingRound(value){return Math.min(6,Math.max(1,Math.trunc(Number(value)||1)));}
export function meetingLink(value){
  try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}
}
export function meetingIsPast(meeting,now=Date.now()){
  const time=Date.parse(meeting?.endsAt||meeting?.startsAt);return Number.isFinite(time)&&time<=Number(now);
}
export function meetingStatus(meeting,now=Date.now()){
  if(['passed','failed'].includes(meeting?.result))return meeting.result;
  return Date.parse(meeting?.startsAt)>Number(now)?'upcoming':'pending';
}
export function recordUpdatedAt(record){return record.updatedAt||record.meeting?.updatedAt||record.date||record.appliedAt;}
export function meetingRecordUpdate(record,fields,now=new Date()){
  const updatedAt=new Date(now).toISOString(),meeting={...record.meeting,...fields.meeting};
  const kind=meeting.kind||(!isApplicationRecord(record)?record.status:'interview');
  let status=fields.status||record.status;
  if(['screen','interview'].includes(fields.status)&&isApplicationRecord(record)&&meeting.result==='failed')meeting.result='pending';
  if(fields.meeting?.result==='failed')status='archived';
  else if(fields.meeting&&record.status==='archived'&&record.meeting?.result==='failed')status=kind;
  if(status==='archived'&&meeting.startsAt){
    if(!meetingIsPast(meeting,now))throw Error('Mark the interview Failed after it has ended.');
    meeting.result='failed';
  }
  if(status==='offer'&&meeting.startsAt&&meetingIsPast(meeting,now))meeting.result='passed';
  return {...record,...fields,status,updatedAt,...meeting.startsAt?{meeting:{...meeting,kind,updatedAt,applicationStage:status}}:{}};
}
export function projectMeetingRecords(records,details={}){
  const rows=records.map(row=>{
    const meeting=details[row.id]||row.meeting,status=meeting?.applicationStage||row.status;
    const updatedAt=meeting?.updatedAt||row.updatedAt;
    return {...row,meeting,status,updatedAt,appliedAt:isApplicationRecord({status})?(updatedAt||row.date||row.appliedAt):(meeting?.startsAt||row.appliedAt||row.date)};
  });
  const outcomes=new Map();
  for(const row of rows.filter(isApplicationRecord)){
    const id=meetingApplicationId(row),previous=outcomes.get(id);
    if(!previous||Date.parse(recordUpdatedAt(row))>Date.parse(recordUpdatedAt(previous)))outcomes.set(id,row);
  }
  return rows.filter(row=>!outcomes.has(meetingApplicationId(row))||outcomes.get(meetingApplicationId(row)).id===row.id);
}
export function meetingColors(record){
  const meeting=record.meeting||{},round=meetingRound(meeting.round);
  if(record.status==='interview')return {background:INTERVIEW_COLORS[round-1],ink:round>=4?'#ffffff':'#29174a',accent:round>=4?'#ece5ff':'#59318e'};
  const hue=record.status==='offer'?215:record.status==='rejected'?345:record.status==='archived'?42:meeting.mode==='phone'?160:195;
  return {background:`hsl(${hue} 65% 94%)`,ink:`hsl(${hue} 50% 23%)`,accent:`hsl(${hue} 50% 37%)`};
}
export function meetingDate(value,timeZone,compact=false){
  const date=new Date(value);if(!value||!Number.isFinite(date.getTime()))return {date:'Not scheduled',time:''};
  const zone=resolveMeetingTimezone(timeZone);
  return {date:new Intl.DateTimeFormat(undefined,{timeZone:zone,month:'short',day:'numeric',...(!compact?{year:'numeric'}:{})}).format(date),time:new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(date)};
}
export function meetingRange(meeting,timeZone,compact=false){
  const start=meetingDate(meeting?.startsAt,timeZone,compact),end=meetingDate(meeting?.endsAt,timeZone,compact);
  if(!start.time)return start;
  if(!end.time)return {...start,time:`${start.time}–?`};
  return {date:start.date===end.date?start.date:`${start.date} – ${end.date}`,time:`${start.time}–${end.time}`};
}
export function previousMeetings(record,records,now=Date.now()){
  const outcome=isApplicationRecord(record);
  if(record.status!=='interview'&&!outcome)return [];
  const before=outcome?Number(now):Math.min(Number(now),Date.parse(record.meeting?.startsAt));
  const all=new Map();
  for(const row of records.filter(row=>meetingApplicationId(row)===meetingApplicationId(record))){
    if(row.meeting?.startsAt&&(!isApplicationRecord(row)||['screen','interview'].includes(row.meeting.kind))){const entry=isApplicationRecord(row)?{...row,id:`${row.id}:last-meeting`,status:row.meeting.kind}:row;all.set(entry.id,entry);}
    for(const entry of row.meetingHistory||[])all.set(entry.id,{...entry,applicationId:meetingApplicationId(row)});
  }
  return [...all.values()].filter(row=>(outcome||row.id!==record.id)&&!isApplicationRecord(row)&&row.meeting?.lifecycle!=='cancelled'&&Date.parse(row.meeting?.startsAt)<before&&Date.parse(row.meeting?.endsAt||row.meeting?.startsAt)<=before)
    .sort((a,b)=>Date.parse(a.meeting.startsAt)-Date.parse(b.meeting.startsAt)||a.id.localeCompare(b.id));
}
export function applicationConversation(record,records){
  const messages=new Map(),fragments=[];
  for(const row of records.filter(row=>meetingApplicationId(row)===meetingApplicationId(record))){
    for(const message of row.conversationMessages||row.meeting?.messages||[])if(message.id&&!messages.has(message.id))messages.set(message.id,message);
    if(row.meeting?.chatHistory?.trim())fragments.push({id:row.id,text:row.meeting.chatHistory});
  }
  return {messages:[...messages.values()].sort((a,b)=>Date.parse(a.sentAt)-Date.parse(b.sentAt)||a.id.localeCompare(b.id)),fragments};
}
export function initialMeetingFocus(rows,now=Date.now()){
  const eligible=rows.filter(row=>!isApplicationRecord(row)&&!['cancelled','no_show','draft'].includes(row.meeting?.lifecycle)&&Number.isFinite(Date.parse(row.meeting?.startsAt)));
  const start=row=>Date.parse(row.meeting.startsAt),end=row=>Date.parse(row.meeting.endsAt||row.meeting.startsAt);
  return eligible.filter(row=>start(row)<=now&&end(row)>now).sort((a,b)=>end(a)-end(b))[0]?.id
    ||eligible.filter(row=>start(row)>=now).sort((a,b)=>start(a)-start(b))[0]?.id
    ||eligible.filter(row=>end(row)<=now).sort((a,b)=>end(b)-end(a))[0]?.id||null;
}
export function compareMeetingBoardRows(a,b){
  const date=value=>Number.isFinite(Date.parse(value))?Date.parse(value):0;
  if(isApplicationRecord(a)!==isApplicationRecord(b))return Number(isApplicationRecord(a))-Number(isApplicationRecord(b));
  return date(b.appliedAt)-date(a.appliedAt)||a.id.localeCompare(b.id);
}
export function validateMeeting(fields,timeZone,previous){
  const time=new Date(meetingTimeToISO(fields.startsAt,timeZone,typeof previous==='string'?previous:previous?.startsAt));
  const end=new Date(meetingTimeToISO(fields.endsAt,timeZone,previous?.endsAt));
  if(!fields.startsAt||!Number.isFinite(time.getTime()))throw Error('Choose a valid meeting date and time.');
  if(end<=time)throw Error('The end time must be after the start time.');
  if(!['phone','video'].includes(fields.mode))throw Error('Choose Phone or Video.');
  const round=Number(fields.round);
  if(!Number.isInteger(round)||round<1||round>6)throw Error('Interview rounds must be between 1 and 6.');
  const result=fields.result==='upcoming'?'pending':fields.result||'pending';
  if(!['pending','passed','failed'].includes(result))throw Error('Choose a valid meeting status.');
  if(['passed','failed'].includes(result)&&end.getTime()>Date.now())throw Error('Record a Passed or Failed result after the meeting has ended.');
  if(fields.joinUrl&&!meetingLink(fields.joinUrl))throw Error('Use an http or https meeting link.');
  if(time.getTime()>=Date.now()){
    if(fields.mode==='phone'&&!/\d{5}/.test((fields.phone||'').replace(/\D/g,'')))throw Error('Add the phone number for this meeting.');
    if(fields.mode==='video'&&!meetingLink(fields.joinUrl))throw Error('Add the video meeting link.');
  }
  const topics=[...new Set(fields.topics||[])];if(topics.some(tag=>!MEETING_TOPIC_TAGS.some(([key])=>key===tag)))throw Error('Choose a supported meeting tag.');
  return {...fields,startsAt:time.toISOString(),endsAt:end.toISOString(),topics,round,result,joinUrl:meetingLink(fields.joinUrl)};
}
