import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {setTimeout as delay} from 'node:timers/promises';
import {createMeetingSamples,MEETING_SAMPLES_KEY,MEETING_SAMPLES_VERSION_KEY} from './fixtures/meeting-samples.mjs';
import {attentionMeetings,applyMeetingWorkflow,workflowMode,workflowVersion} from '../extension/studio/meeting-workflow-model.js';
import {meetingStatus,previousMeetingHistory,applicationConversation} from '../extension/studio/meeting-model.js';
import {createMockWorkflowService} from './fixtures/mock-workflow.mjs';
import {openMeetingWorkflow} from '../extension/studio/meeting-workflow-view.js';
import {memoryStorage,event} from './helpers/dock-records-fixture.mjs';

const now=Date.parse('2026-11-11T20:00:00Z');
const complete={transcript:'Interviewer: Tell me about your work.\nCandidate: We discussed the role.',email:{from:'candidate@example.test',to:'recruiter@example.test',subject:'Thank you',sentAt:'2026-11-11T19:00:00Z',body:'Thank you for the conversation.',confirmedAlreadySent:true}};
test('five mock tasks complete to Pending, share their email, advance once and retain earlier meetings',()=>{
  let rows=createMeetingSamples(new Date(now));assert.equal(attentionMeetings(rows,now).length,5);
  const selected=rows.find(row=>row.id==='mock-meeting:pixel-second');assert.equal(workflowMode(selected,now),'complete');assert.equal(meetingStatus(selected.meeting,now),'needs_action');
  assert.throws(()=>applyMeetingWorkflow(rows,selected.id,'complete',{...complete,email:{...complete.email,confirmedAlreadySent:false}},now),/Confirm/);
  assert.throws(()=>applyMeetingWorkflow(rows,selected.id,'advance',{},now),/Complete/);
  let saved=applyMeetingWorkflow(rows,selected.id,'complete',complete,now,'complete-one');rows=saved.records;
  assert.equal(meetingStatus(saved.updated.meeting,now),'pending');assert.equal(attentionMeetings(rows,now).length,4);
  assert.equal(applicationConversation(saved.updated,rows).messages.filter(message=>message.id==='complete-one:follow-up').length,1);
  const fields={startsAt:'2026-11-15T12:00',endsAt:'2026-11-15T13:00',mode:'video',joinUrl:'https://example.test/interview',timeZone:'UTC',confirmPassed:true};
  saved=applyMeetingWorkflow(rows,selected.id,'advance',fields,now,'advance-one');rows=saved.records;
  assert.equal(saved.created.meeting.round,3);assert.equal(saved.updated.meeting.result,'passed');assert.equal(previousMeetingHistory(saved.created,rows,now).filter(row=>row.id===selected.id).length,1);
  assert.throws(()=>applyMeetingWorkflow(rows,selected.id,'advance',fields,now,'again'),/already exists/);
  const moved=applyMeetingWorkflow(rows,saved.created.id,'reschedule',{...fields,startsAt:'2026-11-16T12:00',endsAt:'2026-11-16T13:00',rescheduleReason:'The panel is unavailable.'},now,'move');
  assert.equal(moved.updated.meeting.scheduleHistory.length,1);assert.equal(moved.updated.meeting.review.completedAt,null);
  assert.equal(previousMeetingHistory(moved.updated,moved.records,now).filter(row=>row.eventType==='rescheduled').length,1);
});

function fixture(){const changed=event(),browser={sampleData:{enabled:true},storage:{local:memoryStorage({[MEETING_SAMPLES_KEY]:createMeetingSamples(),[MEETING_SAMPLES_VERSION_KEY]:8,'meeting-timezone:v1':'UTC',appliedList:[]},changed,'local'),onChanged:changed}};browser.workflow=createMockWorkflowService(browser);return browser;}
test('workflow mutations reject stale edits and retries do not duplicate follow-ups or touch real data',async()=>{
  const browser=fixture(),state=await browser.workflow.read(),record=state.records.find(row=>row.id==='mock-meeting:harbor');
  const payload={recordId:record.id,expectedVersion:workflowVersion(record),mutationId:'workflow-save',action:'complete',fields:{transcript:'Saved transcript',followUpNotRequiredReason:'Recruiter asked to wait for feedback.'}};
  const saved=await browser.workflow.mutate(payload);assert.equal(attentionMeetings(saved.records).length,4);
  await browser.workflow.mutate(payload);
  await assert.rejects(()=>browser.workflow.mutate({...payload,mutationId:'stale'}),/changed/);
  await assert.rejects(()=>browser.workflow.mutate({...payload,fields:{transcript:'Changed'}}),/already used/);
  assert.deepEqual((await browser.storage.local.get('appliedList')).appliedList,[]);
});

test('review UI retains skipped drafts, resolves one task, advances and reuses a single dialog',async t=>{
  const page=new Window(),browser=fixture();t.after(()=>page.happyDOM.abort());
  const q=selector=>page.document.querySelector(selector),click=label=>[...page.document.querySelectorAll('button')].find(button=>button.textContent===label)?.click();
  const until=async check=>{for(let i=0;i<150;i++){if(check())return;await delay(10);}throw Error('Workflow did not settle.');};
  const enter=(name,value)=>{const node=q(`[name="${name}"]`);node.value=value;node.dispatchEvent(new page.Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));};
  const ui=openMeetingWorkflow(page.document.body,{browser,review:true});await until(()=>q('form'));
  const first=q('h2').textContent;enter('transcript','My review draft');click('Skip for now');click('Previous');assert.equal(q('h2').textContent,first);assert.equal(q('[name="transcript"]').value,'My review draft');
  enter('followUpChoice','not_required');enter('followUpNotRequiredReason','The recruiter requested no follow-up.');click('Save & next');
  await until(()=>q('.workflow-progress')?.textContent.includes('4 remaining'));assert.notEqual(q('h2').textContent,first);
  assert.equal(attentionMeetings((await browser.workflow.read()).records).length,4);
  openMeetingWorkflow(page.document.body,{browser,applicationId:'mock-application:pixel-second'});await until(()=>q('form'));
  assert.equal(page.document.querySelectorAll('.meeting-workflow').length,1);ui.close();
});

test('status actions open matching forms without button badges, saving or bypassing completion',async t=>{
  const page=new Window(),browser=fixture();t.after(()=>page.happyDOM.abort());
  const until=async check=>{for(let i=0;i<150;i++){if(check())return;await delay(10);}throw Error('Workflow did not settle.');};
  const initial=await browser.workflow.read(),before=JSON.stringify(initial.records),future=initial.records.find(row=>row.id==='mock-meeting:northstar');
  const ui=openMeetingWorkflow(page.document.body,{browser,recordId:future.id,initialAction:'reschedule'});
  await until(()=>page.document.querySelector('form'));
  assert.equal(page.document.querySelector('.workflow-actions [aria-pressed=true]').getAttribute('aria-label'),'Reschedule');
  assert.equal(page.document.querySelector('button .update-action-badge'),null);
  assert.equal(JSON.stringify((await browser.workflow.read()).records),before);ui.close();
  const needs=attentionMeetings(initial.records)[0],review=openMeetingWorkflow(page.document.body,{browser,recordId:needs.id,initialAction:'advance'});
  await until(()=>page.document.querySelector('form'));
  assert.equal(page.document.querySelector('.workflow-actions [aria-pressed=true]').getAttribute('aria-label'),'Complete meeting');
  assert.equal(page.document.querySelector('[aria-label="Next step"]').disabled,true);
  assert.equal(JSON.stringify((await browser.workflow.read()).records),before);review.close();
});
