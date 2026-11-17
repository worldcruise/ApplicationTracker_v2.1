import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {readQuestionBatch,validateAnswerBatch} from '../extension/studio/question-answer-chat.js';

for(const provider of ['chatgpt','deepseek'])test(`${provider} returns real question blocks without Copy controls and waits while streaming`,async t=>{
 const win=new Window({url:provider==='chatgpt'?'https://chatgpt.com/c/test':'https://chat.deepseek.com/a/chat/s/test'});t.after(()=>win.happyDOM.abort());const doc=win.document;
 win.HTMLElement.prototype.getClientRects=function(){return [{width:100,height:20}];};
 const run={id:'batch-1',jobId:'job',provider,kind:'application-answers',outputFormat:'question-answer-objects',questions:[{id:'why',question:'Why this role?'},{id:'start',question:'When can you start?'}]};
 doc.body.innerHTML='<form><textarea id="prompt-textarea"></textarea><button data-testid="send-button" disabled>Send</button><button data-testid="stop-button" aria-label="Stop generating">Stop</button></form><main><article data-message-author-role="user">DOCUMENT_RUN:batch-1\nSelected questions</article><article data-message-author-role="assistant"><div class="ds-assistant-message-main-content"><pre><code></code></pre><pre><code></code></pre></div></article></main>';
 const blocks=doc.querySelectorAll('code');blocks[0].textContent=JSON.stringify({question:'Why this role?',answer:'I build reliable products.'});blocks[1].textContent=JSON.stringify({question:'When can you start?',answer:'Needs my answer'});
 const context=vm.createContext({document:doc,window:win,location:win.location,Node:win.Node,NodeFilter:win.NodeFilter,getComputedStyle:win.getComputedStyle.bind(win),run,__techIntChatAdapterV2:{ChatGPTAdapter:class{},findEditor:()=>doc.querySelector('textarea'),findSend:()=>doc.querySelector('[data-testid=send-button]'),enabled:()=>false,isGenerating:()=>!!doc.querySelector('[data-testid=stop-button]')}});
 for(const file of ['generation-dom.js',`generation-${provider}.js`])vm.runInContext(await readFile('extension/ai-apply/src/'+file,'utf8'),context);
 const capture=()=>vm.runInContext(`(${readQuestionBatch.toString()})(run)`,context);
 assert.equal(capture().complete,false);doc.querySelector('[data-testid=stop-button]').remove();
 const reply=capture();assert.equal(reply.complete,true);const answers=validateAnswerBatch(reply.raw,run);assert.equal(answers[0].answer,'I build reliable products.');assert.equal(answers[1].needsUser,true);
 context.run={...run,id:'another-batch'};assert.equal(capture().complete,false);
});
