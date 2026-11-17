import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {generationPrompt,validateGeneration} from '../extension/ai-apply/src/generation-data.mjs';
import {DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';

const job={id:'job',input:{prompt:'My resume template',profile:{name:'Candidate'},job:{company:'Employer',role:'Engineer',url:'https://example.test/job',description:'Build reliable services.'}}};
const result={job:{company:'Employer',title:'Engineer',applyUrl:'https://example.test/job',description:'Build reliable services.',salary:{min:0,max:0,currency:'USD',period:'year',sourceText:''}}};

async function fixture(t){
  const win=new Window({url:'https://chatgpt.com/c/current'});t.after(()=>win.happyDOM.abort());
  win.HTMLElement.prototype.getClientRects=function(){return [{}];};
  const doc=win.document;doc.body.innerHTML='<main></main><form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" disabled>Send</button></form>';
  const run={id:'run',jobId:job.id,prompt:generationPrompt(job,'run',{selectedModules:['job']}),outputFormat:'combined-json',documentContractVersion:DOCUMENT_CONTRACT_VERSION,sendIntentAt:1,submittedAt:2,baseline:{users:0,answers:0}};
  const context=vm.createContext({document:doc,window:win,location:win.location,Node:win.Node,NodeFilter:win.NodeFilter,getComputedStyle:win.getComputedStyle.bind(win),run,__techIntChatAdapterV2:{ChatGPTAdapter:class{},findEditor:()=>doc.querySelector('textarea'),findSend:()=>doc.querySelector('[data-testid=send-button]'),enabled:node=>!!node&&!node.disabled,isGenerating:()=>!!doc.querySelector('[data-testid=stop-button]')}});
  for(const file of ['generation-dom.js','generation-chatgpt.js'])vm.runInContext(await readFile('extension/ai-apply/src/'+file,'utf8'),context);
  function user(text=run.prompt,id='current'){
    const article=doc.createElement('article');article.dataset.messageAuthorRole='user';article.dataset.messageId=id;article.textContent=text;doc.querySelector('main').append(article);return article;
  }
  function reply(value=result,{mirror=false,streaming=false}={}){
    const article=doc.createElement('article');article.dataset.messageAuthorRole='assistant';
    article.innerHTML=mirror?'<div data-testid="code-block"><div class="toolbar">json<button>Copy code</button><button>Download</button></div><div class="cm-editor"><div class="cm-content"></div></div></div>':'<pre><code></code></pre>';
    const raw=typeof value==='string'?value:JSON.stringify(value,null,2);
    if(mirror){for(const text of raw.split('\n')){const line=doc.createElement('div');line.className='cm-line';line.textContent=text;article.querySelector('.cm-content').append(line);}}
    else article.querySelector('code').textContent=raw;
    if(streaming)article.dataset.isStreaming='true';doc.querySelector('main').append(article);return article;
  }
  const capture=()=>context.AiAgentChatGPTGeneration.answer(run);
  return {win,doc,run,context,user,reply,capture};
}

test('ChatGPT returns a complete JSON reply with an empty composer and no response toolbar',async t=>{
  const f=await fixture(t);f.user();f.reply();
  const answer=f.capture();assert.equal(answer.diagnostics.userMatched,true);assert.equal(answer.complete,true);
  assert.equal(answer.diagnostics.completionBasis,'matching-json');
  assert.deepEqual(validateGeneration(answer.raw,job,'run','combined-json',{selectedModules:['job']},{contractVersion:DOCUMENT_CONTRACT_VERSION}).document,result);
});

test('hidden retained conversation messages do not make a new chat look like existing history',async t=>{
  const f=await fixture(t);const user=f.user('Old question'),reply=f.reply();
  user.hidden=true;reply.setAttribute('aria-hidden','true');
  const baseline=f.context.AiAgentChatGPTGeneration.baseline();assert.equal(baseline.users,0);assert.equal(baseline.answers,0);
  f.user();f.reply();assert.equal(f.capture().complete,true);
});

test('collapsed prompt text and a Show more button do not hide its matching raw content',async t=>{
  const f=await fixture(t),user=f.user('');
  const text=f.doc.createElement('div');text.className='whitespace-pre-wrap';text.textContent=f.run.prompt;user.append(text);
  const button=f.doc.createElement('button');button.textContent='Show more';user.append(button);
  Object.defineProperty(user,'innerText',{get:()=>f.run.prompt.slice(0,100)+'... Show more'});
  Object.defineProperty(text,'innerText',{get:()=>f.run.prompt.slice(0,100)+'...'});
  f.reply();const answer=f.capture();assert.equal(answer.user,user);assert.equal(answer.complete,true);
});

test('paragraph reflow does not lose the submitted prompt anchor',async t=>{
  const f=await fixture(t);f.user(f.run.prompt.replace(/\n+/g,''));f.reply();
  assert.equal(f.capture().complete,true);
});

test('history re-rendering uses the last user message ID instead of an obsolete count',async t=>{
  const f=await fixture(t),previous=f.user('Previous unrelated question','previous');
  f.reply({job:{company:'Wrong old company'}});
  const baseline=f.context.AiAgentChatGPTGeneration.baseline();assert.equal(baseline.lastUserKey,'message:previous');
  f.run.baseline={...baseline,users:8,answers:8};
  f.user();f.reply();const answer=f.capture();assert.notEqual(answer.user,previous);assert.equal(answer.complete,true);assert.deepEqual(JSON.parse(answer.raw),result);
});

test('CodeMirror JSON is read without its language header, Copy or Download controls',async t=>{
  const f=await fixture(t);f.user();f.reply(result,{mirror:true});
  const answer=f.capture();assert.equal(answer.complete,true);assert.deepEqual(JSON.parse(answer.raw),result);assert.equal(answer.diagnostics.codeBlocks,1);
});

test('hidden duplicate code blocks are not concatenated into a second JSON object',async t=>{
  const f=await fixture(t);f.user();const reply=f.reply();
  const duplicate=reply.querySelector('pre').cloneNode(true);duplicate.hidden=true;reply.append(duplicate);
  const answer=f.capture();assert.equal(answer.diagnostics.codeBlocks,1);assert.deepEqual(JSON.parse(answer.raw),result);
});

test('completed JSON is not held by a disabled Stop control or leftover streaming styling',async t=>{
  const f=await fixture(t);f.user();const reply=f.reply();reply.classList.add('result-streaming');
  const stop=f.doc.createElement('button');stop.dataset.testid='stop-button';stop.disabled=true;f.doc.querySelector('form').append(stop);
  const answer=f.capture();assert.equal(answer.complete,true);assert.equal(f.context.AiAgentChatGPTGeneration.busy(answer),false);
});

test('a finished turn response toolbar overrides a stale streaming attribute',async t=>{
  const f=await fixture(t);f.user();const reply=f.reply(result,{streaming:true});
  const copy=f.doc.createElement('button');copy.dataset.testid='copy-turn-action-button';copy.textContent='Copy response';reply.prepend(copy);
  const answer=f.capture();assert.equal(answer.complete,true);assert.equal(answer.diagnostics.completionControl,true);
  assert.equal(f.context.AiAgentChatGPTGeneration.busy(answer),false);
});

test('an enabled Stop control still blocks retrieval of a reply that is being generated',async t=>{
  const f=await fixture(t);f.user();f.reply();
  const stop=f.doc.createElement('button');stop.dataset.testid='stop-button';f.doc.querySelector('form').append(stop);
  assert.equal(f.capture().complete,false);
  stop.disabled=true;assert.equal(f.capture().complete,true);
});

test('a later question generating cannot block retrieval of this finished turn',async t=>{
  const f=await fixture(t);f.user();f.reply();f.user('Later unrelated question');f.reply('{"later":');
  const stop=f.doc.createElement('button');stop.dataset.testid='stop-button';f.doc.querySelector('form').append(stop);
  const answer=f.capture();assert.equal(answer.complete,true);assert.deepEqual(JSON.parse(answer.raw),result);
});

test('streaming and a partial object remain pending; the finished object becomes retrievable',async t=>{
  const f=await fixture(t);f.user();const reply=f.reply(result,{mirror:true,streaming:true});
  assert.equal(f.capture().complete,false);
  delete reply.dataset.isStreaming;assert.equal(f.capture().complete,true);
  reply.querySelector('.cm-content').textContent='{"job":';assert.equal(f.capture().complete,false);
});

test('an old identical prompt, a different prompt and a later unrelated reply are not retrieved',async t=>{
  const f=await fixture(t);f.user();f.reply({job:{company:'Old result'}});f.run.baseline={users:1,answers:1};
  assert.equal(f.capture().user,undefined);assert.equal(f.capture().raw,'');
  f.user(f.run.prompt+' changed');f.reply({job:{company:'Different prompt'}});assert.equal(f.capture().raw,'');
  const current=f.user();f.reply();f.user('Follow-up question');f.reply({job:{company:'Later unrelated reply'}});
  const answer=f.capture();assert.equal(answer.user,current);assert.deepEqual(JSON.parse(answer.raw),result);
});
