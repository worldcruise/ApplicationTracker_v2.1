import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {Window} from 'happy-dom';
import {prepareChatGPTNewChat} from '../extension/ai-apply/src/chatgpt-new-chat.mjs';
import {providerTabState} from '../extension/ai-apply/src/ai-tabs.mjs';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(t,{url='https://chatgpt.com/c/previous',control='<a href="/" data-testid="create-new-chat-button">New chat</a>',history=true}={}){
  const win=new Window({url});t.after(()=>win.happyDOM.abort());
  win.HTMLElement.prototype.getClientRects=function(){return this.hidden?[]:[{width:100,height:20}];};
  win.document.body.innerHTML=`<nav>${control}</nav><main>${history?'<article data-message-author-role="user">Old prompt</article><article data-message-author-role="assistant">Old answer</article>':''}</main><form><textarea id="prompt-textarea"></textarea></form>`;
  const context=vm.createContext({window:win,document:win.document,location:win.location,URL,MutationObserver:win.MutationObserver,
    getComputedStyle:win.getComputedStyle.bind(win),setTimeout,clearTimeout,setInterval,clearInterval});
  let clicks=0;win.document.querySelector('nav')?.addEventListener('click',event=>{event.preventDefault();clicks++;});
  const prepare=(timeout=1000)=>vm.runInContext(`(${prepareChatGPTNewChat.toString()})(${timeout})`,context);
  const inspect=()=>vm.runInContext(`(${providerTabState.toString()})('chatgpt','https://chatgpt.com')`,context);
  const clear=()=>{win.history.pushState({},'', '/');win.document.querySelector('main').replaceChildren();};
  return {win,doc:win.document,prepare,inspect,clear,get clicks(){return clicks;}};
}

test('native New chat waits for both SPA navigation and old messages to clear',async t=>{
  const f=fixture(t);let finished=false;const result=f.prepare().then(value=>{finished=true;return value;});
  assert.equal(f.clicks,1);f.win.history.pushState({},'', '/');await tick();assert.equal(finished,false);
  f.clear();assert.equal((await result).status,'ready');assert.equal(f.clicks,1);
});

test('an already empty home composer needs no click or reload',async t=>{
  const f=fixture(t,{url:'https://chatgpt.com/',history:false});
  assert.equal((await f.prepare()).status,'ready');assert.equal(f.clicks,0);
});

test('New chat supports an icon control with an accessible name',async t=>{
  const f=fixture(t,{control:'<button aria-label="New chat (Ctrl+Shift+O)"></button>'});
  f.doc.querySelector('button').addEventListener('click',f.clear);
  assert.equal((await f.prepare()).status,'ready');assert.equal(f.clicks,1);
});

test('a missing native control leaves the page untouched for the compatibility fallback',async t=>{
  const f=fixture(t,{control:''});assert.equal((await f.prepare()).status,'unavailable');
  assert.equal(f.win.location.pathname,'/c/previous');assert.equal(f.doc.querySelectorAll('article').length,2);
});

for(const kind of ['draft','attachment','streaming'])test(`${kind} is preserved without clicking New chat`,async t=>{
  const f=fixture(t);
  if(kind==='draft')f.doc.querySelector('textarea').value='My unsent message';
  if(kind==='attachment')f.doc.querySelector('form').insertAdjacentHTML('beforeend','<div data-testid="attachment-preview">resume.pdf</div>');
  if(kind==='streaming')f.doc.querySelector('form').insertAdjacentHTML('beforeend','<button data-testid="stop-button">Stop</button>');
  assert.equal((await f.prepare()).status,kind==='streaming'?'busy':'draft');assert.equal(f.clicks,0);
  assert.equal(f.inspect().ready,false);
});

test('attachments in the previous transcript do not block an empty composer',async t=>{
  const f=fixture(t);f.doc.querySelector('article').insertAdjacentHTML('beforeend','<div data-file-id="old-file">old.pdf</div>');
  assert.equal(f.inspect().ready,true);f.doc.querySelector('a').addEventListener('click',f.clear);
  assert.equal((await f.prepare()).status,'ready');
});

test('New chat never follows an external or non-home lookalike link',async t=>{
  const f=fixture(t,{control:'<a href="https://example.test/" data-testid="create-new-chat-button">New chat</a>'});
  assert.equal((await f.prepare()).status,'unavailable');assert.equal(f.clicks,0);
});

test('a stalled native transition times out after one click without altering history',async t=>{
  const f=fixture(t);assert.equal((await f.prepare(25)).status,'timeout');
  assert.equal(f.clicks,1);assert.equal(f.win.location.pathname,'/c/previous');assert.equal(f.doc.querySelectorAll('article').length,2);
});
