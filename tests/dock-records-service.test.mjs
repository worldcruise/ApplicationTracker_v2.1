import assert from 'node:assert/strict';
import test from 'node:test';
import { dockFixture } from './helpers/dock-records-fixture.mjs';

test('manual applications validate required fields and retain resume and cover-letter edits',async t=>{
  const f=await dockFixture(t);
  for(const fields of [{company:'',role:'Engineer'},{company:'Company',role:''}])await assert.rejects(f.mutate('create-application',null,fields),{code:'INVALID_REQUEST'});
  const created=await f.mutate('create-application',null,{company:'Company',role:'Engineer'}),app=created.applications.find(item=>item.id===created.selectedId);
  assert.equal(created.jobs.length,0);assert.equal(app.company,'Company');assert.equal(app.status,'applied');
  const cvJsonRaw=JSON.stringify({company:'Company',title:'Engineer',summary:'Factual summary',skills:[],experience:[],education:[]});
  const result=await f.mutate('update',app,{status:'interview',notes:'',cvJsonRaw,coverLetterRaw:'My cover letter',coverLetterEnabled:true});
  const saved=result.applications.find(item=>item.id===app.id);assert.equal(saved.resume.cvJsonRaw,cvJsonRaw);assert.equal(saved.coverLetterRaw,'My cover letter');assert.equal(saved.coverLetterEnabled,true);assert.equal(saved.status,'interview');
});

test('clearing the queue refuses stale data and preserves other candidates and applications',async t=>{
  const f=await dockFixture(t),first=await f.create('first'),second=await f.create('second'),key='dock-job-records:v1';
  const stored=(await f.storage.get(key))[key];stored.jobs.push({...first,id:'other-job',candidateId:'other-candidate'});await f.storage.set({[key]:stored});
  const payload={action:'delete-all',candidateId:first.candidateId,type:'queue',mutationId:crypto.randomUUID(),jobs:[{id:first.id,revision:first.revision},{id:second.id,revision:0}]};
  await assert.rejects(f.request('DOCK_RECORDS_MUTATE',payload),{code:'CONFLICT'});assert.equal((await f.request('DOCK_RECORDS_STATE')).jobs.length,2);
  payload.jobs[1].revision=second.revision;
  const result=await f.request('DOCK_RECORDS_MUTATE',payload);assert.equal(result.jobs.length,0);assert.equal(result.applications.length,1);
  assert.equal((await f.storage.get(key))[key].jobs.find(job=>job.id==='other-job').deletedAt,undefined);
  assert.equal((await f.request('DOCK_RECORDS_MUTATE',payload)).jobs.length,0);
});

test('dock queue persists, rejects duplicates and keeps canonical application fields',async t => {
  const f=await dockFixture(t),created=await f.create();f.restart();
  const state=await f.request('DOCK_RECORDS_STATE');assert.equal(state.jobs[0].id,created.id);assert.equal(state.jobs[0].candidateId,'candidate-1');
  assert.equal(state.jobs[0].promptSnapshot.title,'Factual prompt');assert.equal(state.applications[0].role,'Existing role');
  await assert.rejects(f.create(),{code:'DUPLICATE_JOB'});
  const app=state.applications[0];await f.mutate('update',app,{notes:'Follow up tomorrow',conversationUrl:'',status:'interview'});
  assert.equal(f.browser.storage.local.values.appliedList[0].extra,'preserved');assert.equal(f.browser.storage.local.values.appliedList[0].status,'interview');assert.equal(f.sync.length,1);
  await assert.rejects(f.mutate('update',app,{notes:'Stale note',conversationUrl:'',status:'offer'}),{code:'CONFLICT'});
  f.restart();assert.equal((await f.request('DOCK_RECORDS_STATE')).applications[0].notes,'Follow up tomorrow');
  f.browser.storage.local.values.appliedList[0].jobTitle='Renamed on the web page';
  f.browser.storage.local.values.appliedList[0].companyName='Renamed company';
  f.browser.storage.local.values.appliedList[0].id='new-remote-id';
  const renamed=(await f.request('DOCK_RECORDS_STATE')).applications[0];
  assert.equal(renamed.id,app.id);assert.equal(renamed.notes,'Follow up tomorrow');assert.equal(renamed.role,'Renamed on the web page');
});

test('legacy application and queue labels resolve full candidate names without rewriting history',async t=>{
  const f=await dockFixture(t),job=await f.create(),key='dock-job-records:v1';
  const saved=(await f.storage.get(key))[key];saved.jobs[0].candidateName='Default';await f.storage.set({[key]:saved});
  const state=await f.request('DOCK_RECORDS_STATE');assert.equal(state.jobs.find(record=>record.id===job.id).candidateName,'Test Candidate');assert.equal(state.applications[0].candidateName,'Test Candidate');
  assert.equal(f.browser.storage.local.values.appliedList[0].profileName,'Profile One');assert.equal((await f.storage.get(key))[key].jobs[0].candidateName,'Default');
});

test('job inputs invalidate ready resumes and saving refuses mismatched or invalid Studio drafts',async t => {
  const f=await dockFixture(t),created=await f.create();
  await assert.rejects(f.request('DOCK_RECORDS_RESUME',{id:created.id,expectedRevision:created.revision,windowId:41}),{code:'JOB_MISMATCH'});
  const record=await f.ready(created);assert.equal(record.status,'Ready');assert.equal(record.resume.snapshot.resume.summary,'Real saved summary');
  const result=await f.mutate('update',record,{...record,description:'An updated job description',conversationUrl:''});const changed=result.jobs.find(item=>item.id===record.id);
  assert.equal(changed.status,'Queued');assert.equal(changed.resume,null);assert.equal(changed.resumeHistory.length,1);
  await assert.rejects(f.mutate('apply',changed),{code:'INVALID_STATE'});
  await f.request('DOCK_RECORDS_STUDIO',{id:changed.id,expectedRevision:changed.revision,windowId:41});
  const latest=(await f.request('DOCK_RECORDS_STATE')).jobs[0];
  await assert.rejects(f.request('DOCK_RECORDS_RESUME',{id:latest.id,expectedRevision:latest.revision,windowId:41}),{code:'INVALID_CV'});
});

test('manual preparation preserves current editor text, backs up other jobs, and retains retry/delete history',async t => {
  const f=await dockFixture(t),first=await f.create();const ready=await f.ready(first), second=await f.create('two');
  const before=structuredClone(f.draft);await f.request('DOCK_RECORDS_STUDIO',{id:second.id,expectedRevision:second.revision,windowId:41});
  const backups=await f.storage.get(null);assert.ok(Object.values(backups).some(item=>item?.cvJsonRaw===before.cvJsonRaw&&item?.jobInputRaw===before.jobInputRaw));
  let record=(await f.request('DOCK_RECORDS_STATE')).jobs.find(item=>item.id===second.id);
  let result=await f.mutate('fail',record);record=result.jobs.find(item=>item.id===second.id);assert.equal(record.status,'Failed');
  result=await f.mutate('delete',record);assert.ok(!result.jobs.some(item=>item.id===record.id));f.restart();
  result=await f.mutate('restore',{...record,revision:record.revision+1});record=result.jobs.find(item=>item.id===second.id);assert.equal(record.status,'Failed');
  result=await f.mutate('retry',record);record=result.jobs.find(item=>item.id===second.id);assert.equal(record.status,'Queued');assert.equal(record.conversationUrl,'https://chatgpt.com/c/test-chat');assert.ok(record.events.some(item=>item.label==='Resume preparation failed'));
  assert.equal((await f.request('DOCK_RECORDS_STATE')).jobs.find(item=>item.id===ready.id).resume.snapshot.resume.summary,'Real saved summary');
});

test('mark applied survives an interrupted final queue write without duplicating the application',async t => {
  const f=await dockFixture(t),record=await f.ready(await f.create()),write=f.storage.set;let fail=true;
  f.storage.set=async value=>{if(fail&&value['dock-job-records:v1']?.jobs.some(item=>item.applicationId)){fail=false;throw Error('Write interrupted');}return write(value);};
  await assert.rejects(f.mutate('apply',record),/Write interrupted/);assert.equal(f.browser.storage.local.values.appliedList.length,2);
  f.restart();const pending=(await f.request('DOCK_RECORDS_STATE')).jobs[0];const result=await f.mutate('apply',pending);
  assert.equal(f.browser.storage.local.values.appliedList.length,2);assert.equal(result.jobs.length,0);
  const app=result.applications.find(item=>item.id===result.selectedId);assert.equal(app.resume.snapshot.resume.summary,'Real saved summary');assert.equal(app.candidateId,'candidate-1');
});

test('opening a saved queue resume restores its JSON and document settings while backing up the current draft',async t=>{
  const f=await dockFixture(t),record=await f.ready(await f.create()),candidate=await f.deps.profiles.bootstrap();
  await f.deps.drafts.save({draft:{...f.draft,cvJsonRaw:'Unfinished newer CV',coverLetterRaw:'Unsent letter'},expectedRevision:f.draft.revision});
  await f.deps.drafts.settings({expectedRevision:f.draft.revision,templateId:'harvard',overrides:{fontSize:11},bindings:{experience:[],education:[]}});const previous=structuredClone(f.draft);
  const result=await f.request('DOCK_RECORDS_OPEN_RESUME',{id:record.id,expectedRevision:record.revision,windowId:41});
  assert.equal(f.draft.cvJsonRaw,record.resume.cvJsonRaw);assert.equal(f.draft.coverLetterRaw,record.resume.coverLetterRaw);assert.deepEqual(f.draft.documentTemplate,record.resume.documentTemplate);
  assert.deepEqual(f.draft.bindings,record.resume.snapshot.bindings);assert.deepEqual(await f.deps.profiles.bootstrap(),candidate);assert.deepEqual(result.jobs.find(job=>job.id===record.id),record);
  assert.ok(Object.values(await f.storage.get(null)).some(value=>value?.cvJsonRaw===previous.cvJsonRaw&&value?.coverLetterRaw===previous.coverLetterRaw&&value?.documentTemplate?.id==='harvard'));
  await assert.rejects(f.request('DOCK_RECORDS_OPEN_RESUME',{id:record.id,expectedRevision:0,windowId:41}),{code:'CONFLICT'});
  const queued=await f.create('queued'),before=structuredClone(f.draft);await assert.rejects(f.request('DOCK_RECORDS_OPEN_RESUME',{id:queued.id,expectedRevision:queued.revision,windowId:41}),{code:'NOT_READY'});assert.deepEqual(f.draft,before);
});
