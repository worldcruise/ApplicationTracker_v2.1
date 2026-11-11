import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingSamples,loadMeetingSamples,MEETING_SAMPLES_KEY,MEETING_SAMPLES_VERSION_KEY} from '../extension/studio/meeting-samples.js';
import {meetingIsPast,meetingLink,meetingColors,validateMeeting,isApplicationRecord,meetingRange,previousMeetings,applicationConversation,initialMeetingFocus,meetingStatus,meetingRecordUpdate,projectMeetingRecords,recordUpdatedAt} from '../extension/studio/meeting-model.js';
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
    if(meetingIsPast(m,now)){assert.ok(m.transcript);assert.ok(row.conversationMessages.some(message=>message.body.includes('Thanks for joining')));}
    else if(m.mode==='phone')assert.match(m.phone,/555-01/);else assert.ok(meetingLink(m.joinUrl));
  }
  for(const company of ['Orbit Labs','Cedar Health']){
    const rounds=samples.filter(row=>row.companyName===company).sort((a,b)=>a.meeting.round-b.meeting.round);
    assert.deepEqual(rounds.map(row=>row.meeting.round),[1,2,3,4,5,6]);
    const luminance=rounds.map(row=>{const hex=meetingColors(row).background.slice(1);return [0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).reduce((a,b)=>a+b);});
    assert.ok(luminance.every((n,i)=>i===0||n<luminance[i-1]));
  }
});

test('upgrading meetings adds new samples once, preserves edits, and does not recreate deleted cards',async()=>{
  const old=createMeetingSamples().slice(0,10).map(({meeting,isMock,...row})=>row);old[0].jobTitle='My edited role';
  const local=memoryStorage({[MEETING_SAMPLES_KEY]:old,appliedList:[{id:'real'}]}),browser={storage:{local}};
  const first=await loadMeetingSamples(browser);assert.equal(first.length,36);assert.equal(first[0].jobTitle,'My edited role');assert.ok(first[0].meeting);
  assert.equal((await local.get(MEETING_SAMPLES_VERSION_KEY))[MEETING_SAMPLES_VERSION_KEY],4);
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
  const upgraded=await loadMeetingSamples({storage:{local}});assert.equal(upgraded.length,35);
  assert.equal(upgraded.some(row=>row.id==='mock-meeting:northstar'),false);
  assert.equal(upgraded[0].meeting.startsAt,rows[0].meeting.startsAt);
  assert.equal(Date.parse(upgraded[0].meeting.endsAt)-Date.parse(upgraded[0].meeting.startsAt),30*60000);
  assert.equal(upgraded[0].meeting.chatHistory,'My saved conversation');
  assert.equal((await loadMeetingSamples({storage:{local}})).length,35);
  const empty=memoryStorage({[MEETING_SAMPLES_KEY]:[],[MEETING_SAMPLES_VERSION_KEY]:2});
  assert.deepEqual(await loadMeetingSamples({storage:{local:empty}}),[]);
});

test('interview history is chronological, application-scoped and excludes future meetings and outcomes',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),rows=createMeetingSamples(now),selected=rows.find(row=>row.id==='mock-meeting:orbit-round-6');
  const history=previousMeetings(selected,rows,now);
  assert.deepEqual(history.map(row=>row.meeting.round),[1,2,3,4]);
  assert.deepEqual(previousMeetings(rows[0],rows,now),[]);
  assert.deepEqual(previousMeetings(rows.find(row=>row.id==='mock-meeting:orbit'),rows,now),[]);
  const foreign={...history[0],id:'another-application',applicationId:'different'};
  const screening={...history[0],id:'same-app-screening',status:'screen',meeting:{...history[0].meeting,startsAt:'2026-10-01T10:00:00Z',endsAt:'2026-10-01T10:30:00Z'}};
  assert.equal(previousMeetings(selected,[...rows,foreign,screening,{...screening,id:'outcome',status:'offer',meeting:undefined}],now)[0].id,screening.id);
  const chat=applicationConversation(selected,[...rows,foreign]);
  assert.equal(chat.messages.filter(message=>message.id.endsWith(':first-contact')).length,1);
  assert.ok(chat.messages.some(message=>message.id==='mock-meeting:orbit:followup'));
  assert.ok(!chat.messages.some(message=>message.id.includes('cedar')));
  assert.ok(chat.messages.every((message,i)=>i===0||Date.parse(message.sentAt)>=Date.parse(chat.messages[i-1].sentAt)));
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

test('failing an interview moves one application to Failed and preserves all its rounds and messages',()=>{
  const now=new Date('2026-11-10T16:00:00Z'),records=createMeetingSamples(now),current=records.find(row=>row.id==='mock-meeting:orbit-round-4');
  const failed=meetingRecordUpdate(current,{meeting:{...current.meeting,result:'failed'}},now);
  assert.equal(failed.status,'archived');assert.equal(failed.meeting.kind,'interview');assert.equal(failed.updatedAt,now.toISOString());
  const saved=records.map(row=>row.id===failed.id?failed:row),board=projectMeetingRecords(saved);
  assert.deepEqual(board.filter(row=>row.applicationId===failed.applicationId).map(row=>row.id),[failed.id]);
  const history=previousMeetings(failed,saved,now);
  assert.deepEqual(history.map(row=>row.meeting.round),[1,2,3,4]);assert.equal(history.at(-1).meeting.result,'failed');assert.ok(history.at(-1).meeting.transcript);
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
