import test from 'node:test';
import assert from 'node:assert/strict';
import {dockFixture} from './helpers/dock-records-fixture.mjs';
import {createQueueStore,setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {createJobQueue,applyGeneratedJobMetadata} from '../extension/ai-apply/src/job-queue.mjs';
import {importJobCsv} from '../extension/ai-apply/src/job-csv.mjs';

test('template uses the existing single profile and queue without seeding examples',async t=>{
  const fixture=await dockFixture(t),{storage}=fixture,service={handle:fixture.request};
  setQueueBackend((action,payload)=>service.handle(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload,{}));
  const store=createQueueStore(),queue=createJobQueue({store,channel:null});t.after(()=>queue.dispose());
  await queue.ready;
  assert.equal(queue.snapshot().profiles.length,1);assert.equal(queue.snapshot().requests.length,0);
  assert.equal(queue.snapshot().profiles[0].isExample,false);
  const profile=queue.snapshot().profiles[0];
  const id=await queue.add({candidateId:profile.id,profile:profile.data,tailor:true,job:{company:'Example Employer',role:'Engineer',url:'https://employer.test/careers/42',salary:'$120,000',description:'Build reliable software.'}});
  let native=await service.handle('DOCK_RECORDS_STATE',{},{});
  assert.equal(native.jobs.length,1);assert.equal(native.jobs[0].id,id);assert.equal(native.jobs[0].salary,'$120,000');
  const job=queue.snapshot().requests[0];
  const resume={company:job.input.job.company,title:'Engineer',summary:'Experienced engineer.',skills:[],experience:[],education:[],contact:profile.data.contact};
  await queue.saveDocuments(id,{resume:JSON.stringify(resume),coverLetter:'Dear hiring team,\n\nI am interested in this role.',coverLetterEnabled:true,expectedUpdatedAt:job.updatedAt});
  native=await service.handle('DOCK_RECORDS_STATE',{},{});
  assert.equal(native.jobs[0].status,'Ready');assert.equal(native.jobs[0].resume.inputRevision,native.jobs[0].inputRevision);assert.ok(native.jobs[0].resume.snapshot);
  assert.equal(JSON.parse(native.jobs[0].resume.cvJsonRaw).company,'Example Employer');
  const shared=(await storage.get('dock-job-records:v1'))['dock-job-records:v1'];assert.equal(shared.jobs.length,1);
  // Editing the dashboard's record is immediately reflected in the template.
  await service.handle('DOCK_RECORDS_MUTATE',{action:'update',mutationId:'dashboard-edit',id,expectedRevision:native.jobs[0].revision,fields:{...native.jobs[0],salary:'$140,000'}},{});
  await queue.refresh();assert.equal(queue.snapshot().requests[0].input.job.salary,'$140,000');
  await queue.cancel(id);native=await service.handle('DOCK_RECORDS_STATE',{},{});assert.equal(native.jobs.length,0);
});

test('shared queue rejects stale writes, duplicate application URLs and profile forks',async t=>{
  const fixture=await dockFixture(t),service={handle:fixture.request};
  const state=await service.handle('AI_APPLY_READ',{},{}),profile=state.profiles[0];
  const request={id:'new-job',input:{candidateId:profile.id,profile:profile.data,tailor:true,job:{company:'Employer',role:'Engineer',description:'A job description.',url:'https://employer.test/job'}},state:'queued',resume:null};
  const next=await service.handle('AI_APPLY_COMMIT',{changes:[{record:request,expectedRevision:null}],deleted:[]},{});
  await assert.rejects(()=>service.handle('AI_APPLY_COMMIT',{changes:[{record:{...request,input:{...request.input,job:{...request.input.job,salary:'$150k'}}},expectedRevision:null}],deleted:[]},{}),/changed/);
  await assert.rejects(()=>service.handle('AI_APPLY_COMMIT',{changes:[{record:{...request,id:'duplicate'},expectedRevision:null}],deleted:[]},{}),/already saved/);
  await assert.rejects(()=>service.handle('AI_APPLY_COMMIT',{changes:[{record:{...next.requests[0],input:{...request.input,candidateId:'other-profile'}},expectedRevision:next.requests[0].canonicalRevision}],deleted:[]},{}),/current profile/);
});

test('AI capture placeholders complete in the shared queue and generated documents are saved once',async t=>{
  const fixture=await dockFixture(t),service={handle:fixture.request};
  setQueueBackend((action,payload)=>service.handle(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload,{}));
  const store=createQueueStore(),queue=createJobQueue({store,channel:null});t.after(()=>queue.dispose());await queue.ready;
  const profile=queue.snapshot().profiles[0],input={candidateId:profile.id,profile:profile.data,tailor:true,job:{company:'',role:'',description:'Page text awaiting analysis.',url:'https://employer.test/pending'}};
  const id=await queue.add(input,{capturePending:true});let request=queue.snapshot().requests.find(item=>item.id===id);
  assert.equal(request.capturePending,true);
  await queue.completeCapture(id,{...input,job:{...input.job,company:'Employer',role:'Engineer',description:'Build reliable software.',salary:'$120k'}},{expectedUpdatedAt:request.updatedAt,runId:'capture-run'});
  request=queue.snapshot().requests.find(item=>item.id===id);assert.equal(request.capturePending,false);
  const run={id:'generation-run',jobId:id,job:structuredClone(request),phase:'complete',documentSettings:{includeCoverLetter:false},result:{resume:{company:'Employer',title:'Engineer',summary:'A factual resume.',skills:[],experience:[],education:[],contact:profile.data.contact},coverLetter:''}};
  const metadata=await store.change(draft=>applyGeneratedJobMetadata(draft,run,{salary:'$125k'},1));
  run.job=metadata.value;
  assert.equal(run.job.updatedAt,(await store.getJob(id)).updatedAt,'The generation snapshot uses the committed canonical timestamp');
  await queue.saveGeneratedDocuments(run);let native=await service.handle('DOCK_RECORDS_STATE',{},{});
  assert.equal(native.jobs[0].status,'Ready');assert.equal(native.jobs[0].resume.version,1);
  await queue.saveGeneratedDocuments(run);native=await service.handle('DOCK_RECORDS_STATE',{},{});assert.equal(native.jobs[0].resume.version,1);
  const original=native.jobs[0];
  await service.handle('DOCK_RECORDS_MUTATE',{action:'update',mutationId:'web-document-edit',id,expectedRevision:original.revision,fields:{...original,cvJsonRaw:JSON.stringify({...JSON.parse(original.resume.cvJsonRaw),summary:'Updated in the web dashboard.'}),coverLetterRaw:'',coverLetterEnabled:false}},{});
  await queue.refresh();assert.equal(queue.snapshot().requests[0].resume.summary,'Updated in the web dashboard.');
});

test('template CSV import reports an already submitted application as a skipped duplicate',async t=>{
  const fixture=await dockFixture(t);
  setQueueBackend((action,payload)=>fixture.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));
  const queue=createJobQueue({channel:null});t.after(()=>queue.dispose());await queue.ready;
  const profile=queue.snapshot().profiles[0];
  const report=await importJobCsv('company,title,description,url\nExisting company,Existing role,A real job description,https://example.test/existing',
    {candidateId:profile.id,profile:profile.data},queue);
  assert.deepEqual(report,{added:0,duplicates:1,invalid:0,errors:[]});
});
