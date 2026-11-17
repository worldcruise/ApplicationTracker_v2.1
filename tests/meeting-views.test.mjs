import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeetingSamples} from './fixtures/meeting-samples.mjs';
import {projectMeetingRecords,meetingRecordUpdate} from '../extension/studio/meeting-model.js';
import {meetingMonthDays,shiftMeetingMonth,meetingsOnDay,meetingEvents,calendarMeetingData,meetingProgressData,validMeetingView,sortMeetingProgress} from '../extension/studio/meeting-views-model.js';
import {calendarPeriodDays,shiftCalendarDate,calendarTimeSegments} from '../extension/studio/meeting-calendar-model.js';

const now=Date.parse('2026-11-10T16:00:00Z');
test('removed web Board and Extension preferences fall back to Calendar',()=>{
  assert.equal(validMeetingView('extension'),'calendar');assert.equal(validMeetingView('board'),'calendar');assert.equal(validMeetingView('progress'),'progress');
});

test('progress sorts whole application rows without changing their history',()=>{
  function row(id,companyName,jobTitle,round,start,end,result){
    const record={id,companyName,jobTitle,status:round?'interview':'screen',meeting:{round,startsAt:`2026-11-10T${start}:00Z`,endsAt:`2026-11-10T${end}:00Z`}};
    return {record,steps:Array.from({length:7},(_,index)=>({label:String(index),event:index===round?record:undefined,result:index===round?result:'empty'}))};
  }
  const a=row('a','Cedar','Zulu',1,'16:30','17:00','upcoming'),b=row('b','alpha','Beta',2,'15:45','16:15','pending'),c=row('c','Willow','Alpha',0,'15:00','15:30','passed'),d=row('d','Bravo','Delta',4,'18:00','19:00','upcoming');
  const rows=[a,b,c,d],snapshot=JSON.stringify(rows),ids=sort=>sortMeetingProgress(rows,sort,now).map(row=>row.record.id);
  assert.deepEqual(ids('latest'),['d','a','b','c']);assert.deepEqual(ids('earliest'),['c','b','a','d']);
  assert.deepEqual(ids('next'),['b','a','d','c']);assert.deepEqual(ids('company'),['b','d','a','c']);
  assert.deepEqual(ids('role'),['c','b','d','a']);assert.deepEqual(ids('stage'),['d','b','a','c']);
  assert.equal(JSON.stringify(rows),snapshot);
});
test('calendar day, week and month navigation preserves local dates across year and month boundaries',()=>{
  assert.deepEqual(calendarPeriodDays('2026-11-10','day'),['2026-11-10']);
  assert.deepEqual(calendarPeriodDays('2027-01-01','week'),['2026-12-27','2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02']);
  assert.equal(shiftCalendarDate('2026-12-31','day',1),'2027-01-01');
  assert.equal(shiftCalendarDate('2026-12-31','week',1),'2027-01-07');
  assert.equal(shiftCalendarDate('2026-01-31','month',1),'2026-02-28');
  assert.equal(shiftCalendarDate('2028-01-31','month',1),'2028-02-29');
  assert.equal(shiftCalendarDate('2026-01-31','month',-1),'2025-12-31');
});

test('hourly calendars lay out overlapping meetings separately and reuse space after a collision group',()=>{
  const event=(id,start,end)=>({id,meeting:{startsAt:`2026-11-10T${start}:00Z`,endsAt:`2026-11-10T${end}:00Z`}});
  const segments=calendarTimeSegments([event('long','09:00','11:00'),event('first','09:15','09:45'),event('second','10:00','10:30'),event('next','11:00','12:00')],'2026-11-10','UTC');
  const byId=Object.fromEntries(segments.map(segment=>[segment.record.id,segment]));
  assert.equal(byId.long.start,540);assert.equal(byId.long.end,660);
  assert.equal(byId.long.columns,2);assert.equal(byId.first.columns,2);assert.equal(byId.second.columns,2);
  assert.notEqual(byId.long.column,byId.first.column);assert.equal(byId.first.column,byId.second.column);
  assert.equal(byId.next.columns,1);assert.equal(byId.next.column,0);
  for(const a of segments)for(const b of segments)if(a!==b&&a.displayStart<b.displayEnd&&b.displayStart<a.displayEnd)assert.notEqual(a.column,b.column);
});

test('hourly segments handle overnight meetings, midnight endings, timezone shifts and clock rollback',()=>{
  const record={id:'overnight',meeting:{startsAt:'2026-11-10T23:30:00Z',endsAt:'2026-11-11T00:30:00Z'}};
  const first=calendarTimeSegments([record],'2026-11-10','UTC')[0],second=calendarTimeSegments([record],'2026-11-11','UTC')[0];
  assert.equal(first.end,1440);assert.equal(first.continuesAfter,true);assert.equal(second.start,0);assert.equal(second.end,30);assert.equal(second.continuesBefore,true);
  const midnight={...record,meeting:{...record.meeting,endsAt:'2026-11-11T00:00:00Z'}};
  assert.equal(calendarTimeSegments([midnight],'2026-11-11','UTC').length,0);
  const tokyo=calendarTimeSegments([record],'2026-11-11','Asia/Tokyo')[0];
  assert.equal(tokyo.start,510);assert.equal(tokyo.end,570);
  const folded={id:'folded',meeting:{startsAt:'2026-11-01T05:45:00Z',endsAt:'2026-11-01T06:15:00Z'}};
  const fold=calendarTimeSegments([folded],'2026-11-01','America/New_York')[0];
  assert.equal(fold.start,105);assert.ok(fold.displayEnd>fold.displayStart);
  const snapshot=JSON.stringify(record);calendarTimeSegments([record],'2026-11-10','America/New_York');assert.equal(JSON.stringify(record),snapshot);
});

test('calendar grids cross month/year boundaries and place events by timezone with exclusive end times',()=>{
  const days=meetingMonthDays('2026-11');
  assert.equal(days.length,42);assert.equal(days[0],'2026-11-01');assert.equal(days.at(-1),'2026-12-12');
  assert.equal(shiftMeetingMonth('2026-12',1),'2027-01');assert.equal(shiftMeetingMonth('2026-01',-1),'2025-12');
  const midnight={id:'midnight',meeting:{startsAt:'2026-11-10T23:30:00Z',endsAt:'2026-11-11T00:00:00Z'}};
  assert.equal(meetingsOnDay([midnight],'2026-11-10','UTC').length,1);
  assert.equal(meetingsOnDay([midnight],'2026-11-11','UTC').length,0);
  assert.equal(meetingsOnDay([midnight],'2026-11-11','Asia/Tokyo').length,1);
  const spanning={...midnight,meeting:{...midnight.meeting,endsAt:'2026-11-11T00:30:00Z'}};
  assert.equal(meetingsOnDay([spanning],'2026-11-11','UTC').length,1);
  const fallBack={id:'dst',meeting:{startsAt:'2026-11-01T05:30:00Z',endsAt:'2026-11-01T06:30:00Z'}};
  assert.equal(meetingsOnDay([fallBack],'2026-11-01','America/New_York').length,1);
  assert.equal(meetingsOnDay([fallBack],'2026-10-31','America/Los_Angeles').length,1);
});

test('calendar includes real history once and never treats application outcomes as appointments',()=>{
  const rows=createMeetingSamples(new Date(now)),events=meetingEvents(rows,now);
  assert.equal(events.filter(row=>row.applicationId==='mock-application:orbit'&&row.status==='screen').length,1);
  assert.equal(new Set(events.map(row=>row.id)).size,events.length);
  assert.ok(events.every(row=>['screen','interview'].includes(row.status)));
  for(const outcome of rows.filter(row=>['offer','archived','rejected'].includes(row.status)))assert.ok(!events.some(row=>row.id===outcome.id));
  const orbit=rows.find(row=>row.id==='mock-meeting:orbit-round-4');
  const failed=meetingRecordUpdate(orbit,{meeting:{...orbit.meeting,result:'failed'}},new Date(now));
  const closed=meetingEvents(rows.map(row=>row.id===failed.id?failed:row),now).filter(row=>row.applicationId===failed.applicationId);
  assert.ok(closed.every(row=>row.historyOnly&&Date.parse(row.meeting.endsAt)<=now));
  assert.ok(closed.some(row=>row.meeting.result==='failed'));
  assert.ok(events.find(row=>row.id==='mock-meeting:orbit').historyOnly===false);
});

test('calendar filters application stages and event dates while keeping full source history',()=>{
  const rows=createMeetingSamples(new Date(now)),current=projectMeetingRecords(rows);
  const data=calendarMeetingData(current,rows,{status:'interview',query:'Orbit',startDate:'2026-10-01',endDate:'2026-11-10'},'UTC',now);
  assert.ok(data.events.some(row=>row.status==='screen'));
  assert.ok(data.events.every(row=>row.companyName==='Orbit Labs'&&row.meeting.startsAt.slice(0,10)<='2026-11-10'));
  assert.deepEqual(calendarMeetingData(current,rows,{query:'No such company'},'UTC',now),{events:[],unscheduled:[]});
  const draft={id:'draft',status:'screen',companyName:'Example',meeting:{startsAt:''}};
  assert.deepEqual(calendarMeetingData([draft],[draft],{},'UTC',now).unscheduled,[draft]);
  assert.equal(calendarMeetingData([draft],[draft],{startDate:'2026-11-01'},'UTC',now).unscheduled.length,0);
});

test('progress counts applications once and exposes screening then six rounds, excluding unscheduled drafts and closed applications',()=>{
  const rows=createMeetingSamples(new Date(now)),data=meetingProgressData(projectMeetingRecords(rows),rows,now);
  assert.equal(data.rows.length,18);
  assert.deepEqual(data.counts,{screen:10,interview:8,rejected:0,archived:0,offer:0});
  const orbit=data.rows.find(row=>row.record.companyName==='Orbit Labs');
  assert.equal(orbit.steps.length,7);assert.equal(orbit.steps[0].event.status,'screen');assert.equal(orbit.steps[0].sessions,1);
  assert.deepEqual(orbit.steps.slice(1).map(step=>step.event.meeting.round),[1,2,3,4,5,6]);
  const draft={id:'draft',status:'interview',meeting:{round:1,startsAt:''}};
  assert.deepEqual(meetingProgressData([draft],[draft],now).rows,[]);
});
