import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const prompt='Saved JD rule\n\nSaved resume prompt\n\n{"requestId":"job"}';
function storeFor(run){const state={runs:[structuredClone(run)]};return {state,read:async()=>structuredClone(state),get:async()=>structuredClone(state.runs[0]),change:async edit=>({value:structuredClone(edit(state))}),update:async(id,edit)=>{state.runs[0]=edit(structuredClone(state.runs[0]));return {value:structuredClone(state.runs[0])};}};}

async function tabTask(t,{baseline,existing=false,loading=false,unexpected=false,posted=false}={}){
  const win=new Window({url:existing?'https://chatgpt.com/c/saved':'https://chatgpt.com/'});t.after(()=>win.happyDOM.abort());
  let ready=!loading,counts=loading?{users:4,answers:4}:existing||unexpected||posted?{users:3,answers:3}:{users:0,answers:0};
  const emitted=[],sent=[],editor={},run={id:'run',jobId:'job',provider:'chatgpt',prompt,outputFormat:'combined-json',mode:'prepare',manualAnswer:true,usesExistingTab:existing,...baseline?{baseline}:{}};
  const context=vm.createContext({window:win,document:win.document,location:win.location,crypto,AbortController,MutationObserver:win.MutationObserver,
    setTimeout,clearTimeout,setInterval,clearInterval,
    chrome:{runtime:{id:'test',onMessage:event(),sendMessage:async message=>{if(message.type==='generation.attach')return {ok:true,value:structuredClone(run)};emitted.push(structuredClone(message.data));return {ok:true,value:message.data.kind==='authorize'?{granted:true}:{ok:true}};}}},
    AiAgentGenerationDOM:{},AiAgentChatGPTGeneration:{baseline:()=>({...counts}),answer:()=>({user:posted?{}:null}),conversation:()=>existing?win.location.href:null,login:()=>false,busy:()=>false,editor:()=>ready?editor:null,
      send:async(run,{beforeSubmit})=>{await beforeSubmit();sent.push(run);return {};}}});
  vm.runInContext(await readFile('extension/ai-apply/src/generation-tab.js','utf8'),context);vm.runInContext('AiAgentGenerationTab.start("run")',context);
  t.after(()=>messagesStop());
  function messagesStop(){context.AiAgentGenerationTab&&context.chrome.runtime.onMessage.emit({type:'generation.stop',id:'run'},{id:'test'});}
  return {emitted,sent,ready(){ready=true;counts={users:0,answers:0};win.dispatchEvent(new win.Event('input'));},async finish(){for(let i=0;i<1000&&!emitted.some(item=>item.kind==='error'||item.phase==='submitted');i++)await tick();}};
}

test('fresh chat waits for the composer before recording its prompt baseline',async t=>{
  const task=await tabTask(t,{loading:true});await tick();task.ready();await task.finish();
  assert.equal(task.sent.length,1,JSON.stringify(task.emitted));
  assert.deepEqual(task.emitted.find(item=>item.kind==='anchor').baseline,{users:0,answers:0});
});

test('an explicitly linked conversation can receive the next job prompt',async t=>{
  const task=await tabTask(t,{existing:true});await task.finish();assert.equal(task.sent.length,1);
  assert.deepEqual(task.emitted.find(item=>item.kind==='authorize').baseline,{users:3,answers:3});
});

test('new-chat hydration waits for old history to clear instead of immediately marking the job as needing action',async t=>{
  const task=await tabTask(t,{unexpected:true});await tick();assert.equal(task.sent.length,0);
  assert.equal(task.emitted.some(item=>item.kind==='error'),false);
  assert.equal(task.emitted.some(item=>item.kind==='anchor'),false,'Old history must not become a persistent baseline');
  task.ready();await task.finish();assert.equal(task.sent.length,1);
  assert.deepEqual(task.emitted.find(item=>item.kind==='anchor').baseline,{users:0,answers:0});
});

test('a prompt already posted before attaching is not sent again or excluded from capture',async t=>{
  const task=await tabTask(t,{posted:true,existing:true});await task.finish();assert.equal(task.sent.length,0);
  assert.deepEqual(task.emitted.find(item=>item.kind==='anchor').baseline,{users:0,answers:0});
  assert.equal(task.emitted.some(item=>item.kind==='authorize'),false);
});

function connection(t,{posted=false,submitted=false,nativeStatus='ready',nativeGate=null,linked=false,provider='chatgpt',available=true}={}){
  const tab={id:7,windowId:1,url:'https://chatgpt.com/c/current',status:'complete'},events=event(),updates=[],probes=[];
  if(provider==='deepseek')tab.url='https://chat.deepseek.com/a/chat/s/current';
  const nativeCalls=[],starts=[],created=[],stopped=[];
  const run={id:'run',jobId:'job',kind:'documents',provider,phase:'attention',code:'existing-chat',tabId:available?7:null,prompt,outputFormat:'combined-json',baseline:{users:4,answers:4},job:{id:'job',input:{}},...(linked?{url:tab.url}:{}),...(submitted?{sendIntentAt:100,submittedAt:101}:{})};
  const store=storeFor(run),browser={runtime:{id:'test',sendMessage:async()=>({})},storage:{session:memoryStorage(submitted?{}:{'document-generation-tab:7':'run'})},windows:{update:async()=>({})},tabs:{onUpdated:events,onRemoved:events,sendMessage:async(id,message)=>{stopped.push(message);return {};},query:async()=>available?[tab]:[],create:async options=>{created.push(options);Object.assign(tab,options);return {...tab};},get:async()=>({...tab}),update:async(id,patch)=>{updates.push(patch);Object.assign(tab,patch);return {...tab};}},scripting:{executeScript:async spec=>{
    if(spec.files)return [{}];if(spec.func.name==='providerTabState')return [{result:{ready:true,busy:false,url:tab.url}}];
    if(spec.func.name==='prepareChatGPTNewChat'){
      nativeCalls.push(spec);if(nativeGate)await nativeGate;
      if(nativeStatus==='ready')tab.url='https://chatgpt.com/';
      return [{result:{status:nativeStatus}}];
    }
    if(spec.func.name==='hasPostedPrompt'||spec.func.name==='hasPostedGenerationPrompt'){
      probes.push(spec.args);const context=vm.createContext({AiAgentChatGPTGeneration:{answer:value=>({user:posted&&value.outputFormat==='combined-json'&&value.prompt===prompt?{}:null})},args:spec.args});return [{result:vm.runInContext('('+spec.func.toString()+')(...args)',context)}];
    }starts.push(spec);return [{result:false}];
  }}};
  const service=createGenerationService({browser,store,jobs:{getJob:async()=>run.job}});t.after(()=>service.dispose());return {store,service,updates,probes,nativeCalls,starts,created,stopped};
}

test('Resume clears a stale baseline when switching an unsent run to a fresh chat',async t=>{
  const fixture=connection(t);await fixture.service.open('run',true);
  assert.equal(fixture.store.state.runs[0].baseline,null);assert.equal(fixture.store.state.runs[0].usesExistingTab,false);
  assert.equal(fixture.nativeCalls.length,1);assert.equal(fixture.updates.some(item=>item.url),false);
  assert.equal(fixture.store.state.runs[0].newChatPending,false);assert.equal(fixture.starts.length,1);
  assert.ok(fixture.stopped.some(message=>message.type==='generation.stop'));
});

test('a missing native New chat control falls back to the home URL only after checking the tab is idle',async t=>{
  const f=connection(t,{nativeStatus:'unavailable'});await f.service.open('run',true);
  assert.equal(f.nativeCalls.length,1);assert.equal(f.updates.filter(item=>item.url==='https://chatgpt.com/').length,1);
});

for(const nativeStatus of ['busy','draft','timeout'])test(`native New chat ${nativeStatus} cannot reload the tab or send a prompt`,async t=>{
  const f=connection(t,{nativeStatus});await assert.rejects(f.service.open('run',true));
  assert.equal(f.updates.some(item=>item.url),false);assert.equal(f.starts.length,0);
  assert.equal(f.store.state.runs[0].phase,'attention');assert.equal(f.store.state.runs[0].newChatPending,false);
});

test('observation and authorization cannot start while native New chat is clearing the old conversation',async t=>{
  let release;const nativeGate=new Promise(resolve=>{release=resolve;});t.after(()=>release());
  const f=connection(t,{nativeGate});const opening=f.service.open('run',true);
  while(!f.nativeCalls.length)await tick();
  assert.equal(f.store.state.runs[0].newChatPending,true);assert.equal(f.starts.length,0);
  await assert.rejects(f.service.attach('run','actor',{id:'test',frameId:0,documentId:'doc',url:'https://chatgpt.com/c/current',tab:{id:7}}),/new chat is still opening/);
  await f.service.health({tabId:7,force:true,prepare:true});assert.equal(f.starts.length,0);
  release();await opening;assert.equal(f.starts.length,1);
});

test('an explicitly linked ChatGPT conversation never clicks New chat',async t=>{
  const f=connection(t,{linked:true});await f.service.open('run',true);
  assert.equal(f.nativeCalls.length,0);assert.equal(f.updates.some(item=>item.url),false);
  assert.equal(f.store.state.runs[0].usesExistingTab,true);
});

test('no existing ChatGPT tab opens the provider home without attempting native New chat',async t=>{
  const f=connection(t,{available:false});await f.service.open('run',true);
  assert.equal(f.created.length,1);assert.equal(f.nativeCalls.length,0);
  assert.equal(f.updates.filter(item=>item.url==='https://chatgpt.com/').length,1);
});

test('DeepSeek keeps its existing conversation-start behavior',async t=>{
  const f=connection(t,{provider:'deepseek'});await f.service.open('run',true);
  assert.equal(f.nativeCalls.length,0);assert.ok(f.updates.some(item=>item.url==='https://chat.deepseek.com/'));
});

for(const submitted of [false,true])test(`Resume recognizes a posted combined prompt (${submitted?'recorded':'manual'} submission) without navigating away`,async t=>{
  const fixture=connection(t,{posted:true,submitted});await fixture.service.open('run',true);
  assert.equal(fixture.updates.some(item=>item.url),false);assert.ok(fixture.probes.length);
  assert.deepEqual(fixture.store.state.runs[0].baseline,{users:4,answers:4});
  assert.equal(fixture.store.state.runs[0].url,'https://chatgpt.com/c/current');
});

test('explicit refetch passes latest-JSON mode to the provider observer without resending',async t=>{
  const f=connection(t,{posted:true,submitted:true});await f.service.refetch('run');
  assert.equal(f.store.state.runs[0].captureMode,'latest-json');assert.equal(f.store.state.runs[0].captureRevision,1);
  const attached=await f.service.attach('run','new-actor',{id:'test',frameId:0,documentId:'doc',url:'https://chatgpt.com/c/current',tab:{id:7}});
  assert.equal(attached.mode,'observe');assert.equal(attached.captureMode,'latest-json');assert.equal(f.updates.some(update=>update.url),false);
});

test('Fetch result again restarts after a stopped observer finishes instead of dropping Start',async t=>{
  const win=new Window({url:'https://chatgpt.com/c/saved'});t.after(()=>win.happyDOM.abort());
  const messages=event();let attaches=0,release;
  const firstAttach=new Promise(resolve=>{release=resolve;});
  const run={id:'run',jobId:'job',provider:'chatgpt',prompt,mode:'observe',manualAnswer:true,outputFormat:'combined-json',sendIntentAt:1,baseline:{users:0,answers:0}};
  const context=vm.createContext({window:win,document:win.document,location:win.location,crypto,AbortController,MutationObserver:win.MutationObserver,setTimeout,clearTimeout,setInterval,clearInterval,
    chrome:{runtime:{id:'test',onMessage:messages,sendMessage:async message=>{
      if(message.type==='generation.attach'){attaches++;if(attaches===1)await firstAttach;return {ok:true,value:structuredClone(run)};}
      return {ok:true,value:{ok:true}};
    }}},AiAgentGenerationDOM:{},AiAgentChatGPTGeneration:{conversation:()=>win.location.href,baseline:()=>run.baseline}});
  vm.runInContext(await readFile('extension/ai-apply/src/generation-tab.js','utf8'),context);
  context.AiAgentGenerationTab.start('run');await tick();assert.equal(attaches,1);
  messages.emit({type:'generation.stop',id:'run'},{id:'test'});
  context.AiAgentGenerationTab.start('run');context.AiAgentGenerationTab.start('run');
  release();for(let index=0;index<50&&attaches<2;index++)await tick();
  assert.equal(attaches,2,'Exactly one fresh observer must attach after cleanup');
});
