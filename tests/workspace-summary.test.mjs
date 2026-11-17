import test from 'node:test';
import assert from 'node:assert/strict';
import {meetingAlerts} from '../extension/studio/meeting-alerts.js';
import {readWorkspaceSummary,summarizeQueue} from '../extension/studio/workspace-summary.js';
import {isNativeDockSender,isWorkspaceRecordsSender} from '../extension/studio/reference-dashboard-access.js';
import {dockFixture} from './helpers/dock-records-fixture.mjs';
import {createMeetingSamples} from './fixtures/meeting-samples.mjs';

test('meeting alarms use the chosen timezone and deduplicate today plus outstanding work',()=>{
  const now=Date.parse('2026-11-12T03:00:00Z'); // Still November 11 in New York.
  const row=(id,start,extra={})=>({id,status:'interview',meeting:{startsAt:start,endsAt:new Date(Date.parse(start)+3600000).toISOString(),...extra}});
  const today=row('today','2026-11-12T01:00:00Z',{review:{required:true}});
  const upcoming=row('upcoming','2026-11-12T04:00:00Z');
  const old=row('older','2026-11-10T19:00:00Z',{review:{required:true}});
  const later=row('tomorrow','2026-11-12T15:00:00Z');
  const complete=row('complete','2026-11-09T19:00:00Z',{review:{required:true,completedAt:'2026-11-09T21:00:00Z',followUpNotRequiredReason:'Recruiter will follow up'},transcript:'Notes'});
  const cancelled=row('cancelled','2026-11-11T18:00:00Z',{lifecycle:'cancelled',review:{required:true}});
  const outcome={...today,id:'offer',status:'offer'};
  const result=meetingAlerts([today,today,old,later,complete,cancelled,outcome,upcoming,upcoming],'America/New_York',now);
  assert.equal(result.today,1);assert.equal(result.needsAction,2);assert.equal(result.total,3);
  assert.deepEqual(result.items.map(row=>row.id),['today','older','upcoming']);
  const utc=meetingAlerts([row('next','2026-11-12T15:00:00Z')],'UTC',now);
  assert.equal(utc.today,1);assert.equal(utc.needsAction,0);
});

test('workspace summary agrees with application and queue service records and refreshes after changes',async t=>{
  const f=await dockFixture(t,{meetingSamples:createMeetingSamples()});
  f.browser.runtime.sendMessage=async message=>({ok:true,requestId:message.requestId,result:await f.request(message.operation,message.payload)});
  const job=await f.create('summary');
  const before=await readWorkspaceSummary(f.browser),state=await f.request('DOCK_RECORDS_STATE');
  assert.equal(before.applications.length,state.applications.length);
  assert.ok(before.applications.length>0);assert.equal(before.queue.total,state.jobs.length);
  assert.equal(before.queue.total,1);assert.equal(before.meetings.records.length,28);
  await f.mutate('delete',job);
  const after=await readWorkspaceSummary(f.browser);assert.equal(after.queue.total,0);
  assert.equal(after.applications.length,before.applications.length);
  assert.deepEqual(summarizeQueue([{status:'Ready'},{status:'Generating'},{status:'Failed'},{status:'Queued'}]),{total:4,ready:1,generating:1,failed:1,jobs:[{status:'Ready'},{status:'Generating'},{status:'Failed'},{status:'Queued'}]});
});

test('the shared records service accepts trusted web pages and rejects external pages and child frames',()=>{
  const browser={runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`}};
  const sender={id:'test',frameId:0,url:'chrome-extension://test/options.html#/?tab=queue'};
  assert.equal(isWorkspaceRecordsSender(sender,browser),true);
  assert.equal(isNativeDockSender(sender,browser),false);
  assert.equal(isNativeDockSender({...sender,url:'chrome-extension://test/sidepanel.html'},browser),true);
  assert.equal(isNativeDockSender({...sender,frameId:1},browser),false);
  assert.equal(isNativeDockSender({...sender,url:'https://example.com/options.html'},browser),false);
  assert.equal(isNativeDockSender({...sender,id:'another-extension'},browser),false);
  assert.equal(isWorkspaceRecordsSender({...sender,frameId:1},browser),false);
  assert.equal(isWorkspaceRecordsSender({...sender,url:'https://example.com/options.html'},browser),false);
  assert.equal(isWorkspaceRecordsSender({...sender,id:'another-extension'},browser),false);
});
