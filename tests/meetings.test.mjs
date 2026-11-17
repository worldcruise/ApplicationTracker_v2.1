import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingSamples,loadMeetingSamples,MEETING_SAMPLES_KEY,MEETING_SAMPLES_VERSION_KEY} from './fixtures/meeting-samples.mjs';
import {meetingIsPast,meetingLink,meetingColors,validateMeeting,isApplicationRecord,meetingRange,previousMeetings,previousMeetingHistory,hasPreviousMeetings,previousMeetingLabel,applicationConversation,initialMeetingFocus,meetingStatus,meetingRecordUpdate,projectMeetingRecords,recordUpdatedAt} from '../extension/studio/meeting-model.js';
import {memoryStorage} from './helpers/dock-records-fixture.mjs';
import {localMeetingTime,meetingTimeToISO,resolveMeetingTimezone,meetingTimezoneLabel,meetingTimezones,meetingClockTime,watchMeetingClock} from '../extension/studio/meeting-timezone.js';

test('mixed meeting samples include phone screens, unique video links, history and six interview rounds',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),samples=createMeetingSamples(now);
  assert.equal(samples.length,36);assert.equal(new Set(samples.map(row=>row.id)).size,36);
  assert.equal(samples.filter(row=>row.status==='screen').length,10);assert.equal(samples.filter(row=>row.status==='interview').length,18);
  const meetings=samples.filter(row=>!isApplicationRecord(row));
  assert.equal(meetings.length,28);assert.equal(samples.filter(isApplicationRecord).length,8);
  assert.equal(new Set(samples.map(row=>row.applicationId)).size,26);
  assert.equal(new Set(meetings.map(row=>row.meeting.joinUrl)).size,28);
  for(const row of samples.filter(isApplicationRecord)){assert.equal(row.meeting,undefined);assert.ok(row.conversationMessages.length);}
  for(const row of meetings){
    const m=row.meeting;assert.ok(m.interviewer);assert.ok(m.round>=1&&m.round<=6);
    assert.ok(Date.parse(m.endsAt)>Date.parse(m.startsAt));
    if(meetingIsPast(m,now)){assert.ok(m.transcript||m.review?.required);assert.ok(row.conversationMessages.some(message=>message.body.includes('Thanks for joining')));}
    else if(m.mode==='phone')assert.match(m.phone,/555-01/);else assert.ok(meetingLink(m.joinUrl));
  }
  for(const company of ['Orbit Labs','Cedar Health']){
    const rounds=samples.filter(row=>row.companyName===company).sort((a,b)=>a.meeting.round-b.meeting.round);
    assert.deepEqual(rounds.map(row=>row.meeting.round),[1,2,3,4,5,6]);
    assert.deepEqual(rounds.map(row=>meetingStatus(row.meeting,now)),['passed','passed','passed','passed','passed','upcoming']);
    assert.ok(rounds.every((row,index)=>index===0||Date.parse(row.meeting.startsAt)>Date.parse(rounds[index-1].meeting.endsAt)));
    const luminance=rounds.map(row=>{const hex=meetingColors(row).background.slice(1);return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).reduce((a,b)=>a+b);});
    assert.ok(luminance.every((n,i)=>i===0||n<luminance[i-1]));
  }
});

test('demo sequence correction updates untouched version five samples and preserves edited applications',async()=>{
  const now=new Date(),rows=createMeetingSamples(now);
  for(const [company,offsets]of [['Orbit Labs',[0,3,6,9,12,15]],['Cedar Health',[0,3,6,10,13,16]]]){
    const rounds=rows.filter(row=>row.companyName===company).sort((a,b)=>a.meeting.round-b.meeting.round),first=new Date(rounds[0].meeting.startsAt);
    rounds.forEach((row,index)=>{const date=new Date(first),original=new Date(row.meeting.startsAt);date.setDate(date.getDate()+offsets[index]);date.setHours(original.getHours(),original.getMinutes());row.date=date.toISOString();row.meeting.startsAt=row.date;row.meeting.endsAt=new Date(+date+3600000).toISOString();row.meeting.result=index<3?'passed':'pending';if(date>now)row.meeting.transcript='';});
  }
  const edited=rows.find(row=>row.id==='mock-meeting:cedar-round-4');edited.meeting.transcript='My interview notes';
  const cedar=structuredClone(rows.filter(row=>row.companyName==='Cedar Health'));
  const local=memoryStorage({[MEETING_SAMPLES_KEY]:rows,[MEETING_SAMPLES_VERSION_KEY]:5,appliedList:[{id:'live'}]});
  const result=await loadMeetingSamples({sampleData:{enabled:true},storage:{local}}),orbit=result.filter(row=>row.companyName==='Orbit Labs').sort((a,b)=>a.meeting.round-b.meeting.round);
  assert.deepEqual(orbit.map(row=>meetingStatus(row.meeting,now)),['passed','passed','passed','passed','passed','upcoming']);
  assert.deepEqual(result.filter(row=>row.companyName==='Cedar Health'),cedar);
  assert.deepEqual((await local.get('appliedList')).appliedList,[{id:'live'}]);
  assert.deepEqual(await loadMeetingSamples({sampleData:{enabled:true},storage:{local}}),result);
});

test('upgrading meetings adds new samples once, preserves edits, and does not recreate deleted cards',async()=>{
  const old=createMeetingSamples().slice(0,10).map(({meeting,isMock,...row})=>row);old[0].jobTitle='My edited role';
  const local=memoryStorage({[MEETING_SAMPLES_KEY]:old,appliedList:[{id:'real'}]}),browser={sampleData:{enabled:true},storage:{local}};
  const first=await loadMeetingSamples(browser);assert.equal(first.length,36);assert.equal(first[0].jobTitle,'My edited role');assert.ok(first[0].meeting);
  assert.equal((await local.get(MEETING_SAMPLES_VERSION_KEY))[MEETING_SAMPLES_VERSION_KEY],9);
  await local.set({[MEETING_SAMPLES_KEY]:first.slice(1)});
  assert.equal((await loadMeetingSamples(browser)).length,35);
  assert.deepEqual((await local.get('appliedList')).appliedList,[{id:'real'}]);
});

test('meeting time, round and joining details are validated without accepting unsafe links',()=>{
  const fields={startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString(),mode:'video',round:6,joinUrl:'https://example.test/call'};
  assert.equal(validateMeeting(fields).round,6);
  assert.throws(()=>validateMeeting({...fields,round:7}),/between 1 and 6/);
  assert.throws(()=>validateMeeting({...fields,joinUrl:'javascript:alert(1)'}),/http or https/);
  assert.throws(()=>validateMeeting({...fields,joinUrl:''}),/video meeting link/);
  assert.throws(()=>validateMeeting({...fields,mode:'phone',phone:''}),/phone number/);
  assert.ok(validateMeeting({...fields,mode:'phone',phone:'+1 (202) 555-0100'}));
  assert.throws(()=>validateMeeting({...fields,endsAt:fields.startsAt}),/after the start/);
  assert.throws(()=>validateMeeting({...fields,topics:['unknown']}),/supported meeting tag/);
  assert.deepEqual(validateMeeting({...fields,topics:['panel','technical','panel']}).topics,['panel','technical']);
  const at=Date.parse(fields.startsAt);assert.equal(meetingIsPast(fields,at-1),false);assert.equal(meetingIsPast(fields,at+1),false);assert.equal(meetingIsPast(fields,Date.parse(fields.endsAt)),true);
});

test('version two upgrade preserves edited dates, chat notes and deletions',async()=>{
  const rows=createMeetingSamples(new Date('2026-01-01T12:00:00Z')).slice(1).map(({conversationMessages,applicationId,...row})=>{
    if(row.meeting){delete row.meeting.endsAt;row.meeting.chatHistory='My saved conversation';}return row;
  });
  const local=memoryStorage({[MEETING_SAMPLES_KEY]:rows,[MEETING_SAMPLES_VERSION_KEY]:2});
  const upgraded=await loadMeetingSamples({sampleData:{enabled:true},storage:{local}});assert.equal(upgraded.length,35);
  assert.equal(upgraded.some(row=>row.id==='mock-meeting:northstar'),false);
  assert.equal(upgraded[0].meeting.startsAt,rows[0].meeting.startsAt);
  assert.equal(Date.parse(upgraded[0].meeting.endsAt)-Date.parse(upgraded[0].meeting.startsAt),30*60000);
  assert.equal(upgraded[0].meeting.chatHistory,'My saved conversation');
  assert.equal((await loadMeetingSamples({sampleData:{enabled:true},storage:{local}})).length,35);
  const empty=memoryStorage({[MEETING_SAMPLES_KEY]:[],[MEETING_SAMPLES_VERSION_KEY]:2});
  assert.deepEqual(await loadMeetingSamples({sampleData:{enabled:true},storage:{local:empty}}),[]);
});

test('interview history is chronological, application-scoped and excludes future meetings and outcomes',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),rows=createMeetingSamples(now),selected=rows.find(row=>row.id==='mock-meeting:orbit-round-6');
  const history=previousMeetings(selected,rows,now);
  assert.deepEqual(history.map(row=>row.meeting.round),[null,1,2,3,4,5]);
  assert.deepEqual(previousMeetings(rows[0],rows,now),[]);
  assert.deepEqual(previousMeetings(rows.find(row=>row.id==='mock-meeting:orbit'),rows,now).map(row=>row.status),['screen']);
  const foreign={...history[0],id:'another-application',applicationId:'different'};
  const screening={...history[0],id:'same-app-screening',status:'screen',meeting:{...history[0].meeting,startsAt:'2026-10-01T10:00:00Z',endsAt:'2026-10-01T10:30:00Z'}};
  assert.equal(previousMeetings(selected,[...rows,foreign,screening,{...screening,id:'outcome',status:'offer',meeting:undefined}],now)[0].id,screening.id);
  const chat=applicationConversation(selected,[...rows,foreign]);
  assert.equal(chat.messages.filter(message=>message.id.endsWith(':first-contact')).length,1);
  assert.ok(chat.messages.some(message=>message.id==='mock-meeting:orbit:followup'));
  assert.ok(!chat.messages.some(message=>message.id.includes('cedar')));
  assert.ok(chat.messages.every((message,i)=>i===0||Date.parse(message.sentAt)<=Date.parse(chat.messages[i-1].sentAt)));
});

test('rescheduling retains each original appointment and reason without replacing transcripts or inventing legacy times',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),original=createMeetingSamples(now).find(row=>row.id==='mock-meeting:northstar'),before=structuredClone(original);
  original.meeting.transcript='Saved transcript text';
  const fields={startsAt:'2026-11-13T18:00:00Z',endsAt:'2026-11-13T18:30:00Z',rescheduleReason:'The interviewer is unavailable.'};
  assert.throws(()=>meetingRecordUpdate(original,{meeting:{...fields,rescheduleReason:''}},now),/rescheduled reason/);
  const moved=meetingRecordUpdate(original,{meeting:fields},now),events=previousMeetingHistory(moved,[moved],now);
  assert.equal(events.length,1);assert.equal(events[0].eventType,'rescheduled');assert.equal(events[0].meeting.startsAt,before.meeting.startsAt);assert.equal(events[0].meeting.lifecycle,'cancelled');
  assert.equal(events[0].meeting.transcript,'Rescheduled reason\n\nThe interviewer is unavailable.');assert.equal(moved.meeting.transcript,'Saved transcript text');
  assert.equal(moved.meeting.scheduleHistory[0].previous.transcript,'Saved transcript text');
  const edited=meetingRecordUpdate(moved,{meeting:{interviewer:'Updated interviewer'}},now);assert.deepEqual(edited.meeting.scheduleHistory,moved.meeting.scheduleHistory);
  const normalized=meetingRecordUpdate(moved,{meeting:{startsAt:new Date(moved.meeting.startsAt).toISOString(),endsAt:'2026-11-13T13:30:00-05:00'}},now);assert.deepEqual(normalized.meeting.scheduleHistory,moved.meeting.scheduleHistory,'Equivalent timestamps do not create reschedules or require a reason');
  const second=meetingRecordUpdate(edited,{meeting:{...fields,startsAt:'2026-11-15T18:00:00Z',endsAt:'2026-11-15T18:30:00Z',rescheduleReason:'Candidate requested another date.'}},now);
  const repeated=previousMeetingHistory(second,[second],now);assert.equal(repeated.length,2);assert.equal(repeated[0].id,events[0].id);assert.equal(repeated[1].meeting.startsAt,moved.meeting.startsAt);assert.match(repeated[1].meeting.transcript,/Candidate requested/);
  assert.deepEqual(previousMeetings(second,[second],now),[],'Rescheduled slots are not completed screenings');
  const legacy={...original,isMock:false,meeting:{...original.meeting,rescheduled:true}};
  const unknown=previousMeetingHistory(legacy,[legacy],now)[0];assert.equal(unknown.meeting.startsAt,'');assert.equal(unknown.meeting.endsAt,'');assert.match(unknown.meeting.transcript,/No reason recorded/);
});

test('Previous meetings combines screening and interview history with every rescheduled slot once',()=>{
  const now=new Date('2026-11-10T16:00:00Z');
  const appointment=(id,status,day,round=null)=>({id,applicationId:'application-a',companyName:'Example',jobTitle:'Engineer',status,meeting:{kind:status,round,startsAt:`2026-11-${day}T10:00:00Z`,endsAt:`2026-11-${day}T11:00:00Z`,result:'passed',transcript:`Transcript for ${id}`}});
  const reschedule=(row,day)=>({...row,meeting:{...row.meeting,rescheduled:true,scheduleHistory:[{id:`${row.id}:move`,changedAt:'2026-10-31T10:00:00Z',reason:`Reason for ${row.id}`,previous:{...row.meeting,startsAt:`2026-11-${day}T10:00:00Z`,endsAt:`2026-11-${day}T11:00:00Z`}}]}});
  const screening=reschedule(appointment('screening','screen','03'),'02'),secondScreen=appointment('second-screen','screen','04');
  const roundOne=reschedule(appointment('round-one','interview','06',1),'05'),current=reschedule(appointment('round-two','interview','12',2),'11');
  current.meetingHistory=[screening,roundOne];
  const foreign={...screening,id:'foreign',applicationId:'application-b'},later=reschedule(appointment('later','interview','20',3),'19');
  const records=[screening,secondScreen,roundOne,current,foreign,later];
  assert.ok(hasPreviousMeetings(secondScreen),'Screenings always expose Previous meetings');
  assert.deepEqual(previousMeetingHistory(secondScreen,records,now).map(previousMeetingLabel),['Screening · Rescheduled','Screening']);
  const history=previousMeetingHistory(current,records,now);
  assert.deepEqual(history.map(previousMeetingLabel),['Screening · Rescheduled','Screening','Screening','Round 1 · Rescheduled','Round 1','Round 2 · Rescheduled']);
  assert.equal(new Set(history.map(row=>row.id)).size,history.length);
  assert.ok(history.every(row=>row.applicationId==='application-a'));
  assert.equal(history.filter(row=>row.eventType==='rescheduled').length,3);
  assert.equal(history.find(row=>row.id===screening.id).meeting.transcript,'Transcript for screening');
  assert.equal(history.at(-1).meeting.transcript,'Rescheduled reason\n\nReason for round-two','A superseded future slot remains in history');
  const failed={...current,status:'archived',meeting:{...current.meeting,startsAt:'2026-11-09T10:00:00Z',endsAt:'2026-11-09T11:00:00Z',result:'failed'}};
  assert.equal(previousMeetingHistory(failed,[screening,roundOne,failed],now).filter(row=>row.eventType==='rescheduled').length,3,'Outcome and last-meeting projections must not duplicate reschedules');
  assert.equal(hasPreviousMeetings({...failed,status:'rejected'}),false);
  assert.deepEqual(previousMeetingHistory({...failed,status:'rejected'},records,now),[]);
});

test('meeting ranges use 24-hour times and initial focus selects ongoing, then next, then latest past',()=>{
  const row=(id,start,end,status='interview')=>({id,status,meeting:{startsAt:`2026-11-10T${start}:00Z`,endsAt:`2026-11-10T${end}:00Z`}});
  const rows=[row('past','08:00','09:00'),row('ongoing','10:00','11:00'),row('next','12:00','13:00'),row('later','15:00','16:00'),row('offer','10:30','11:30','offer')];
  assert.equal(initialMeetingFocus(rows,Date.parse('2026-11-10T10:30Z')),'ongoing');
  assert.equal(initialMeetingFocus(rows,Date.parse('2026-11-10T11:30Z')),'next');
  assert.equal(initialMeetingFocus(rows,Date.parse('2026-11-10T17:00Z')),'later');
  assert.equal(initialMeetingFocus([]),null);
  assert.equal(meetingRange(rows[3].meeting,'UTC').time,'15:00–16:00');
  assert.equal(meetingRange({...rows[3].meeting,endsAt:undefined},'UTC').time,'15:00–?');
});

test('meeting results distinguish scheduled, awaiting a decision and confirmed outcomes',()=>{
  const now=Date.parse('2026-11-10T12:00:00Z');
  const meeting={startsAt:'2026-11-10T13:00:00Z',endsAt:'2026-11-10T14:00:00Z'};
  assert.equal(meetingStatus(meeting,now),'upcoming');
  assert.equal(meetingStatus(meeting,now+7200000),'pending');
  assert.equal(meetingStatus({...meeting,result:'passed'},now+7200000),'passed');
  assert.equal(meetingStatus({...meeting,result:'failed'},now+7200000),'failed');
  assert.throws(()=>validateMeeting({...meeting,startsAt:new Date(Date.now()+86400000).toISOString(),endsAt:new Date(Date.now()+90000000).toISOString(),result:'failed',mode:'video',round:1,joinUrl:'https://example.test/call'}),/after the meeting has ended/);
});

test('all mock interview histories start with one completed screening, including Round 1 and outcomes',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),rows=createMeetingSamples(now);
  for(const row of rows.filter(row=>row.status==='interview'||row.meetingHistory?.length)){
    const history=previousMeetings(row,rows,now);
    assert.equal(history[0]?.status,'screen',row.id);
    assert.equal(history.filter(entry=>entry.status==='screen').length,1,row.id);
    assert.equal(history[0].meeting.result,'passed');assert.equal(history[0].meeting.round,null);
    if(row.meeting)assert.ok(Date.parse(history[0].meeting.endsAt)<Date.parse(row.meeting.startsAt));
  }
});

test('screening progresses only after passing and keeps its transcript and chat while starting a fresh interview',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),screen=createMeetingSamples(now).find(row=>row.id==='mock-meeting:harbor');
  assert.throws(()=>meetingRecordUpdate(screen,{status:'interview'},now),/mark it Passed/);
  const passed=meetingRecordUpdate(screen,{meeting:{...screen.meeting,result:'passed',chatHistory:'My original screening conversation'}},now);
  const interview=meetingRecordUpdate(passed,{status:'interview'},now);
  assert.equal(interview.status,'interview');assert.equal(interview.meeting.kind,'interview');assert.equal(interview.meeting.round,1);
  assert.equal(interview.meeting.startsAt,'');assert.equal(interview.meeting.joinUrl,'');assert.equal(interview.meeting.transcript,'');
  assert.equal(interview.meetingHistory[0].meeting.startsAt,screen.meeting.startsAt);
  assert.equal(interview.meetingHistory[0].meeting.transcript,screen.meeting.transcript);
  assert.deepEqual(previousMeetings(interview,[interview],now).map(row=>row.status),['screen']);
  assert.equal(applicationConversation(interview,[interview]).fragments[0].text,'My original screening conversation');
  const scheduled={...interview,meeting:{...interview.meeting,startsAt:'2026-11-11T15:00:00Z',endsAt:'2026-11-11T16:00:00Z'}};
  assert.deepEqual(previousMeetings(scheduled,[scheduled],now).map(row=>row.status),['screen']);
  const restored=projectMeetingRecords([screen],{[screen.id]:{...scheduled.meeting,history:interview.meetingHistory}})[0];
  assert.equal(restored.status,'interview');assert.deepEqual(previousMeetings(restored,[restored],now).map(row=>row.status),['screen']);
});

test('screening migration respects edited dates, saved history, deletions and live applications',async()=>{
  const rows=createMeetingSamples(new Date('2026-01-01T12:00:00Z')).filter(row=>row.id!=='mock-meeting:willow-first').map(row=>({...row,meetingHistory:row.meetingHistory?.filter(entry=>entry.status!=='screen')}));
  const orbit=rows.find(row=>row.id==='mock-meeting:orbit');orbit.meeting.startsAt='2025-11-01T10:00:00Z';orbit.meeting.endsAt='2025-11-01T11:00:00Z';orbit.meeting.transcript='Edited transcript';
  const local=memoryStorage({[MEETING_SAMPLES_KEY]:rows,[MEETING_SAMPLES_VERSION_KEY]:4,appliedList:[{id:'live',status:'interview'}]});
  const upgraded=await loadMeetingSamples({sampleData:{enabled:true},storage:{local}}),current=upgraded.find(row=>row.id===orbit.id),history=previousMeetings(current,upgraded,new Date('2026-01-02'));
  assert.equal(upgraded.length,35);assert.equal(current.meeting.transcript,'Edited transcript');assert.equal(current.meeting.startsAt,orbit.meeting.startsAt);
  assert.equal(history.length,1);assert.equal(history[0].status,'screen');assert.ok(Date.parse(history[0].meeting.endsAt)<Date.parse(orbit.meeting.startsAt));
  assert.deepEqual(await loadMeetingSamples({sampleData:{enabled:true},storage:{local}}),upgraded);
  assert.deepEqual((await local.get('appliedList')).appliedList,[{id:'live',status:'interview'}]);
});

test('failing an interview moves one application to Failed and preserves all its rounds and messages',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),records=createMeetingSamples(now),current=records.find(row=>row.id==='mock-meeting:orbit-round-5');
  const failed=meetingRecordUpdate(current,{meeting:{...current.meeting,result:'failed'}},now);
  assert.equal(failed.status,'archived');assert.equal(failed.meeting.kind,'interview');assert.equal(failed.updatedAt,now.toISOString());
  const saved=records.map(row=>row.id===failed.id?failed:row),board=projectMeetingRecords(saved);
  assert.deepEqual(board.filter(row=>row.applicationId===failed.applicationId).map(row=>row.id),[failed.id]);
  const history=previousMeetings(failed,saved,now);
  assert.deepEqual(history.map(row=>row.meeting.round),[null,1,2,3,4,5]);assert.equal(history.at(-1).meeting.result,'failed');assert.ok(history.at(-1).meeting.transcript);
  assert.deepEqual(applicationConversation(failed,saved),applicationConversation(current,records));
  const moved=meetingRecordUpdate(records[0],{status:'offer'},now);
  assert.equal(recordUpdatedAt(moved),now.toISOString());
  assert.throws(()=>meetingRecordUpdate(records[0],{status:'archived'},now),/after it has ended/);
  const live={...current,id:'live-interview',isMock:false};
  const projected=projectMeetingRecords([live],{[live.id]:failed.meeting})[0];
  assert.equal(projected.status,'archived');assert.equal(projected.updatedAt,now.toISOString());
});

test('recent samples mix early rounds and outcome records retain dated interview histories',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),rows=createMeetingSamples(now);
  const recent=rows.filter(row=>row.status==='interview'&&Math.abs(Date.parse(row.meeting.startsAt)-Number(now))<3*86400000);
  assert.ok(new Set(recent.map(row=>row.companyName)).size>=6);
  for(const round of [1,2,3])assert.ok(recent.some(row=>row.meeting.round===round));
  for(const record of rows.filter(isApplicationRecord)){
    assert.ok(Number.isFinite(Date.parse(record.updatedAt)));assert.ok(Date.parse(record.updatedAt)<=Number(now));
    if(record.status==='archived'){
      const history=previousMeetings(record,rows,now);assert.ok(history.length>=2);assert.equal(history.at(-1).meeting.result,'failed');
    }
  }
});

test('meeting timezone conversion preserves instants and handles daylight saving transitions',()=>{
  const instant='2026-11-10T15:30:00.000Z';
  assert.equal(localMeetingTime(instant,'America/New_York'),'2026-11-10T10:30');
  assert.equal(localMeetingTime(instant,'Asia/Kolkata'),'2026-11-10T21:00');
  assert.equal(meetingTimeToISO('2026-11-10T21:00','Asia/Kolkata'),instant);
  assert.equal(meetingTimeToISO('2026-11-10T10:30','America/New_York'),instant);
  assert.throws(()=>meetingTimeToISO('2026-03-08T02:30','America/New_York'),/does not exist/);
  assert.throws(()=>meetingTimeToISO('2026-02-30T10:30','UTC'),/valid meeting date/);
  const secondOccurrence='2026-11-01T06:30:00.000Z';
  assert.equal(meetingTimeToISO('2026-11-01T01:30','America/New_York',secondOccurrence),secondOccurrence);
  assert.equal(resolveMeetingTimezone('UTC'),'UTC');
  assert.match(meetingTimezoneLabel('America/New_York',Date.parse('2026-11-10T15:30Z')),/GMT-5/);
  assert.match(meetingTimezoneLabel('America/New_York',Date.parse('2026-07-10T15:30Z')),/GMT-4/);
  assert.match(meetingTimezoneLabel('Asia/Kolkata',Date.parse(instant)),/GMT\+5:30/);
  assert.equal(meetingClockTime(instant,'America/New_York'),'10:30:00');
  assert.equal(meetingClockTime(instant,'Asia/Tokyo'),'00:30:00');
  assert.ok(meetingTimezones('Asia/Kolkata').includes('Asia/Kolkata'));
});

test('live meeting clock follows wall time, pauses when hidden and resyncs on return',context=>{
  let now=1500,nextId=0;const timers=new Map(),ticks=[];
  context.mock.method(Date,'now',()=>now);
  const win=new EventTarget();win.document=new EventTarget();win.document.visibilityState='visible';
  win.setTimeout=(callback,delay)=>{const id=++nextId;timers.set(id,{callback,delay});return id;};
  win.clearTimeout=id=>timers.delete(id);
  const stop=watchMeetingClock(value=>ticks.push(value),{window:win});
  assert.deepEqual(ticks,[1500]);assert.equal([...timers.values()][0].delay,500);
  now=3280;[...timers.values()][0].callback();assert.equal(ticks.at(-1),3280);assert.equal([...timers.values()][0].delay,720);
  win.document.visibilityState='hidden';win.document.dispatchEvent(new Event('visibilitychange'));assert.equal(timers.size,0);
  now=180000;win.document.visibilityState='visible';win.document.dispatchEvent(new Event('visibilitychange'));assert.equal(ticks.at(-1),180000);assert.equal(timers.size,1);
  now=180400;win.dispatchEvent(new Event('focus'));assert.equal(ticks.at(-1),180400);assert.equal(timers.size,1);
  stop();assert.equal(timers.size,0);const count=ticks.length;win.dispatchEvent(new Event('focus'));assert.equal(ticks.length,count);
});

test('screening video colors are consistent and distinct from swapped offer and archive colors',()=>{
  const screen=meetingColors({id:'one',status:'screen',meeting:{mode:'video'}});
  assert.deepEqual(screen,meetingColors({id:'two',status:'screen',meeting:{mode:'video'}}));
  assert.notEqual(screen.background,meetingColors({status:'archived'}).background);
  assert.notEqual(screen.background,meetingColors({status:'offer'}).background);
  assert.match(meetingColors({status:'offer'}).background,/215/);
  assert.match(meetingColors({status:'archived'}).background,/42/);
});
