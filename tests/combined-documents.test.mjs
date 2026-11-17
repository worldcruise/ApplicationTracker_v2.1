import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {generationPrompt,validateGeneration,combinedDocumentObject} from '../extension/ai-apply/src/generation-data.mjs';
import {normalizeWritingPrompts,WORKFLOW_PROMPTS_KEY} from '../extension/ai-apply/src/writing-prompts.mjs';
import {exportDocuments} from '../extension/ai-apply/src/document-export.mjs';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {memoryStorage,event} from './helpers/dock-records-fixture.mjs';
import {buildPrompt} from '../extension/studio/resume-prompt-builder.js';
import {DOCUMENT_CONTRACT_VERSION,finalDocumentContract,finalDocumentStructure,finalDocumentTemplateIssue,validateFinalDocumentShape} from '../extension/ai-apply/src/document-contract.mjs';
import {parseManualResume} from '../extension/ai-apply/src/manual-documents.mjs';

const profile={name:'Private Candidate',role:'Engineer',summary:'Builds systems.',skills:['JavaScript'],experience:[{title:'Engineer',company:'Previous Employer',startDate:'2020-01',endDate:'Present',location:'Remote',sentences:['Built services.']}],education:[{degree:'BSc',institution:'Example University',startDate:'2015',endDate:'2019'}],contact:{email:'private@example.test'}};
const job={id:'job',manualChatUrl:'https://chatgpt.com/c/existing',input:{candidateId:'one',profile,prompt:'RESUME PROMPT',tailor:true,job:{company:'Employer',role:'Engineer',url:'https://example.test/job',description:'PRIVATE JD'}}};
const legacyDocument={resume:{company:'Employer',title:'Engineer',summary:'Delivered reliable services.',skills:[{Technical:['JavaScript']}],experience:[{title:'Engineer',company:'Previous Employer',sentences:['Built services.']}],education:[{degree:'BSc'}]},coverLetter:'I build reliable services.'};
const document={requestId:job.id,job:{company:'Employer',title:'Engineer',applyUrl:job.input.job.url,description:job.input.job.description,salary:{value:'',source:'unknown',evidence:'',basis:''}},...legacyDocument};
function jobsStore(){const state={requests:[structuredClone(job)]};return {getJob:async()=>structuredClone(state.requests[0]),change:async edit=>({value:structuredClone(edit(state)),state:structuredClone(state)})};}

function runStore(initial=[]){
  const state={runs:structuredClone(initial)};
  return {state,read:async()=>structuredClone(state),get:async id=>structuredClone(state.runs.find(row=>row.id===id)),summaries:async()=>state.runs.map(({job,prompt,raw,result,...row})=>structuredClone(row)),change:async edit=>({value:structuredClone(edit(state)),state:structuredClone(state)}),update:async(id,edit)=>{const index=state.runs.findIndex(row=>row.id===id),value=edit(structuredClone(state.runs[index]));state.runs[index]=value;return {value:structuredClone(value)};}};
}

test('combined document prompts append the final JSON structure after the saved sections',()=>{
  const writing=normalizeWritingPrompts({resume:'CUSTOM JD RULE',coverLetter:'LETTER PROMPT',autofill:'UNRELATED'});
  assert.equal(writing.jdAnalysis,'CUSTOM JD RULE');assert.match(generationPrompt(job,'internal-id',{includeCoverLetter:true},writing),/CUSTOM JD RULE\n\nTask 2 \(Resume\)\nRESUME PROMPT\n\nTask 3 \(Cover letter\)\nLETTER PROMPT\n\n==========\nfinal output\nOUTPUT CONTROLLER/);
  assert.doesNotMatch(generationPrompt(job,'internal-id',{includeCoverLetter:false},writing),/LETTER PROMPT/);
  assert.equal(normalizeWritingPrompts({jdAnalysis:'NEW',resume:'OLD'}).jdAnalysis,'NEW');
  assert.match(normalizeWritingPrompts().jdAnalysis,/one JSON object/);
  const candidate={candidate:{id:'one',name:'Private Candidate'},companies:[],professionalProfile:{},applicationPreferences:{}};
  assert.equal(buildPrompt(candidate,'PRIVATE JD',{id:'literal',text:'My exact saved resume prompt.'}).text,'My exact saved resume prompt.');
  assert.equal(buildPrompt(candidate,'Provided JD',{id:'with-jd',text:'Use this JD: {{job_description}}'}).text,'Use this JD: Provided JD');
});

test('one JSON result restores local PDF metadata and exports one combined JSON file',async()=>{
  const result=validateGeneration(JSON.stringify(document),job,'run','combined-json',{includeCoverLetter:true},{contractVersion:2});
  assert.equal(result.resume.contact.email,profile.contact.email);assert.equal(result.resume.experience[0].startDate,'2020-01');assert.equal(result.resume.education[0].institution,'Example University');
  assert.deepEqual(result.document,document);assert.ok(!Object.hasOwn(result.document.resume,'contact'));
  const exported=await exportDocuments({id:'run',jobId:job.id,job,phase:'complete',outputFormat:'combined-json',result,documentSettings:{formats:['json'],includeCoverLetter:true}});
  assert.deepEqual(exported.errors,[]);assert.equal(exported.files.length,1);assert.match(exported.files[0].filename,/Documents\.json$/);assert.deepEqual(JSON.parse(new TextDecoder().decode(exported.files[0].bytes)),document);
  assert.equal(validateGeneration(JSON.stringify(document.resume),job,'run','combined-json',{includeCoverLetter:false}).coverLetter,'');
  assert.throws(()=>validateGeneration(JSON.stringify({...document,runId:'another'}),job,'run','combined-json',{}),/another job/);
  assert.throws(()=>combinedDocumentObject(JSON.stringify(document)+'\n'+JSON.stringify(document)),/one complete JSON/);
  assert.throws(()=>combinedDocumentObject('['+JSON.stringify(document)+']'),/one complete JSON/);
});

for(const provider of ['chatgpt','deepseek'])test(`${provider} captures only the reply to the current combined prompt without injected markers`,async t=>{
  const win=new Window({url:provider==='chatgpt'?'https://chatgpt.com/c/current':'https://chat.deepseek.com/a/chat/s/current'});t.after(()=>win.happyDOM.abort());
  win.HTMLElement.prototype.getClientRects=function(){return [{}];};
  const doc=win.document;doc.body.innerHTML='<section><div data-message-author-role="user" id="old-user"></div><div data-message-author-role="assistant"><pre><code id="old-reply"></code></pre></div></section><section><div data-message-author-role="user" id="new-user"></div><div data-message-author-role="assistant"><pre><code id="new-reply"></code></pre></div></section><form><textarea id="chat-input"></textarea><button type="button" data-testid="send-button">Send</button></form>';
  const run={id:'run',jobId:'job',prompt:'JD RULE\n\nRESUME PROMPT\n\nLETTER PROMPT',outputFormat:'combined-json',baseline:{users:1,answers:1},sendIntentAt:1};
  doc.getElementById('old-user').textContent=run.prompt;doc.getElementById('new-user').textContent=run.prompt;
  doc.getElementById('old-reply').textContent=JSON.stringify({...document,coverLetter:'Old letter'});doc.getElementById('new-reply').textContent=JSON.stringify(document);
  const context=vm.createContext({document:doc,window:win,location:win.location,Node:win.Node,NodeFilter:win.NodeFilter,getComputedStyle:win.getComputedStyle.bind(win),run,__techIntChatAdapterV2:{ChatGPTAdapter:class{},findEditor:()=>doc.querySelector('textarea'),findSend:()=>doc.querySelector('button'),enabled:()=>true,isGenerating:()=>false}});
  for(const file of ['generation-dom.js',`generation-${provider}.js`])vm.runInContext(await readFile('extension/ai-apply/src/'+file,'utf8'),context);
  const capture=()=>vm.runInContext(`AiAgent${provider==='chatgpt'?'ChatGPT':'DeepSeek'}Generation.answer(run)`,context);
  let reply=capture();assert.equal(reply.user.id,'new-user');assert.equal(JSON.parse(reply.raw).coverLetter,document.coverLetter);assert.equal(reply.complete,true);
  doc.getElementById('new-user').remove();doc.getElementById('new-reply').closest('[data-message-author-role]').remove();
  reply=capture();assert.equal(Boolean(reply.user),false);assert.equal(reply.raw,'');
});

test('generation uses the selected resume prompt and collects the combined result through the owned chat',async t=>{
  const store=runStore(),events=event(),tab={id:7,windowId:41,url:job.manualChatUrl,status:'complete'},completed=[];
  const browser={runtime:{id:'test',sendMessage:async()=>({})},storage:{local:memoryStorage({[WORKFLOW_PROMPTS_KEY]:{jdAnalysis:'JD RULE',coverLetter:'LETTER PROMPT'}}),session:memoryStorage({})},windows:{update:async()=>({})},tabs:{onUpdated:events,onRemoved:events,query:async()=>[tab],get:async()=>tab,update:async(id,patch)=>Object.assign(tab,patch),sendMessage:async()=>({})},scripting:{executeScript:async()=>[{result:{ready:true,busy:false,url:tab.url}}]}};
  let selected=0;
  const service=createGenerationService({browser,store,jobs:jobsStore(),readResumePrompt:async()=>{selected++;return 'SELECTED RESUME PROMPT';},onComplete:async run=>completed.push(run),uuid:()=> 'run'});t.after(()=>service.dispose());
  await service.start(job.id,'chatgpt');assert.equal(selected,1);assert.match(store.state.runs[0].prompt,/JD RULE\n\nTask 2 \(Resume\)\nSELECTED RESUME PROMPT\n\nTask 3 \(Cover letter\)\nLETTER PROMPT\n\n==========\nfinal output\nOUTPUT CONTROLLER/);assert.equal(store.state.runs[0].documentContractVersion,DOCUMENT_CONTRACT_VERSION);
  assert.deepEqual(store.state.runs[0].selectedModules,['job','resume','coverLetter']);
  await browser.storage.local.set({documentSettings:{selectedModules:['coverLetter']}});
  const sender={id:'test',frameId:0,documentId:'doc',url:tab.url,tab:{id:7}};
  const attached=await service.attach('run','actor',sender);assert.equal(attached.outputFormat,'combined-json');
  await service.event('run','actor',{kind:'anchor',baseline:{users:0,answers:0},url:tab.url},sender);
  await service.event('run','actor',{kind:'authorize',baseline:{users:0,answers:0},url:tab.url},sender);
  await service.event('run','actor',{kind:'phase',phase:'submitted',url:tab.url},sender);
  const currentDocument={job:{...document.job,salary:{min:0,max:0,currency:'USD',period:'year',sourceText:''}},resume:document.resume,coverLetter:document.coverLetter};
  await service.event('run','actor',{kind:'result',raw:'```json\n'+JSON.stringify(currentDocument)+'\n```',url:tab.url},sender);
  assert.equal(store.state.runs[0].phase,'complete');assert.deepEqual(store.state.runs[0].result.document,currentDocument);assert.equal(completed.length,1);
});

test('the defined structure validates six resume fields, one cover letter, and no added metadata',()=>{
  const options={includeCoverLetter:true},version={contractVersion:2};
  assert.doesNotThrow(()=>validateFinalDocumentShape(document,options));
  const valid=validateGeneration(JSON.stringify(document),job,'run','combined-json',options,version);assert.deepEqual(valid.document,document);
  const emptySummary=structuredClone(document);emptySummary.resume.summary='';assert.equal(validateGeneration(JSON.stringify(emptySummary),job,'run','combined-json',options,version).resume.summary,'');
  const imported=parseManualResume(JSON.stringify(emptySummary),job);assert.equal(imported.summary,'');assert.equal(imported.contact.email,profile.contact.email);assert.equal(imported.education[0].institution,'Example University');
  assert.throws(()=>parseManualResume(JSON.stringify({...document,requestId:'other-job'}),job),/another request/);
  const disabled={...document,coverLetter:''};assert.doesNotThrow(()=>validateGeneration(JSON.stringify(disabled),job,'run','combined-json',{includeCoverLetter:false},version));
  assert.throws(()=>validateFinalDocumentShape(document,{includeCoverLetter:false}),/must be empty/);
  for(const key of ['schemaVersion','runId','extra'])assert.throws(()=>validateFinalDocumentShape({...document,[key]:'extra'},options),/exactly requestId, job, resume, coverLetter/);
  for(const key of ['requestId','job']){const missing=structuredClone(document);delete missing[key];assert.throws(()=>validateFinalDocumentShape(missing,options),/Final JSON must contain exactly/);}
  assert.throws(()=>validateGeneration(JSON.stringify({...document,requestId:'other'}),job,'run','combined-json',options,version),/another job/);
  const extra=structuredClone(document);extra.resume.experience[0].startDate='2020-01';assert.throws(()=>validateFinalDocumentShape(extra,options),/Experience must contain exactly/);
  const bullet=structuredClone(document);bullet.resume.experience[0].sentences=['• Built services.'];assert.doesNotThrow(()=>validateFinalDocumentShape(bullet,options));
  assert.throws(()=>validateFinalDocumentShape(document.resume,options),/Final JSON must contain exactly/);
});

test('Prompt settings default to the requested four-field structure and preserve saved instructions',()=>{
  const defaults=normalizeWritingPrompts(),structure=JSON.parse(defaults.finalJson);
  assert.deepEqual(structure,finalDocumentStructure());
  assert.deepEqual(Object.keys(structure),['requestId','job','resume','coverLetter']);
  assert.equal(structure.requestId,'CURRENT_JOB_ID');assert.equal(structure.resume.summary,'');
  assert.deepEqual(Object.keys(structure.resume),['company','title','summary','skills','experience','education']);
  assert.equal(finalDocumentTemplateIssue(defaults.finalJson),null);
  assert.match(finalDocumentTemplateIssue('{'),/valid JSON/);
  assert.match(finalDocumentTemplateIssue(JSON.stringify(legacyDocument)),/Final JSON must contain exactly/);
  const custom={...structure,requestId:'SAVED_ID',coverLetter:'Custom sample'};
  const writing=normalizeWritingPrompts({jdAnalysis:'MY RULE',coverLetter:'MY LETTER',finalJson:JSON.stringify(custom)});
  assert.equal(writing.jdAnalysis,'MY RULE');assert.equal(writing.coverLetter,'MY LETTER');
  const prompt=generationPrompt(job,'run',{includeCoverLetter:true},writing);
  assert.equal(prompt.includes('SAVED_ID'),false);assert.ok(prompt.includes(JSON.stringify({job:custom.job,resume:custom.resume,coverLetter:custom.coverLetter},null,2)));
  assert.equal(custom.requestId,'SAVED_ID');
  assert.ok(generationPrompt(job,'run',{includeCoverLetter:false},writing).includes(JSON.stringify({job:custom.job,resume:custom.resume},null,2)));
});

test('final job data accepts listed pay only with source evidence and keeps known values when unknown',()=>{
  const input=structuredClone(job),value=structuredClone(document),options={contractVersion:2};
  const quote='USD 100000-120000 per year';input.input.job.description+=' Salary: '+quote;
  value.job.description=input.input.job.description;value.job.salary={value:quote,source:'listed',evidence:quote,basis:''};
  let result=validateGeneration(JSON.stringify(value),input,'run','combined-json',{},options);
  assert.equal(result.job.salary,quote);assert.equal(result.job.salarySource,'listed');
  assert.equal(result.job.url,job.input.job.url);
  assert.deepEqual(result.document,value);
  value.job.applyUrl='https://updated.example/jobs/999';assert.equal(validateGeneration(JSON.stringify(value),input,'run','combined-json',{},options).job.url,value.job.applyUrl);
  value.job.applyUrl='';value.job.salary.value='USD 999999 per year';value.job.salary.evidence=value.job.salary.value;
  assert.equal(validateGeneration(JSON.stringify(value),input,'run','combined-json',{},options).job.salary,'USD 999999 per year');
  Object.assign(input.input.job,{salary:quote,salarySource:'listed',salaryEvidence:quote,salaryBasis:''});
  value.job.salary={value:'',source:'unknown',evidence:'',basis:''};
  result=validateGeneration(JSON.stringify(value),input,'run','combined-json',{},options);
  assert.equal(result.job.url,input.input.job.url);assert.equal(result.job.salary,quote);assert.equal(result.job.salarySource,'listed');
  assert.equal(result.document.job.applyUrl,'');assert.equal(result.document.job.salary.source,'unknown');
});

test('earlier two-field combined replies still finish under their original contract',()=>{
  const result=validateGeneration(JSON.stringify(legacyDocument),job,'run','combined-json',{}, {contractVersion:1});
  assert.deepEqual(result.document,legacyDocument);assert.equal(result.resume.experience[0].startDate,profile.experience[0].startDate);
  const emptySummary=structuredClone(legacyDocument);emptySummary.resume.summary='';
  assert.equal(validateGeneration(JSON.stringify(emptySummary),job,'run','combined-json',{}, {contractVersion:1}).resume.summary,'');
});
