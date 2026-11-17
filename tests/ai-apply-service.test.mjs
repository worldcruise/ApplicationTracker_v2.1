import test from 'node:test';
import assert from 'node:assert/strict';
import {configureAIApply} from '../extension/studio/ai-apply-service.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

test('current extension pages own manual autofill; website-embedded copies are rejected',async()=>{
  const messages=event(),changed=event(),calls=[],sent=[],launched=[];
  const browser={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onMessage:messages,sendMessage:async message=>sent.push(message)},
    storage:{session:memoryStorage({'inline-dock:v1:7':{token:'secret'}},changed,'session')},tabs:{sendMessage:async(id,message)=>sent.push({id,...message})}};
  let template;
  configureAIApply({browser,records:async()=>({handle:async(...args)=>{calls.push(args);return {requests:[]};}}),dispatch:async(...args)=>{calls.push(args);return{};},launch:async tab=>launched.push(tab.id),startTemplate:options=>{template=options;}});
  const sender={id:'test',url:browser.runtime.getURL('ai-apply/index.html'),frameId:0,tab:{id:7,windowId:41}};
  await template.authorizeUI(sender);
  await assert.rejects(()=>template.authorizeUI({...sender,frameId:3}),/extension dock/);
  await assert.rejects(()=>template.authorizeUI({...sender,frameId:3,tab:{id:8,windowId:41}}),/extension dock/);
  const request=(message,source=sender)=>new Promise(resolve=>messages.emit(message,source,resolve));
  let reply=await request({type:'ai-apply.store',action:'read',payload:{}});assert.equal(reply.ok,true);assert.equal(calls[0][0],'AI_APPLY_READ');
  reply=await request({type:'ai-apply.autofill',operation:'DOCK_APPLY_START',payload:{windowId:999,jobId:'job'}});assert.equal(reply.ok,true);assert.equal(calls[1][1].windowId,41);
  reply=await request({type:'ai-apply.autofill',operation:'PROFILE_DELETE',payload:{}});assert.equal(reply.ok,false);assert.match(reply.error,/Unknown/);
  await template.readPageCommands.handle('capture-job',{id:7,windowId:41,url:'https://employer.test'});assert.equal(launched.length,0);
  await template.readPageCommands.handle('read-job-page',{id:7,windowId:41,url:'https://employer.test'});assert.deepEqual(launched,[7]);
  assert.ok(sent.some(item=>item.type==='job.read-requested'));assert.equal(template.readPageCommands.take(41).tabId,7);assert.equal(template.readPageCommands.take(41),null);
  const pdfPayload={jobId:'job',kind:'resume'};
  reply=await request({type:'ai-apply.pdf',payload:pdfPayload});assert.equal(reply.ok,true);assert.deepEqual(calls.at(-1).slice(0,2),['AI_APPLY_RENDER_PDF',pdfPayload]);
  const count=calls.length;
  reply=await request({type:'ai-apply.pdf',payload:pdfPayload},{...sender,frameId:3});assert.equal(reply.ok,false);assert.equal(calls.length,count);
  const page={id:'test',url:'https://employer.test/apply',frameId:0,documentId:'page-document',tab:{id:7,windowId:41,url:'https://employer.test/apply'}};
  reply=await request({type:'ai-apply.lifecycle',event:{kind:'ready',url:page.url}},page);assert.equal(reply.ok,true);assert.equal(calls.at(-1)[0],'DOCK_APPLY_EVENT');assert.equal(calls.at(-1)[1].windowId,41);assert.equal(calls.at(-1)[2].documentId,'page-document');
});
