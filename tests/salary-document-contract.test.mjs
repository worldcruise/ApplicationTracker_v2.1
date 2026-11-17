import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {emptySalary,validateSalary} from '../extension/ai-apply/src/salary-data.mjs';
import {DOCUMENT_CONTRACT_VERSION,finalDocumentStructure,finalDocumentTemplateIssue} from '../extension/ai-apply/src/document-contract.mjs';
import {normalizeWritingPrompts,WORKFLOW_PROMPTS_KEY} from '../extension/ai-apply/src/writing-prompts.mjs';
import {generationPrompt,validateGeneration} from '../extension/ai-apply/src/generation-data.mjs';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {setQueueBackend,createQueueStore} from '../extension/ai-apply/src/queue-store.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {manualDocumentValue,parseManualDocuments} from '../extension/ai-apply/src/manual-documents.mjs';
import {dockFixture,event,memoryStorage} from './helpers/dock-records-fixture.mjs';

const quote='$100,000 - $120,000 a year';
const salary={min:100000,max:120000,currency:'USD',period:'year',sourceText:quote};
const job={id:'job',input:{profile:{name:'Candidate',role:'Engineer',summary:'Builds services.',skills:[],experience:[],education:[]},prompt:'RESUME',job:{company:'Employer',role:'Engineer',url:'https://employer.test/job',description:'Build services. Pay: '+quote}}};
const details=pay=>({company:'Employer',title:'Engineer',applyUrl:job.input.job.url,description:job.input.job.description,salary:pay});
const validate=(pay,source=job,version=DOCUMENT_CONTRACT_VERSION)=>validateGeneration(JSON.stringify({job:details(pay)}),source,'run','combined-json',{selectedModules:['job']},{contractVersion:version});

test('salary templates use the exact six keys and upgrade saved examples without changing other sections',()=>{
  assert.deepEqual(finalDocumentStructure().job.salary,{min:0,max:0,currency:'USD',period:'year',sourceText:''});
  const old=finalDocumentStructure();old.job.salary={value:'USD 100000-120000 per year',source:'listed',evidence:'USD 100000-120000 per year',basis:''};old.resume.summary='My saved example';
  const migrated=normalizeWritingPrompts({instruction:'My instruction',finalJson:JSON.stringify(old)});
  assert.deepEqual(JSON.parse(migrated.finalJson).job.salary,emptySalary());
  assert.equal(JSON.parse(migrated.finalJson).resume.summary,'My saved example');
  assert.equal(migrated.instruction,'My instruction');assert.equal(finalDocumentTemplateIssue(migrated.finalJson),null);
  assert.match(finalDocumentTemplateIssue(JSON.stringify(old)),/exactly min, max, currency, period, sourceText/);
  const prompt=generationPrompt(job,'run',{selectedModules:['job']},{finalJson:JSON.stringify(old)});
  assert.match(prompt,/salary must contain exactly min, max, currency, period, and sourceText/);
  assert.doesNotMatch(prompt,/salary\.value|"salary":\s*\{\s*"value"/);
});

test('numeric ranges map to tracker salary text while preserving the original structured data and quote',()=>{
  const result=validate(salary);
  assert.equal(result.job.salary,'USD 100000-120000 per year');
  assert.equal(result.job.salarySource,'listed');assert.equal(result.job.salaryEvidence,quote);
  assert.deepEqual(result.job.salaryDetails,salary);assert.deepEqual(result.document.job.salary,salary);
  const hourly={min:50,max:75,currency:'CAD',period:'hour',sourceText:'CAD 50-75/hour'};
  const source=structuredClone(job);source.input.job.description='CAD 50-75/hour';
  assert.equal(validate(hourly,source).job.salary,'CAD 50-75 per hour');
  assert.equal(validate({...salary,sourceText:'Updated salary wording'}).job.salaryEvidence,'Updated salary wording');
});

test('unknown, single, one-sided and estimated salary values do not require old attribution fields',()=>{
  assert.equal(validate(emptySalary()).job.salary,'');
  assert.equal(validate(emptySalary()).job.salarySource,'unknown');
  assert.equal(validate({...salary,min:100000,max:100000,sourceText:''}).job.salary,'USD 100000 per year');
  assert.equal(validate({...salary,max:0,sourceText:''}).job.salary,'USD from 100000 per year');
  assert.equal(validate({...salary,min:0,sourceText:''}).job.salary,'USD up to 120000 per year');
  assert.equal(validate({...salary,sourceText:''}).job.salarySource,'estimated');
  const source=structuredClone(job);Object.assign(source.input.job,{salary:'USD 100000-120000 per year',salaryDetails:salary,salarySource:'listed',salaryEvidence:quote});
  assert.deepEqual(validate(emptySalary(),source).job.salaryDetails,salary,'Unknown AI output preserves existing saved pay');
});

test('current replies reject old salary fields and invalid numeric data; older bound requests still finish',()=>{
  const old={value:quote,source:'listed',evidence:quote,basis:''};
  assert.throws(()=>validate(old),/exactly min, max, currency, period, sourceText/);
  assert.equal(validate(old,job,4).job.salary,quote);
  for(const pay of [{...salary,min:'100000'},{...salary,currency:42},{...salary,period:null},{...salary,sourceText:null},{...salary,source:'listed'}])assert.throws(()=>validate(pay),/job\.salary/);
  for(const pay of [{...salary,min:-1},{...salary,max:1},{...salary,currency:'dollars'},{...salary,period:'annual'}])assert.doesNotThrow(()=>validate(pay));
  assert.throws(()=>validateSalary({...salary,min:Infinity}),/finite/);
});

for(const provider of ['chatgpt','deepseek'])test(`${provider} detects and validates current JD-only numeric salary replies`,async t=>{
  const win=new Window({url:provider==='chatgpt'?'https://chatgpt.com/c/current':'https://chat.deepseek.com/a/chat/s/current'});t.after(()=>win.happyDOM.abort());
  win.HTMLElement.prototype.getClientRects=function(){return [{}];};
  const doc=win.document;doc.body.innerHTML='<section><div data-message-author-role="user" id="user"></div><div data-message-author-role="assistant"><pre><code id="reply"></code></pre></div></section><form><textarea></textarea><button data-testid="send-button">Send</button></form>';
  const run={id:'run',jobId:'job',prompt:generationPrompt(job,'run',{selectedModules:['job']}),outputFormat:'combined-json',documentContractVersion:DOCUMENT_CONTRACT_VERSION,baseline:{users:0,answers:0},sendIntentAt:1};
  doc.getElementById('user').textContent=run.prompt;doc.getElementById('reply').textContent=JSON.stringify({job:details(salary)});
  // Happy DOM drops a lone newline before a JSON opening brace. Model the
  // provider's pre-wrapped user text without changing production matching.
  Object.defineProperty(doc.getElementById('user'),'innerText',{get(){return this.textContent;}});
  const context=vm.createContext({document:doc,window:win,location:win.location,Node:win.Node,NodeFilter:win.NodeFilter,getComputedStyle:win.getComputedStyle.bind(win),run,__techIntChatAdapterV2:{ChatGPTAdapter:class{},findEditor:()=>doc.querySelector('textarea'),findSend:()=>doc.querySelector('button'),enabled:()=>true,isGenerating:()=>false}});
  for(const file of ['generation-dom.js',`generation-${provider}.js`])vm.runInContext(await readFile('extension/ai-apply/src/'+file,'utf8'),context);
  const reply=vm.runInContext(`AiAgent${provider==='chatgpt'?'ChatGPT':'DeepSeek'}Generation.answer(run)`,context);
  assert.equal(reply.complete,true,JSON.stringify({raw:reply.raw,diagnostics:reply.diagnostics}));assert.equal(context.AiAgentGenerationDOM.completedJSON(reply.raw,run),true,JSON.stringify({raw:reply.raw,diagnostics:reply.diagnostics}));
  assert.deepEqual(validateGeneration(reply.raw,job,'run','combined-json',{selectedModules:['job']},{contractVersion:DOCUMENT_CONTRACT_VERSION}).job.salaryDetails,salary);
});

for(const transfer of ['automatic'])test(`${transfer} retrieval validates salary and saves the structured result into the shared job queue`,async t=>{
  const fixture=await dockFixture(t);setQueueBackend((action,payload)=>fixture.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
  const queue=createJobQueue({channel:null}),jobs=createQueueStore();t.after(()=>queue.dispose());await queue.ready;
  const profile=queue.snapshot().profiles[0],jobId=await queue.add({candidateId:profile.id,profile:profile.data,tailor:true,job:job.input.job});
  const current=await jobs.getJob(jobId),run={id:'run',jobId,kind:'documents',provider:'chatgpt',phase:transfer==='automatic'?'validating':'submitted',job:current,outputFormat:'combined-json',documentContractVersion:DOCUMENT_CONTRACT_VERSION,selectedModules:['job'],documentSettings:{selectedModules:['job'],includeResume:false,includeCoverLetter:false},manualAnswer:transfer==='clipboard',raw:JSON.stringify({job:details(salary)}),createdAt:1};
  const state={runs:[structuredClone(run)]},store={read:async()=>structuredClone(state),get:async()=>structuredClone(state.runs[0]),update:async(id,edit)=>{state.runs[0]=edit(structuredClone(state.runs[0]));return {value:structuredClone(state.runs[0])};}};
  const events=event(),browser={runtime:{sendMessage:async()=>({})},storage:{session:memoryStorage({}),local:memoryStorage({[WORKFLOW_PROMPTS_KEY]:{}})},tabs:{onUpdated:events,onRemoved:events}};
  const service=createGenerationService({browser,store,jobs,clipboard:async()=>'```json\n'+run.raw+'\n```'});t.after(()=>service.dispose());
  await service.list();assert.equal(state.runs[0].phase,'complete',state.runs[0].error);
  const saved=await jobs.getJob(jobId);assert.equal(saved.input.job.salary,'USD 100000-120000 per year');assert.deepEqual(saved.input.job.salaryDetails,salary);
  const native=(await fixture.request('DOCK_RECORDS_STATE')).jobs.find(row=>row.id===jobId);assert.equal(native.salary,'USD 100000-120000 per year');
  assert.deepEqual(native.aiApply.input.job.salaryDetails,salary);
  const manual=manualDocumentValue({...saved,resume:{company:'Employer',title:'Engineer',summary:'',skills:[],experience:[],education:[]}});
  assert.deepEqual(manual.job.salary,salary);assert.doesNotThrow(()=>parseManualDocuments(JSON.stringify(manual),saved));
});
