import {meetingScheduleSnapshot} from '../../extension/studio/meeting-model.js';
import {refineSampleSchedule} from './meeting-sample-schedule.mjs';
import {sampleDataEnabled,clearLocalMockData} from './sample-data.mjs';
export const MEETING_SAMPLES_KEY='meeting-mock-cards:v1';
export const MEETING_SAMPLES_VERSION_KEY='meeting-mock-cards:version';
const VERSION=9;
const interviewers=['Avery Morgan','Jordan Lee','Taylor Brooks','Casey Rivera','Riley Chen','Morgan Ellis'];

export function createMeetingSamples(now=new Date()) {
  const samples=[
    ['northstar','Northstar Systems','Frontend Engineer','screen','phone',1,1],
    ['harbor','Harbor Analytics','Data Analyst','screen','video',1,-2],
    ['orbit','Orbit Labs','Full Stack Developer','interview','video',1,-10],
    ['cedar','Cedar Health','Product Designer','interview','video',1,-9],
    ['summit','Summit Cloud','Platform Engineer','offer','video',1,2],
    ['brightline','Brightline Software','QA Engineer','offer','phone',1,-1],
    ['maple','Maple Commerce','Product Manager','rejected','video',3,-5],
    ['atlas','Atlas Robotics','Software Engineer','rejected','video',4,-7],
    ['riverbend','Riverbend Finance','Business Analyst','archived','phone',1,-12],
    ['lumen','Lumen Digital','UX Researcher','archived','video',2,-14],
    ['clearwater','Clearwater Energy','Data Engineer','screen','phone',1,2],
    ['pinecone','Pinecone Media','Content Designer','screen','video',1,3],
    ['meridian','Meridian Health','Backend Engineer','screen','phone',1,-3],
    ['bluebird','Bluebird Travel','Product Analyst','screen','video',1,4],
    ['stonebridge','Stonebridge Systems','DevOps Engineer','screen','phone',1,5],
    ['evergreen','Evergreen Learning','Frontend Engineer','screen','video',1,-1],
    ['daybreak','Daybreak Studio','UX Designer','screen','phone',1,6],
    ['coastline','Coastline Logistics','Operations Analyst','screen','video',1,-4],
    ...[2,3,4,5,6].map((round,index)=>[`orbit-round-${round}`,'Orbit Labs','Full Stack Developer','interview','video',round,[-8,-6,-4,-2,2][index]]),
    ...[2,3,4,5,6].map((round,index)=>[`cedar-round-${round}`,'Cedar Health','Product Designer','interview','video',round,[-7,-5,-3,-1,4][index]]),
    ['aster-offer','Aster Security','Security Engineer','offer','video',1,3],
    ['silverline-offer','Silverline Commerce','Engineering Manager','offer','phone',1,4],
    ['echo-first','Echo Works','Frontend Engineer','interview','video',1,1],
    ['juniper-second','Juniper Labs','Backend Engineer','interview','video',2,2],
    ['nova-third','Nova Analytics','Data Engineer','interview','video',3,1],
    ['willow-first','Willow Health','Product Designer','interview','video',1,-1],
    ['pixel-second','Pixel Studio','Full Stack Developer','interview','video',2,-2],
    ['cobalt-third','Cobalt Cloud','Platform Engineer','interview','video',3,-1],
  ];
  const records=samples.map(([key,company,role,status,mode,round,days],index)=>{
    const date=new Date(now);date.setDate(date.getDate()+days);date.setHours(10+index%5,index%2?30:0,0,0);
    const interviewer=interviewers[(round+index)%interviewers.length],past=date<now;
    const outcome=['offer','rejected','archived'].includes(status);
    const updatedAt=new Date(Math.min(date.getTime()+7200000,Number(now)-(index+1)*3600000)).toISOString();
    const record={id:`mock-meeting:${key}`,applicationId:`mock-application:${key.replace(/^(orbit|cedar)-round-\d$/, '$1')}`,isMock:true,jobTitle:role,companyName:company,jobLink:`https://example.test/mock-meetings/${key}`,companyLink:'',status,date:date.toISOString(),updatedAt,profileName:'',
      ...outcome?{}:{meeting:{kind:status,result:past&&((status==='interview'&&round<6&&index<30)||(status==='screen'&&index%3===0))?'passed':'pending',startsAt:date.toISOString(),endsAt:new Date(date.getTime()+(status==='screen'?30:60)*60000).toISOString(),mode,round,interviewer,topics:status==='interview'?[['technical'],['live_coding'],['system_design'],['behavioral'],['panel','cultural'],['final']][round-1]:[],rescheduled:index%7===3,phone:`+1 (202) 555-01${String(index).padStart(2,'0')}`,joinUrl:`https://example.test/meetings/${key}`,
        transcript:past?`${interviewer}: Welcome, and thanks for meeting with ${company}. Could you tell me about your recent work?\n\nCandidate: I worked with a small team to improve a customer workflow and make it easier to use.\n\n${interviewer}: What was your contribution, and how did you evaluate the result?\n\nCandidate: I owned the implementation and reviewed feedback with the team before the next release.\n\n${interviewer}: Thank you. We will follow up with the next steps for the ${role} position.`:'',
        chatHistory:''}}};
    if(status==='archived'||status==='offer'||(index>=30&&round>1)){
      const count=outcome?(status==='archived'?2:3):round-1;
      const last=new Date(Math.min(Date.parse(updatedAt),date.getTime(),Number(now))-86400000);
      record.meetingHistory=Array.from({length:count},(_,i)=>{
        const start=new Date(last.getTime()-(count-i-1)*86400000),end=new Date(start.getTime()+3600000);
        return {id:`${record.id}:history:${i+1}`,applicationId:record.applicationId,status:'interview',companyName:company,jobTitle:role,meeting:{kind:'interview',startsAt:start.toISOString(),endsAt:end.toISOString(),round:i+1,mode:'video',interviewer,topics:i===0?['technical']:['behavioral'],result:status==='archived'&&i===count-1?'failed':'passed',transcript:`${interviewer}: We discussed your experience and the ${role} role at ${company}.\n\nCandidate: Thank you for meeting with me.\n\nOutcome: ${status==='archived'&&i===count-1?'The application did not progress after this interview.':'Passed to the next stage.'}`}};
      });
    }
    return record;
  });
  return addSampleWorkflow(addSampleReschedules(addSampleConversations(refineSampleSchedule(addSampleScreenings(records,now),now),now),now),true);
}

function addSampleWorkflow(records,fresh=false){
  const pending=['harbor','coastline','willow-first','pixel-second','cobalt-third'];
  return records.map(row=>{
    if(!row.isMock||!pending.some(id=>row.id===`mock-meeting:${id}`)||row.meeting?.review)return row;
    const meeting={...row.meeting,review:{required:true,completedAt:null,followUp:null}};
    if(fresh&&['mock-meeting:harbor','mock-meeting:pixel-second'].includes(row.id))meeting.transcript='';
    return {...row,meeting};
  });
}

function addSampleReschedules(records,now=new Date()){
  return records.map(row=>{
    if(!row.isMock||!row.meeting?.rescheduled||Array.isArray(row.meeting.scheduleHistory))return row;
    const start=Date.parse(row.meeting.startsAt),end=Date.parse(row.meeting.endsAt);
    if(!Number.isFinite(start)||!Number.isFinite(end))return row;
    const previous={...meetingScheduleSnapshot(row.meeting),startsAt:new Date(start-2*86400000).toISOString(),endsAt:new Date(end-2*86400000).toISOString(),transcript:''};
    const reason=row.meeting.rescheduleReason||'The interviewer had a scheduling conflict and requested a new time.';
    return {...row,meeting:{...row.meeting,scheduleHistory:[{id:`${row.id}:original-slot`,changedAt:new Date(Math.min(start-3*86400000,Number(now)-3600000)).toISOString(),reason,previous,nextStartsAt:row.meeting.startsAt,nextEndsAt:row.meeting.endsAt}]}};
  });
}

function addSampleScreenings(records,now=new Date()){
  const screenings=new Map();
  for(const row of records){
    if(!row.isMock||!row.applicationId?.startsWith('mock-application:')||screenings.has(row.applicationId))continue;
    const peers=records.filter(peer=>peer.applicationId===row.applicationId);
    const history=peers.flatMap(peer=>[...(peer.meetingHistory||[]),...peer.meeting?.startsAt&&['screen','interview'].includes(peer.meeting.kind)?[{...peer,status:peer.meeting.kind}]:[]]);
    if(history.some(entry=>entry.status==='screen'))continue;
    const interviews=history.filter(entry=>entry.status==='interview'&&Number.isFinite(Date.parse(entry.meeting?.startsAt)));
    if(!interviews.length)continue;
    const first=interviews.sort((a,b)=>Date.parse(a.meeting.startsAt)-Date.parse(b.meeting.startsAt))[0];
    const start=new Date(Math.min(Date.parse(first.meeting.startsAt),Number(now))-86400000),end=new Date(start.getTime()+30*60000);
    screenings.set(row.applicationId,{id:`${row.applicationId}:screening`,applicationId:row.applicationId,status:'screen',companyName:row.companyName,jobTitle:row.jobTitle,
      meeting:{kind:'screen',round:null,mode:'phone',result:'passed',startsAt:start.toISOString(),endsAt:end.toISOString(),interviewer:`${row.companyName} recruiter`,topics:[],phone:'+1 (202) 555-0100',
        transcript:`Recruiter: Welcome to the initial screening for the ${row.jobTitle} role at ${row.companyName}. We discussed your background, availability and interest in the position.\n\nCandidate: Thank you for explaining the role and interview process.\n\nScreening result: Passed. The next step is interview Round 1.`}});
  }
  return records.map(row=>screenings.has(row.applicationId)?{...row,meetingHistory:[screenings.get(row.applicationId),...(row.meetingHistory||[])]}:row);
}

function addSampleConversations(records,now=new Date()){
  return records.map(row=>{
    if(row.conversationMessages||!row.isMock||!row.applicationId)return row;
    const peers=records.filter(peer=>peer.applicationId===row.applicationId);
    const first=Math.min(...peers.map(peer=>Date.parse(peer.meeting?.startsAt||peer.date)).filter(Number.isFinite),Number(now));
    const recruiter={name:row.companyName+' recruiting',email:'recruiting@example.test'},candidate={name:'Candidate',email:'candidate@example.test'};
    const scheduled=Date.parse(row.meeting?.startsAt||row.date);
    const date=Number.isFinite(scheduled)?Math.min(scheduled-86400000,Number(now)-3600000):Number(now)-3600000;
    const message=(id,at,sender,recipients,body)=>({id,sentAt:new Date(at).toISOString(),sender,recipients,body});
    return {...row,conversationMessages:[
      message(`${row.applicationId}:first-contact`,first-7*86400000,recruiter,[candidate],`Thank you for applying for the ${row.jobTitle} position at ${row.companyName}. We would like to learn more about your experience.`),
      message(`${row.id}:update`,date,recruiter,[candidate],row.meeting?`Your ${row.status==='interview'?`round ${row.meeting.round} interview`:'screening call'} is scheduled. Please let us know if you need another time.`:row.status==='offer'?'We are pleased to share an offer. Please review the terms and send us your questions.':row.status==='rejected'?'Thank you for your application. We will not be moving forward.':'Thank you for interviewing with us. We will not be moving forward after your last interview.'),
      message(`${row.id}:reply`,date+1800000,candidate,[recruiter],row.meeting?'Thank you for the details. I look forward to speaking with the team.':'Thank you for the update.'),
      ...(row.meeting&&Date.parse(row.meeting.endsAt)<Number(now)?[message(`${row.id}:followup`,Math.min(Date.parse(row.meeting.endsAt)+3600000,Number(now)-60000),recruiter,[candidate],'Thanks for joining today. Please send any follow-up questions here.')]:[])
    ]};
  });
}

export async function loadMeetingSamples(browser=globalThis.chrome) {
  await clearLocalMockData(browser);
  const saved=await browser.storage.local.get([MEETING_SAMPLES_KEY,MEETING_SAMPLES_VERSION_KEY]);
  if(!sampleDataEnabled(browser))return Array.isArray(saved[MEETING_SAMPLES_KEY])?saved[MEETING_SAMPLES_KEY]:[];
  if(Array.isArray(saved[MEETING_SAMPLES_KEY])&&saved[MEETING_SAMPLES_VERSION_KEY]>=VERSION)return saved[MEETING_SAMPLES_KEY];
  const defaults=createMeetingSamples(),previous=saved[MEETING_SAMPLES_KEY];
  // Correct only untouched demo sequences. User-edited meetings retain their dates and results.
  const correctedApplications=new Set(['mock-application:orbit','mock-application:cedar'].filter(id=>{
    if(saved[MEETING_SAMPLES_VERSION_KEY]!==5||!Array.isArray(previous))return false;
    const peers=previous.filter(row=>row.applicationId===id).sort((a,b)=>a.meeting?.round-b.meeting?.round),first=new Date(peers[0]?.meeting?.startsAt);
    const offsets=id.endsWith('orbit')?[0,3,6,9,12,15]:[0,3,6,10,13,16];
    return peers.length===6&&peers.every((row,index)=>{
      const expected=new Date(first);expected.setDate(expected.getDate()+offsets[index]);
      return row.isMock&&row.status==='interview'&&!row.meeting?.updatedAt&&!row.meeting?.applicationStage&&new Date(row.meeting?.startsAt).toDateString()===expected.toDateString()&&(!row.meeting?.transcript||row.meeting.transcript===defaults.find(item=>item.id===row.id)?.meeting?.transcript);
    });
  }));
  let samples=Array.isArray(previous)?previous.map(row=>{
    const example=defaults.find(item=>item.id===row.id);if(!example)return row;
    if(row.isMock&&correctedApplications.has(row.applicationId)&&row.status==='interview')return {...row,date:example.date,meeting:{...row.meeting,startsAt:example.meeting.startsAt,endsAt:example.meeting.endsAt,result:example.meeting.result,transcript:example.meeting.transcript}};
    const oldDefault=/^Mock · .+ · /.test(row.jobTitle||'');
    const startsAt=row.meeting?.startsAt||row.date||example.meeting?.startsAt;
    const endTime=Date.parse(startsAt)+(row.status==='screen'?30:60)*60000;
    const endsAt=row.meeting?.endsAt||(Number.isFinite(endTime)?new Date(endTime).toISOString():undefined);
    const {conversationMessages,meetingHistory,...defaultsForRow}=example;
    const defaultHistory=meetingHistory?.filter(entry=>entry.status!=='screen');
    const {scheduleHistory:defaultScheduleHistory,review:defaultReview,...defaultMeeting}=example.meeting||{};
    const meeting=example.meeting||row.meeting?{...defaultMeeting,...row.meeting,startsAt,endsAt}:undefined;
    if(meeting&&!row.meeting?.result&&Date.parse(endsAt)>Date.now())meeting.result='pending';
    return {...defaultsForRow,...defaultHistory?.length?{meetingHistory:defaultHistory}:{},...row,jobTitle:oldDefault?example.jobTitle:row.jobTitle,isMock:true,...meeting?{meeting}:{}};
  }):defaults;
  if(Array.isArray(previous)&&(saved[MEETING_SAMPLES_VERSION_KEY]||0)<2){
    for(const example of defaults.slice(10))if(!samples.some(row=>row.id===example.id))samples.push(example);
  }else if(Array.isArray(previous)&&previous.length&&(saved[MEETING_SAMPLES_VERSION_KEY]||0)<4){
    for(const example of defaults.slice(30))if(!samples.some(row=>row.id===example.id))samples.push(example);
  }
  const fixedApplications=new Set(samples.filter(row=>{
    const original=defaults.find(example=>example.id===row.id);
    return row.meeting?.transcript&&row.meeting.transcript!==original?.meeting?.transcript;
  }).map(row=>row.applicationId));
  samples=addSampleWorkflow(addSampleReschedules(addSampleConversations(refineSampleSchedule(addSampleScreenings(samples),Date.now(),fixedApplications))));
  await browser.storage.local.set({[MEETING_SAMPLES_KEY]:samples,[MEETING_SAMPLES_VERSION_KEY]:VERSION});return samples;
}
