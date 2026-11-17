import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {parseResumeFile} from '../extension/studio/resume-parser-service.js';
import {parseResumeUpload} from '../extension/studio/resume-import-client.js';
import {createMeetingWorkflowService,readMeetingWorkflow} from '../extension/studio/meeting-workflow-service.js';
import {workflowVersion} from '../extension/studio/meeting-workflow-model.js';
import {readDockMeetings,MEETING_EVENTS_KEY} from '../extension/studio/dock-meetings-data.js';
import {event,memoryStorage,dockFixture} from './helpers/dock-records-fixture.mjs';
import {initializeLocalApp} from '../extension/studio/initialize-local-app.js';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {createQuestionAnswerChat} from '../extension/studio/question-answer-chat.js';

test('runtime entries have no old injected application, account SDK, popup, or in-page dock',async()=>{
  const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));
  assert.equal(manifest.action.default_popup,undefined);assert.equal(manifest.author,undefined);assert.equal(manifest.homepage_url,undefined);
  assert.ok(!manifest.permissions.includes('cookies'));assert.ok(!manifest.permissions.includes('contextMenus'));
  assert.ok(manifest.content_scripts.every(entry=>!entry.js.some(file=>/content-scripts\/(content|inline-dock)\.js/.test(file))));
  const worker=await readFile('extension/service-worker.js','utf8'),options=await readFile('extension/options.html','utf8');
  assert.doesNotMatch(worker,/from ["']\.\/background\.js/);assert.doesNotMatch(options,/chunks\//);
  assert.match(options,/web-app\.js/);
  for(const file of ['background.js','content-scripts/content.js','content-scripts/inline-dock.js','popup.html','chunks/options-DnVa9wE8.js'])await assert.rejects(access('extension/'+file));
});

test('installation initializes local defaults without replacing profiles or existing application data',async()=>{
  const changed=event(),installed=event(),profile={nameData:{firstName:'Keep'}},existing={id:'saved'},local=memoryStorage({profile,appliedList:[existing],dailyGoal:20},changed,'local'),urls=[];
  const app=initializeLocalApp({storage:{local},runtime:{onInstalled:installed,setUninstallURL:async value=>urls.push(value)}});
  await app.initialize();assert.deepEqual((await local.get(null)).profile,profile);assert.deepEqual((await local.get(null)).appliedList,[existing]);assert.equal((await local.get(null)).dailyGoal,20);assert.deepEqual(urls,['']);
  const empty=memoryStorage({},changed,'local');await initializeLocalApp({storage:{local:empty},runtime:{onInstalled:installed}}).initialize();assert.deepEqual(await empty.get(null),{appliedList:[],dailyGoal:10});
});

test('resume uploads call only the required parser endpoint without an account client',async()=>{
  const profile={nameData:{firstName:'Taylor'},jobData:[],educationData:[],skillsData:['SQL']},requests=[];
  const parse=input=>parseResumeFile(input,{browser:{runtime:{getManifest:()=>({version:'2.1.24'})}},fetch:async(url,options)=>{requests.push({url,options});return {ok:true,json:async()=>profile};}});
  const input={fileName:'resume.pdf',base64:btoa('%PDF-1.7 synthetic resume')};
  assert.deepEqual(await parseResumeUpload(input,{parse}),profile);assert.equal(requests.length,1);
  assert.equal(requests[0].url,'https://www.speedyapply.com/api/ext/resume');assert.equal(requests[0].options.method,'POST');
  assert.equal(requests[0].options.headers.Authorization,undefined);
  const file=requests[0].options.body.get('resume');assert.equal(file.name,input.fileName);assert.equal(await file.text(),'%PDF-1.7 synthetic resume');
  const docx=await parse({fileName:'resume.docx',base64:btoa('PK synthetic docx')});assert.deepEqual(docx,profile);
  assert.equal(requests[1].options.body.get('resume').type,'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('parser errors are explicit and never fall back to the retired local extraction rules',async()=>{
  const input={fileName:'resume.pdf',base64:btoa('%PDF-1.7 resume')},browser={runtime:{getManifest:()=>({version:'test'})}};
  await assert.rejects(parseResumeFile(input,{browser,fetch:async()=>({ok:false,status:503,statusText:'Unavailable'})}),/503/);
  await assert.rejects(parseResumeFile(input,{browser,fetch:async()=>({ok:true,json:async()=>[]})}),/invalid profile/);
});

test('retired copy modes pause safely without polling the clipboard or resending prompts',async t=>{
  const events=event(),state={runs:[{id:'run',jobId:'job',provider:'chatgpt',kind:'documents',phase:'submitted',manualPrompt:true,manualAnswer:true,sendIntentAt:1,url:'https://chatgpt.com/c/saved',prompt:'Saved prompt',job:{id:'job'}}]};let clipboardReads=0,sends=0;
  const store={read:async()=>structuredClone(state),change:async update=>({value:update(state)})};
  const browser={runtime:{sendMessage:async()=>({})},tabs:{onUpdated:events,onRemoved:events,sendMessage:async()=>{sends++;}},storage:{session:memoryStorage({})}};
  const service=createGenerationService({browser,store,clipboard:async()=>{clipboardReads++;return 'Unrelated clipboard text';}});t.after(()=>service.dispose());
  await service.reconnect();const runs=await service.list();
  assert.equal(clipboardReads,0);assert.equal(sends,0);assert.equal(runs[0].phase,'attention');assert.equal(runs[0].code,'retired-copy-mode');assert.equal(runs[0].manualAnswer,undefined);
  assert.equal(state.runs[0].url,'https://chatgpt.com/c/saved');assert.equal(state.runs[0].prompt,'Saved prompt');assert.equal(state.runs[0].sendIntentAt,1);
});

test('Autofill retrieves current ChatGPT answers through its temporary local conversation URL',async()=>{
  let url='https://chatgpt.com/';const browser={storage:{local:memoryStorage({}),session:memoryStorage({})},tabs:{query:async()=>[],create:async value=>({id:7,...value}),get:async()=>({id:7,url})},scripting:{executeScript:async request=>request.files?[]:[{result:request.func.name==='sendQuestionBatch'?{ready:true}:{complete:true,raw:'{"question":"Why this role?","answer":"I build reliable systems."}'}}]}};
  const service=createQuestionAnswerChat(browser),run=await service.start({id:'job',input:{job:{company:'Example',role:'Engineer'}}},[{key:'why',label:'Why this role?'}],41);
  url='https://chatgpt.com/c/local-chatgpt%3A8d569e85-9fa3-4653-973f-4575c4496461';
  const reply=await service.status(run.id,41,'job');assert.equal(reply.phase,'complete');assert.equal(reply.answers[0].answer,'I build reliable systems.');
});

function workflow(){
  const changed=event(),raw={id:'application',jobTitle:'Engineer',companyName:'Example',jobLink:'https://employer.test/job',status:'applied',date:new Date().toString(),createdAt:new Date().toISOString()};
  const browser={storage:{onChanged:changed,local:memoryStorage({appliedList:[raw],'meeting-timezone:v1':'UTC'},changed,'local')}};
  return {browser,service:createMeetingWorkflowService(browser),raw};
}
const schedule=offset=>({startsAt:new Date(Date.now()+offset).toISOString(),endsAt:new Date(Date.now()+offset+1800000).toISOString(),timeZone:'UTC',mode:'phone',phone:'+12025550123',interviewer:'Recruiter'});
test('real applications advance to screening, reschedule, and reject stale or duplicate updates safely',async()=>{
  const f=workflow(),initial=await f.service.read(),record=initial.records[0];
  const request={recordId:record.id,expectedVersion:workflowVersion(record),action:'advance',fields:schedule(86400000),mutationId:'screen'};
  const first=await f.service.mutate(request);assert.equal(first.records[0].status,'screen');assert.equal(first.records[0].meeting.kind,'screen');assert.equal(first.records[0].isMock,undefined);
  assert.equal((await f.browser.storage.local.get('appliedList')).appliedList[0].status,'screen');
  await f.service.mutate(request);assert.equal((await f.browser.storage.local.get(MEETING_EVENTS_KEY))[MEETING_EVENTS_KEY].length,1);
  await assert.rejects(f.service.mutate({...request,mutationId:'stale'}),/no longer available|changed/);
  const current=first.records[0],next=await f.service.mutate({recordId:current.id,expectedVersion:workflowVersion(current),action:'reschedule',fields:{...schedule(172800000),rescheduleReason:'Recruiter unavailable'},mutationId:'reschedule'});
  assert.equal(next.records[0].meeting.scheduleHistory.length,1);assert.equal(next.records[0].meeting.scheduleHistory[0].reason,'Recruiter unavailable');
  assert.equal((await readDockMeetings(f.browser)).records.length,1);
  assert.equal((await f.browser.storage.local.get('appliedList')).appliedList[0].createdAt,f.raw.createdAt);
});

test('existing local applications retain their identity and connect to the real update workflow',async t=>{
  const f=await dockFixture(t),before=(await f.request('DOCK_RECORDS_STATE')).applications[0],service=createMeetingWorkflowService(f.browser),workflow=await service.read();
  assert.equal(before.workflowApplicationId,workflow.applications[0].id);
  const source=workflow.records.find(row=>row.id===before.workflowApplicationId);
  await service.mutate({recordId:source.id,expectedVersion:workflowVersion(source),action:'advance',fields:schedule(86400000),mutationId:'existing-record'});
  const after=(await f.request('DOCK_RECORDS_STATE')).applications[0];
  assert.equal(after.id,before.id);assert.equal(after.workflowApplicationId,before.workflowApplicationId);assert.equal(after.createdAt,before.createdAt);assert.equal(after.status,'screen');assert.ok(Date.parse(after.updatedAt)>Date.parse(before.updatedAt));
});

test('ended real meetings accept transcripts and manually recorded follow-up before progressing',async()=>{
  const f=workflow(),past=Date.now()-7200000;
  await f.browser.storage.local.set({appliedList:[{...f.raw,status:'screen'}],[MEETING_EVENTS_KEY]:[{id:'meeting',applicationId:'application',companyName:'Example',jobTitle:'Engineer',status:'screen',meeting:{kind:'screen',mode:'phone',round:1,phone:'+12025550123',startsAt:new Date(past).toISOString(),endsAt:new Date(past+1800000).toISOString(),result:'pending',review:{required:true}}}]});
  let current=(await readMeetingWorkflow(f.browser)).records[0];
  await assert.rejects(f.service.mutate({recordId:current.id,expectedVersion:workflowVersion(current),action:'advance',fields:schedule(86400000),mutationId:'too-soon'}),/Complete/);
  const completed=await f.service.mutate({recordId:current.id,expectedVersion:workflowVersion(current),action:'complete',fields:{transcript:'We discussed the role.',email:{confirmedAlreadySent:true,sentAt:new Date().toISOString(),from:'me@example.test',to:'recruiter@example.test',subject:'Thank you',body:'Thank you for the conversation.'}},mutationId:'complete'});
  current=completed.records[0];assert.equal(current.meeting.lifecycle,'completed');assert.equal(current.conversationMessages.length,1);
  const advanced=await f.service.mutate({recordId:current.id,expectedVersion:workflowVersion(current),action:'advance',fields:{...schedule(86400000),confirmPassed:true},mutationId:'interview'});
  assert.equal(advanced.records.find(row=>row.status==='interview').meeting.round,1);assert.equal(advanced.records.find(row=>row.id===current.id).meeting.result,'passed');
  assert.equal((await f.browser.storage.local.get('appliedList')).appliedList[0].status,'interview');
});
