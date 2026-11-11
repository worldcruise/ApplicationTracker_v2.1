import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

test('legacy settings notifications always settle the response channel and unrelated requests are not claimed',async()=>{
  const source=await readFile('extension/background.js','utf8'),start=source.indexOf('chrome.runtime.onMessage.addListener((e,t,n)=>'),end=source.indexOf('),chrome.tabs.onCreated',start);
  let listener;const context=vm.createContext({chrome:{runtime:{onMessage:{addListener:fn=>listener=fn}}},gg:()=>false,cg:async()=>undefined,_h:async()=>{throw Error('Sync unavailable');},qm:async()=>({profileName:'Main'}),Jm:async()=>({id:'remote-profile'}),nh:async()=>{}});
  vm.runInContext(source.slice(start,end)+');',context);
  const send=(message,sender={})=>new Promise(resolve=>{const accepted=listener(message,sender,resolve);assert.equal(accepted,true);});
  assert.equal((await send({type:'syncSettings'})).ok,true);
  assert.equal((await send({type:'syncProfile'})).error,'Sync unavailable');
  assert.equal(await send({type:'getSelectedProfile'}),null);
  const current=await send({type:'getSelectedProfile'},{tab:{id:7}});assert.equal(current.id,'remote-profile');assert.equal(current.profile.profileName,'Main');
  assert.equal((await send({type:'premiumFetchProfileList'})).length,1);
  assert.match((await send({type:'setSelectedProfile',profileId:'different-profile'})).error,/one profile/);
  for(const message of [{type:'unknown'},{type:'inline-dock:request'},{version:1,operation:'PROMPT_SETTINGS'}])assert.equal(listener(message,{},()=>assert.fail('Unrelated request was answered')),false);
});
