import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {generationPrompt,validateGeneration} from '../extension/ai-apply/src/generation-data.mjs';
import {DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {createDocumentDownloads} from '../extension/ai-apply/src/document-downloads.mjs';
import {createQueueStore,setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {dockFixture,event,memoryStorage} from './helpers/dock-records-fixture.mjs';

const profile={name:'Candidate',role:'Engineer',summary:'Builds services.',skills:[],experience:[],education:[]};
const job={id:'job',input:{profile,prompt:'RESUME',job:{company:'Employer',role:'Engineer',url:'https://employer.test/job',description:'Build reliable services.'}}};
const rejection={rejection:{reason:'Candidate information is missing'}};
const document={resume:{company:'Employer',title:'Engineer',summary:'Uses the added candidate context.',skills:[],experience:[],education:[]}};

async function fixture(t,provider){
  const win=new Window({url:provider==='chatgpt'?'https://chatgpt.com/c/current':'https://chat.deepseek.com/a/chat/s/current'});t.after(()=>win.happyDOM.abort());
  win.HTMLElement.prototype.getClientRects=function(){return [{}];};const doc=win.document;
  doc.body.innerHTML='<main></main><form><textarea id="chat-input"></textarea><button data-testid="send-button" disabled>Send</button></form>';
  const run={id:'run',jobId:'job',prompt:generationPrompt(job,'run',{selectedModules:['resume']}),outputFormat:'combined-json',documentContractVersion:DOCUMENT_CONTRACT_VERSION,baseline:{users:0,answers:0},sendIntentAt:1,submittedAt:2};
  const context=vm.createContext({document:doc,window:win,location:win.location,Node:win.Node,NodeFilter:win.NodeFilter,getComputedStyle:win.getComputedStyle.bind(win),run,__techIntChatAdapterV2:{ChatGPTAdapter:class{},findEditor:()=>doc.querySelector('textarea'),findSend:()=>doc.querySelector('button'),enabled:node=>!!node&&!node.disabled,isGenerating:()=>false}});
  for(const file of ['generation-dom.js',`generation-${provider}.js`])vm.runInContext(await readFile('extension/ai-apply/src/'+file,'utf8'),context);
  function user(text=run.prompt){const node=doc.createElement('article');node.dataset.messageAuthorRole='user';node.textContent=text;Object.defineProperty(node,'innerText',{get(){return this.textContent;}});doc.querySelector('main').append(node);return node;}
  function reply(value,{plain=false,streaming=false}={}){const node=doc.createElement('article');node.dataset.messageAuthorRole='assistant';const text=typeof value==='string'?value:JSON.stringify(value);if(plain)node.textContent=text;else{node.innerHTML='<pre><code></code></pre>';node.querySelector('code').textContent=text;}if(streaming)node.dataset.isStreaming='true';doc.querySelector('main').append(node);return node;}
  const capture=()=>vm.runInContext(`AiAgent${provider==='chatgpt'?'ChatGPT':'DeepSeek'}Generation.answer(run)`,context);
  return {doc,run,user,reply,capture};
}

for(const provider of ['chatgpt','deepseek']){
  test(`${provider}: refetch chooses the corrected JSON after a rejection and candidate follow-up`,async t=>{
    const f=await fixture(t,provider);f.user();f.reply(rejection);f.user('Here is the missing candidate information. Generate the JSON again.');f.reply(document);
    assert.deepEqual(JSON.parse(f.capture().raw),rejection,'Normal capture remains tied to the original reply');
    f.run.captureMode='latest-json';const answer=f.capture();assert.equal(answer.complete,true);assert.deepEqual(JSON.parse(answer.raw),document);
    assert.deepEqual(validateGeneration(answer.raw,job,'run','combined-json',{selectedModules:['resume']},{contractVersion:DOCUMENT_CONTRACT_VERSION}).document,document);
  });
  test(`${provider}: latest unfenced JSON wins over the first code block`,async t=>{
    const f=await fixture(t,provider);f.user();f.reply(rejection);f.user('Added context');f.reply(document,{plain:true});f.run.captureMode='latest-json';
    assert.deepEqual(JSON.parse(f.capture().raw),document);
  });
  test(`${provider}: an unfinished newer JSON never falls back to the original rejection`,async t=>{
    const f=await fixture(t,provider);f.user();f.reply(rejection);f.user('Added context');f.reply('{"resume":',{streaming:true});f.run.captureMode='latest-json';
    const answer=f.capture();assert.equal(answer.raw,'{"resume":');assert.equal(answer.complete,false);
  });
  test(`${provider}: latest rejection stays a rejection instead of silently using an older success`,async t=>{
    const f=await fixture(t,provider);f.user();f.reply(document);f.user('Check again');f.reply(rejection);f.run.captureMode='latest-json';
    assert.deepEqual(JSON.parse(f.capture().raw),rejection);
  });
  test(`${provider}: refetch stops before another queued job's prompt in the same conversation`,async t=>{
    const f=await fixture(t,provider);f.user();f.reply(rejection);f.user('Added candidate context');f.reply(document);f.user('GENERATE ANOTHER JOB');f.reply({resume:{...document.resume,company:'Another employer'}});f.run.captureMode='latest-json';f.run.captureBoundaries=['GENERATE ANOTHER JOB'];
    assert.deepEqual(JSON.parse(f.capture().raw),document);
  });
}

test('refetched documents replace the prior result once, and later retries preserve manual edits',async t=>{
  const app=await dockFixture(t);setQueueBackend((action,payload)=>app.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
  const queue=createJobQueue({channel:null}),jobs=createQueueStore();t.after(()=>queue.dispose());await queue.ready;
  const p=queue.snapshot().profiles[0],id=await queue.add({candidateId:p.id,profile:p.data,tailor:true,job:job.input.job});
  let current=await jobs.getJob(id);
  await queue.saveGeneratedDocuments({id:'run',jobId:id,job:current,phase:'complete',documentSettings:{includeCoverLetter:false},result:{resume:{...document.resume,summary:'First saved result.'},coverLetter:''}});
  current=await jobs.getJob(id);
  const run={id:'run',jobId:id,job:current,phase:'complete',captureRevision:1,documentContractVersion:DOCUMENT_CONTRACT_VERSION,documentSettings:{includeCoverLetter:false,autoDownload:false},result:{resume:document.resume,coverLetter:''}};
  const state={runs:[run]},store={get:async()=>structuredClone(state.runs[0]),read:async()=>structuredClone(state),update:async(id,edit)=>{state.runs[0]=edit(structuredClone(state.runs[0]));return {value:structuredClone(state.runs[0])};}};
  const events=event(),browser={runtime:{sendMessage:async()=>({})},downloads:{onChanged:events},storage:{local:memoryStorage({})}};
  const delivery=createDocumentDownloads({browser,store,jobs,saveGenerated:run=>queue.saveGeneratedDocuments(run),files:{}});t.after(()=>delivery.dispose());
  await delivery.start(run);current=await jobs.getJob(id);assert.equal(current.resume.summary,document.resume.summary);assert.equal(current.documentRunId,'run:capture:1');
  await queue.saveDocuments(id,{resume:JSON.stringify({...document.resume,summary:'Manual edit after retrieval.'}),expectedUpdatedAt:current.updatedAt});
  await delivery.start(run);assert.equal((await jobs.getJob(id)).resume.summary,'Manual edit after retrieval.');
});
