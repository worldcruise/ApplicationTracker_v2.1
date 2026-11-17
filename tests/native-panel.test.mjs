import test from 'node:test';
import assert from 'node:assert/strict';
import {configureNativePanel} from '../extension/studio/native-panel-service.js';
import {event} from './helpers/dock-records-fixture.mjs';

function fixture(){
  const opened=[],calls=[],messages=[],dispatched=[],tab={id:7,windowId:41,url:'https://employer.test/job'};
  const browser={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onInstalled:event(),onStartup:event(),onMessage:event(),sendMessage:async message=>messages.push(message),getContexts:async()=>[{contextType:'SIDE_PANEL',documentId:'panel-document',windowId:41}]},action:{onClicked:event()},sidePanel:{setOptions:async options=>calls.push(options),setPanelBehavior:async options=>calls.push(options),open:options=>{opened.push(options);return Promise.resolve();}},tabs:{query:async()=>[tab],create:async options=>calls.push(options),update:async()=>{},get:async()=>tab},scripting:{executeScript:async options=>calls.push(options)}};
  browser.windows={get:async id=>({id,type:'normal'})};
  const service=configureNativePanel({browser,operations:new Set(['DASHBOARD_STATE','DOCK_APPLY_STATE']),dispatch:async(...args)=>{dispatched.push(args);return{};}});
  const sender={id:'test',url:'chrome-extension://test/sidepanel.html',frameId:0,documentId:'panel-document'};
  return{browser,service,tab,sender,opened,calls,messages,dispatched};
}
test('toolbar opens the native panel synchronously in its own window without mounting page UI',async()=>{
  const f=fixture();f.browser.action.onClicked.emit(f.tab);assert.deepEqual(f.opened,[{windowId:41}],'The open must happen before awaiting another API');
  await new Promise(resolve=>setTimeout(resolve,0));
  assert.ok(f.calls.some(call=>call.path==='sidepanel.html'));assert.ok(f.calls.every(call=>!call.files),'No dock content script is injected');
  assert.ok(f.calls.filter(call=>call.func).every(call=>String(call.func).includes('__applicationTrackerInlineDock?.close')));
  const restricted=fixture();restricted.browser.action.onClicked.emit({...restricted.tab,url:'chrome://extensions/'});assert.deepEqual(restricted.opened,[{windowId:41}]);
});
test('panel requests require a real SIDE_PANEL context and cannot access another window or unknown operations',async()=>{
  const f=fixture();assert.deepEqual(await f.service.handle({action:'context'},f.sender),{windowId:41});
  const envelope={version:1,requestId:'request',operation:'DOCK_APPLY_STATE',payload:{}};
  assert.equal((await f.service.handle({action:'request',envelope},f.sender)).ok,true);assert.equal(f.dispatched[0][1].windowId,41);
  await assert.rejects(()=>f.service.handle({action:'request',envelope:{...envelope,payload:{windowId:42}}},f.sender),/this browser window/);
  await assert.rejects(()=>f.service.handle({action:'request',envelope:{...envelope,operation:'PROFILE_SAVE'}},f.sender),/Invalid/);
  for(const patch of [{id:'other'},{url:'https://employer.test/sidepanel.html'},{documentId:'stale-document'}]){
    if(patch.documentId)f.browser.runtime.getContexts=async()=>[];
    await assert.rejects(()=>f.service.handle({action:'context'},{...f.sender,...patch}));
  }
});
test('capture opens Apply to Job in the matching native window and consumes that view once',async()=>{
  const f=fixture();await f.service.launch(f.tab,{view:'apply'});
  assert.deepEqual(await f.service.handle({action:'take-view'},f.sender),{view:'apply'});
  assert.deepEqual(await f.service.handle({action:'take-view'},f.sender),{view:null});
  assert.ok(f.messages.some(message=>message.type==='native-panel:show'&&message.windowId===41));
});

test('Chrome browser-hosted senders without document metadata resolve through the packaged SIDE_PANEL URL',async()=>{
  const f=fixture();f.browser.runtime.getContexts=async()=>[{contextType:'SIDE_PANEL',documentUrl:f.sender.url,windowId:-1}];
  const sender={id:'test',url:f.sender.url,origin:'chrome-extension://test'};
  assert.deepEqual(await f.service.handle({action:'context',windowId:41},sender),{windowId:41});
  await assert.rejects(()=>f.service.handle({action:'context',windowId:41},{...sender,tab:{id:7},frameId:1}),/Invalid/);
  f.browser.runtime.getContexts=async()=>[];await assert.rejects(()=>f.service.handle({action:'context',windowId:41},sender),/toolbar/);
});
