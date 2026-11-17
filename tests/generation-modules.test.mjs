import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {generationPrompt,generationInstructions,validateGeneration} from '../extension/ai-apply/src/generation-data.mjs';
import {DEFAULT_WRITING_PROMPTS,normalizeWritingPrompts} from '../extension/ai-apply/src/writing-prompts.mjs';
import {selectedDocumentSettings} from '../extension/ai-apply/src/generation-selection.mjs';
import {finalDocumentStructure,DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';
import {exportDocuments} from '../extension/ai-apply/src/document-export.mjs';

const job={id:'job',input:{profile:{name:'Candidate',role:'Engineer',summary:'Builds services.',skills:[],experience:[],education:[]},prompt:'RESUME_TEMPLATE',job:{company:'Employer',role:'Engineer',description:'ORIGINAL_JOB_DESCRIPTION',url:'https://example.test/job'}}};
const sample=finalDocumentStructure();
sample.job={company:'Employer',title:'Engineer',description:job.input.job.description,applyUrl:job.input.job.url,salary:{min:0,max:0,currency:'USD',period:'year',sourceText:''}};
sample.resume={company:'Employer',title:'Engineer',summary:'',skills:[],experience:[],education:[]};
const labels=['job','resume','coverLetter'];
for(let mask=1;mask<8;mask++)test(`generation selection ${mask}: exact keys, prompt isolation, schema and export`,async()=>{
  const selectedModules=labels.filter((_,index)=>mask&(1<<index));
  const settings=selectedDocumentSettings(null,{selectedModules,formats:['json']});
  selectedModules.push('changed-after-snapshot');
  const expected=Object.fromEntries(settings.selectedModules.map(key=>[key,sample[key]]));
  const prompt=generationPrompt(job,'run',settings,{jdAnalysis:'JD_TEMPLATE',coverLetter:'LETTER_TEMPLATE'});
  for(const [key,text] of [['job','JD_TEMPLATE'],['resume','RESUME_TEMPLATE'],['coverLetter','LETTER_TEMPLATE']])assert.equal(prompt.includes(text),settings.selectedModules.includes(key));
  assert.match(prompt,/ORIGINAL_JOB_DESCRIPTION/);
  assert.ok(prompt.includes('final output\nOUTPUT CONTROLLER'));
  assert.ok(prompt.includes(JSON.stringify(expectedStructure(settings.selectedModules),null,2)));
  assert.ok(prompt.endsWith('==========\nCompany: Employer\nTitle: Engineer\nURL: https://example.test/job\nDescription:\n'+job.input.job.description));
  assert.doesNotMatch(prompt,/REQUEST INPUT|candidateProfile/);
  assert.match(prompt,/exactly ONE valid JSON object inside a single code block/);
  const instructions=generationInstructions(job,settings,{jdAnalysis:'JD_TEMPLATE',coverLetter:'LETTER_TEMPLATE'});
  assert.ok(prompt.endsWith(instructions),'Copy preview and queued generation use the same assembly');
  assert.equal(prompt,instructions,'AI sends exactly the combined prompt without a prefixed payload');
  const tasks=[['job','Task 1 (JD)'],['resume','Task 2 (Resume)'],['coverLetter','Task 3 (Cover letter)']];
  for(const [key,title] of tasks)assert.equal(instructions.includes(title),settings.selectedModules.includes(key));
  assert.equal((instructions.match(/Task [123] \(/g)||[]).length,settings.selectedModules.length);
  const validate=value=>validateGeneration(JSON.stringify(value),job,'run','combined-json',settings,{contractVersion:DOCUMENT_CONTRACT_VERSION});
  const result=validate(expected);
  assert.deepEqual(validateGeneration('```json\n'+JSON.stringify(expected)+'\n```',job,'run','combined-json',settings,{contractVersion:DOCUMENT_CONTRACT_VERSION}).document,expected,'The single code block is accepted');
  assert.deepEqual(Object.keys(result.document),settings.selectedModules);
  for(const key of settings.selectedModules){const missing={...expected};delete missing[key];assert.throws(()=>validate(missing),/is missing/);}
  assert.throws(()=>validate({...expected,requestId:'job'}),/Unexpected output section/);
  const output=await exportDocuments({id:'run',jobId:'job',job,phase:'complete',outputFormat:'combined-json',documentSettings:settings,result});
  assert.deepEqual(output.errors,[]);assert.equal(output.files.length,1);
  assert.deepEqual(JSON.parse(output.files[0].previewText),expected);
});
function expectedStructure(keys){const defaults=finalDocumentStructure();return Object.fromEntries(keys.map(key=>[key,defaults[key]]));}
test('instruction defaults migrate without replacing custom instructions; task/output assembly stays complete',()=>{
  const oldInstruction='You are a **Resume Strategist & Career Development Specialist**. Do the following task exactly.\n\n{{tasks}}\n\n==========\nfinal output\n{{final_output}}\n==========\n{{job_description}}';
  assert.equal(normalizeWritingPrompts({instruction:oldInstruction}).instruction,DEFAULT_WRITING_PROMPTS.instruction);
  const custom='My saved instruction';
  assert.equal(normalizeWritingPrompts({instruction:custom}).instruction,custom);
  const settings={selectedModules:['resume','coverLetter']};
  const composed=generationInstructions(job,settings,{instruction:custom,coverLetter:'MY LETTER'});
  assert.ok(composed.startsWith(custom+'\n\nTask 2 (Resume)'));
  assert.match(composed,/containing exactly these keys: resume, coverLetter/);
  assert.doesNotMatch(composed,/Task 1 \(JD\)/);
  const placed=generationInstructions(job,settings,{instruction:'Custom wrapper\n{{tasks}}\n{{final_output}}\n{{job_description}}'});
  assert.equal((placed.match(/Task 2 \(Resume\)/g)||[]).length,1);
  assert.equal((placed.match(/OUTPUT CONTROLLER/g)||[]).length,1);
});
test('empty selections and missing snapshots are rejected; rejection is not partial success',()=>{
  assert.throws(()=>selectedDocumentSettings(null,{selectedModules:[]}),/Select at least one/);
  assert.throws(()=>validateGeneration(JSON.stringify({resume:sample.resume}),job,'run','combined-json',{}, {contractVersion:4}),/saved generation selection/);
  const settings=selectedDocumentSettings(null,{selectedModules:['resume']});
  assert.throws(()=>validateGeneration('{"rejection":{"reason":"Required license is absent"}}',job,'run','combined-json',settings,{contractVersion:4}),error=>error.code==='APPLICATION_REJECTED');
  assert.throws(()=>validateGeneration('{"resume":{}}',job,'run','combined-json',settings,{contractVersion:4}),/resume must contain exactly/);
});
test('chat capture recognizes JD-only, letter-only and rejection replies without request metadata',async()=>{
  const context=vm.createContext({});vm.runInContext(await readFile(new URL('../extension/ai-apply/src/generation-dom.js',import.meta.url),'utf8'),context);
  const run={id:'run',jobId:'job',outputFormat:'combined-json',documentContractVersion:DOCUMENT_CONTRACT_VERSION};
  for(const value of [{job:sample.job},{coverLetter:'Letter'},{rejection:{reason:'Not eligible'}},{resume:{}}])assert.equal(context.AiAgentGenerationDOM.completedJSON(JSON.stringify(value),run),true);
  assert.equal(context.AiAgentGenerationDOM.completedJSON('{"resume":',run),false);
});


test('independent saves preserve unselected documents in the shared queue',async t=>{
 const {dockFixture}=await import('./helpers/dock-records-fixture.mjs');
 const {setQueueBackend,createQueueStore}=await import('../extension/ai-apply/src/queue-store.mjs');
 const {createJobQueue,applyGeneratedJobMetadata}=await import('../extension/ai-apply/src/job-queue.mjs');
 const app=await dockFixture(t);setQueueBackend((action,payload)=>app.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
 const queue=createJobQueue({channel:null}),store=createQueueStore();t.after(()=>queue.dispose());await queue.ready;
 const profile=queue.snapshot().profiles[0];const id=await queue.add({candidateId:profile.id,profile:profile.data,tailor:true,job:job.input.job});
 let current=await store.getJob(id),counter=0;
 async function save(modules,result){
  current=await store.getJob(id);
  await queue.saveGeneratedDocuments({id:'save-'+(++counter),jobId:id,job:current,phase:'complete',documentSettings:selectedDocumentSettings(null,{selectedModules:modules}),result});
  current=await store.getJob(id);
 }
 await save(['coverLetter'],{resume:null,coverLetter:'First letter'});assert.equal(current.resume,null);assert.equal(current.coverLetter,'First letter');
 await save(['resume'],{resume:{...sample.resume,summary:'Builds systems.'},coverLetter:''});assert.equal(current.coverLetter,'First letter');
 const oldResume=structuredClone(current.resume);
 await save(['coverLetter'],{resume:null,coverLetter:'Second letter'});assert.deepEqual(current.resume,oldResume);assert.equal(current.coverLetter,'Second letter');
 const run={id:'analysis',jobId:id,job:current};
 await store.change(state=>applyGeneratedJobMetadata(state,run,{...current.input.job,description:'Updated description'},Date.now()));
 current=await store.getJob(id);assert.equal(current.documentsStale,true);assert.deepEqual(JSON.parse((await app.request('DOCK_RECORDS_STATE')).jobs.find(row=>row.id===id).resume.cvJsonRaw),oldResume);assert.equal(current.coverLetter,'Second letter');
 await save(['coverLetter'],{resume:null,coverLetter:'Updated letter'});assert.equal(current.coverLetter,'Updated letter');assert.deepEqual(JSON.parse((await app.request('DOCK_RECORDS_STATE')).jobs.find(row=>row.id===id).resume.cvJsonRaw),oldResume);
});
