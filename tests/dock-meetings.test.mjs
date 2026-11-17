import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {mountDockDashboard} from '../extension/studio/dock-dashboard-view.js';
import {mountDockMeetings} from '../extension/studio/dock-meetings-view.js';
import {meetingSourceRows,readDockMeetings,meetingsToday} from '../extension/studio/dock-meetings-data.js';
import {createMeetingSamples} from './fixtures/meeting-samples.mjs';
import {initialMeetingFocus} from '../extension/studio/meeting-model.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

async function until(read){for(let i=0;i<150;i++){if(read())return;await delay(10);}throw Error('Dock condition did not resolve.');}
function fixture(t){
  const page=new Window({url:'https://example.test/job'}),host=page.document.createElement('div');page.document.body.append(host);
  const changed=event(),samples=createMeetingSamples(),tabs=[];
  const browser={sampleData:{enabled:true},runtime:{getURL:path=>`chrome-extension://test/${path}`,sendMessage:async()=>({ok:true,result:{candidate:null,candidates:[]}})},windows:{getCurrent:async()=>({id:41})},tabs:{query:async()=>[],create:async input=>{tabs.push(input);return{id:5,...input};}},storage:{local:memoryStorage({appliedList:samples,'meeting-mock-cards:version':6,'meeting-timezone:v1':'UTC',appliedList:samples},changed,'local'),session:memoryStorage(),onChanged:changed}};
  t.after(()=>page.happyDOM.abort());return{page,host,browser,samples,tabs,q:selector=>host.querySelector(selector)};
}

test('dock Meetings action and Today tile open the shared single column, with working details and Back',async t=>{
  const f=fixture(t),dock=mountDockDashboard(f.host,{browser:f.browser});t.after(()=>dock.close());
  f.q('[data-action="Meetings"].rd-action').click();
  assert.equal(f.q('.rd-main').hidden,true,'switch immediately without waiting for a request');
  await until(()=>f.host.querySelectorAll('#dock-meetings .meeting-card').length===28);
  const nowId=initialMeetingFocus((await readDockMeetings(f.browser)).records);
  await until(()=>f.q('#dock-meetings').dataset.initialFocus===nowId);
  assert.equal(f.tabs.length,0);assert.equal(f.q('#dock-meetings').getAttribute('aria-busy'),null);
  assert.equal(f.q('[data-meeting-action="dashboard"]').textContent,'Dashboard');assert.equal(f.q('[data-meeting-action="dashboard"] path').getAttribute('d'),'m15 18-6-6 6-6');
  assert.ok([...f.host.querySelectorAll('#dock-meetings .meeting-card')].every(card=>['screen','interview'].includes(card.dataset.status)));
  assert.equal(f.q('.meeting-card-update'),null,'Meeting cards open Details without an Update button');
  assert.ok([...f.host.querySelectorAll('.meeting-tag')].every(tag=>!['Screening','Interview'].includes(tag.textContent)));
  const labels={passed:'Passed',upcoming:'Upcoming',pending:'Pending',failed:'Failed',needs_action:'Needs action'};
  assert.ok([...f.host.querySelectorAll('.meeting-result')].every(tag=>tag.textContent===labels[tag.dataset.result]));
  const focused=[],alertCount=f.host.querySelectorAll('.meeting-card[data-meeting-alert="true"]').length;
  for(let i=0;i<=alertCount;i++){f.q('#dock-meetings .workflow-attention').click();const card=f.q('[data-attention-focus="true"]');assert.ok(card);focused.push(card.dataset.meetingId);assert.equal(f.host.querySelectorAll('[data-attention-focus="true"]').length,1);assert.equal(f.q('.meeting-workflow'),null);}
  assert.ok(alertCount>=5);assert.equal(new Set(focused.slice(0,alertCount)).size,alertCount);assert.equal(focused[alertCount],focused[0]);
  f.q('[data-meeting-action="now"]').click();await until(()=>f.q('#dock-meetings').dataset.initialFocus===nowId);
  assert.equal(f.q('[data-meeting-action="now"]').getAttribute('aria-label'),'Jump to now');
  f.q('#dock-meetings .meeting-card[data-mode="phone"][data-past="false"] .meeting-card-main').click();
  assert.match(f.q('.meeting-phone-number').textContent,/555/);
  assert.ok([...f.host.querySelectorAll('.meeting-history-tabs button')].some(button=>button.textContent==='Previous meetings'));
  f.q('[data-meeting-action="list"]').click();
  f.q('#dock-meetings .meeting-card[data-meeting-id="mock-meeting:orbit-round-6"] .meeting-card-main').click();
  [...f.host.querySelectorAll('.meeting-history-tabs button')].find(button=>button.textContent==='Previous meetings').click();
  assert.equal(f.q('.meeting-previous-tabs button').textContent,'Screening');
  f.q('.meeting-previous-tabs button').click();assert.match(f.q('.meeting-history').textContent,/Screening result: Passed/);
  [...f.host.querySelectorAll('.meeting-history-tabs button')].find(button=>button.textContent==='Chat history').click();
  assert.match(f.q('.meeting-conversation').textContent,/Thanks for joining/);assert.doesNotMatch(f.q('.meeting-conversation').textContent,/Cedar Health/);
  const stamps=[...f.host.querySelectorAll('.meeting-chat-message time')].map(node=>Date.parse(node.dateTime));assert.ok(stamps.every((stamp,index)=>index===0||stamp<=stamps[index-1]));
  f.q('[data-meeting-action="list"]').click();f.q('[data-meeting-id="mock-meeting:clearwater"] .meeting-card-main').click();
  [...f.host.querySelectorAll('.meeting-history-tabs button')].find(button=>button.textContent==='Previous meetings').click();
  assert.equal(f.q('.meeting-previous-tabs button').textContent,'Screening · Rescheduled');
  assert.equal(f.q('.meeting-history label>span').textContent,'Transcript');assert.equal(f.q('.meeting-history textarea').readOnly,true);assert.match(f.q('.meeting-history textarea').value,/Rescheduled reason\n\nThe interviewer/);
  assert.equal(f.q('.meeting-summary .meeting-result'),null,'A moved slot must not look like an upcoming or passed meeting');
  f.q('[data-meeting-action="dashboard"]').click();assert.equal(f.q('.rd-main').hidden,false);assert.equal(f.q('#dock-meetings').hidden,true);
  f.q('#dock-meetings').dataset.initialFocus='old-position';
  const tile=f.q('button.rd-stat-meetings');assert.ok(tile);tile.click();assert.equal(f.q('#dock-meetings').hidden,false);assert.equal(f.host.querySelectorAll('#dock-meetings .meeting-card').length,28);
  await until(()=>!!f.q('#dock-meetings [data-attention-focus="true"]'));
  assert.equal(f.q('#dock-meetings [data-attention-focus="true"]').dataset.meetingAlert,'true');
  f.q('[data-meeting-action="calendar"]').click();await until(()=>f.tabs.length===1);assert.equal(f.tabs[0].url,'chrome-extension://test/options.html#/meetings');
});

test('meetings load failures never trap navigation, expose Retry, and ignore results after leaving',async t=>{
  const f=fixture(t);let back=0,resolve;
  f.browser.meetings={read:()=>new Promise(done=>{resolve=done;})};
  const api=mountDockMeetings(f.host,{browser:f.browser,onDashboard:()=>back++,requestTimeoutMs:25});t.after(()=>api.close());
  api.show();f.q('[data-meeting-action="dashboard"]').click();assert.equal(back,1);assert.equal(api.root.getAttribute('aria-busy'),null);
  resolve(await readDockMeetings({...f.browser,meetings:undefined}));await delay(10);assert.equal(f.host.querySelectorAll('.meeting-card').length,0,'obsolete read must not reopen or change the hidden view');
  api.show();await until(()=>f.q('.meeting-error').textContent.includes('did not respond'));
  assert.equal(f.q('[data-meeting-action="refresh"]').disabled,false);assert.equal(api.root.getAttribute('aria-busy'),null);
  f.browser.meetings.read=()=>readDockMeetings({...f.browser,meetings:undefined});f.q('[data-meeting-action="refresh"]').click();
  await until(()=>f.host.querySelectorAll('.meeting-card').length===28);
  f.q('[data-meeting-action="dashboard"]').click();assert.equal(back,2);
});

test('dock meetings follow saved web edits, timezone changes and application outcomes without resetting manual scroll',async t=>{
  const f=fixture(t),api=mountDockMeetings(f.host,{browser:f.browser});t.after(()=>api.close());api.show();
  await until(()=>f.host.querySelectorAll('.meeting-card').length===28);await delay(30);
  const list=f.q('.meeting-extension-list');list.scrollTop=150;
  const samples=structuredClone(f.samples),current=samples.find(row=>row.id==='mock-meeting:northstar');current.jobTitle='Edited from calendar';
  await f.browser.storage.local.set({appliedList:samples,'meeting-timezone:v1':'Asia/Tokyo'});
  await until(()=>f.q('.dock-meetings-zone').textContent.includes('Asia/Tokyo'));
  assert.match(f.q('[data-meeting-id="mock-meeting:northstar"]').textContent,/Edited from calendar/);assert.equal(f.q('.meeting-extension-list').scrollTop,150);
  current.status='offer';await f.browser.storage.local.set({appliedList:samples});await until(()=>!f.q('[data-meeting-id="mock-meeting:northstar"]'));
  assert.equal(f.tabs.length,0);
});

test('dock resolves legacy web meeting IDs and details and counts the selected timezone day',async t=>{
  const f=fixture(t),record={companyName:'Real company',jobTitle:'Real role',jobLink:'https://example.test/real',date:'2026-11-10',status:'screen',profileName:'Default'},id=meetingSourceRows([record])[0].id;
  assert.equal(id,'local:0:'+encodeURIComponent([record.jobTitle,record.jobLink,record.companyLink,record.date,record.profileName].join('\0')));
  await f.browser.storage.local.set({appliedList:[record],'meeting-details:v1':{[id]:{startsAt:'2026-11-11T00:30:00Z',endsAt:'2026-11-11T01:00:00Z',mode:'phone'}},'meeting-timezone:v1':'America/New_York'});
  const state=await readDockMeetings(f.browser),real=state.records.find(row=>row.id===id);assert.equal(real.meeting.startsAt,'2026-11-11T00:30:00Z');
  assert.equal(meetingsToday({...state,records:[real]},Date.parse('2026-11-10T12:00:00Z')),1);
});

test('reopening Meetings restores its detail tab and explicit navigation still jumps to the current list',async t=>{
  const f=fixture(t);let api=mountDockMeetings(f.host,{browser:f.browser});t.after(()=>api.close());await api.show();
  f.q('[data-meeting-id="mock-meeting:orbit-round-6"] .meeting-card-main').click();
  [...f.host.querySelectorAll('.meeting-history-tabs button')].find(button=>button.textContent==='Chat history').click();api.close();await delay(10);
  api=mountDockMeetings(f.host,{browser:f.browser});await api.show({restore:true});
  assert.equal(f.q('.dock-meeting-details').dataset.meetingId,'mock-meeting:orbit-round-6');assert.equal(f.q('.meeting-history-tabs [aria-pressed="true"]').textContent,'Chat history');assert.ok(f.q('.meeting-conversation'));
  await api.show();assert.equal(f.q('.dock-meeting-details'),null);assert.ok(f.q('.meeting-extension-list'));
});
