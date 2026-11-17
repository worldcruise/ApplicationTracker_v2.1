import test from 'node:test';
import assert from 'node:assert/strict';
import {isJobReady} from '../extension/ai-apply/src/job-readiness.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {createQueueStore,setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {dockFixture} from './helpers/dock-records-fixture.mjs';

const resume={company:'Employer',title:'Engineer',summary:'Prepared resume.',skills:[],experience:[],education:[]};
test('prepared resume, company and salary qualify as Ready despite old action flags',()=>{
  const record={resume,input:{job:{company:'Employer',salary:'USD 100000 per year'}},state:'attention',needsAction:true,error:'Old AI error'};
  assert.equal(isJobReady(record),true);
  for(const missing of [{...record,resume:null},{...record,input:{job:{company:'',salary:'USD 100000'}}},{...record,input:{job:{company:'Employer',salary:''}}},{...record,documentsStale:true},{...record,state:'cancelled'},{...record,applicationId:'submitted-application'}])assert.equal(isJobReady(missing),false);
  assert.equal(isJobReady({...record,input:{job:{company:'Employer',salary:{min:72000,max:108000,currency:'USD',period:'year',sourceText:''}}}}),true);
});

test('saved prepared records recover from Failed/Needs action and remain Ready across reads',async t=>{
  const app=await dockFixture(t);setQueueBackend((action,payload)=>app.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
  const queue=createJobQueue({channel:null}),store=createQueueStore();t.after(()=>queue.dispose());await queue.ready;
  const p=queue.snapshot().profiles[0],id=await queue.add({candidateId:p.id,profile:p.data,tailor:true,job:{company:'Employer',role:'Engineer',salary:'USD 100000 per year',url:'https://employer.test/ready',description:'Build systems.'}});
  const job=await store.getJob(id);await queue.saveDocuments(id,{resume:JSON.stringify(resume),expectedUpdatedAt:job.updatedAt});
  const key='dock-job-records:v1',saved=(await app.storage.get(key))[key],native=saved.jobs.find(job=>job.id===id);
  native.status='Failed';native.aiApply.state='attention';native.aiApply.needsAction=true;native.aiApply.error='Old generation failure';await app.storage.set({[key]:saved});
  await queue.refresh();assert.equal(queue.snapshot().requests[0].state,'ready');assert.equal(queue.snapshot().requests[0].needsAction,false);
  const persisted=(await app.storage.get(key))[key].jobs.find(job=>job.id===id);assert.equal(persisted.status,'Ready');assert.equal(persisted.aiApply.error,'');assert.equal(persisted.aiApply.needsAction,false);
  app.restart();const state=await app.request('DOCK_RECORDS_STATE');assert.equal(state.jobs.find(job=>job.id===id).status,'Ready');
});
