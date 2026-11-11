import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {configureInlineDock} from '../extension/studio/inline-dock-service.js';
import {reserveDockSpace} from '../extension/studio/inline-dock-layout.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

function fixture(){
  const calls=[],dispatched=[],privateChanged=event(),changed=event(),tab={id:7,windowId:41,url:'https://example.test/job'},sender={id:'test',frameId:0,documentId:'doc-7',url:tab.url,tab};
  const browser={runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`,onInstalled:event(),onStartup:event(),onMessage:event()},sidePanel:{setPanelBehavior:async()=>{},open:async()=>{}},action:{onClicked:event()},storage:{session:memoryStorage(),local:memoryStorage({appliedList:[],'ui-theme:v1':'light'}),onChanged:changed},tabs:{onUpdated:event(),onAttached:event(),onRemoved:event(),query:async()=>[tab],get:async id=>({id,windowId:id===8?42:41,url:tab.url}),create:async value=>{calls.push(value);return{id:9,...value};},update:async(id,value)=>({id,...value}),sendMessage:async()=>{}},scripting:{executeScript:async value=>{calls.push(value);return[{documentId:'doc-7',frameId:0}];}}};
  const storage={...memoryStorage(),onChanged:privateChanged};
  const service=configureInlineDock({browser,storage,operations:new Set(['DASHBOARD_STATE','DOCK_RECORDS_STATE']),dispatch:async(...args)=>{dispatched.push(args);return{candidate:null,candidates:[]};}});
  return {browser,storage,service,tab,sender,calls,dispatched,async request(action,payload={},override={}){const grant=(await browser.storage.session.get('inline-dock:v1:7'))['inline-dock:v1:7'];return service.handle({action,payload,token:grant?.token}, {...sender,...override});}};
}

test('restricted-page toolbar clicks open the web Dashboard without injecting or opening a native panel',async()=>{
  for(const url of ['chrome://extensions/','chrome://newtab/','https://chromewebstore.google.com/detail/test','https://chrome.google.com/webstore/detail/test']){
    const f=fixture(),opened=[];f.browser.sidePanel.open=async options=>{opened.push(options);};
    f.browser.action.onClicked.emit({...f.tab,url});
    await new Promise(resolve=>setTimeout(resolve,5));
    assert.deepEqual(opened,[]);assert.deepEqual(f.calls,[{windowId:41,url:'chrome-extension://test/options.html#/dashboard',active:true}]);
  }
});

test('an asynchronous injection failure opens the web Dashboard without opening a native panel',async()=>{
  const f=fixture();let panels=0;
  f.browser.sidePanel.open=async()=>{panels++;};
  f.browser.scripting.executeScript=async()=>{throw Error('Cannot access this page.');};
  f.browser.action.onClicked.emit(f.tab);
  await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(panels,0);assert.deepEqual(f.calls,[{windowId:41,url:'chrome-extension://test/options.html#/dashboard',active:true}]);
});

test('Dashboard fallback reuses an extension tab in the same window and coalesces repeated clicks',async()=>{
  const f=fixture(),updates=[];
  f.browser.tabs.query=async query=>{assert.deepEqual(query,{windowId:41});return[{id:12,url:'chrome-extension://test/options.html#/settings'}];};
  f.browser.tabs.update=async(id,options)=>{updates.push({id,...options});};
  f.browser.action.onClicked.emit({...f.tab,url:'chrome://extensions/'});f.browser.action.onClicked.emit({...f.tab,url:'chrome://extensions/'});
  await new Promise(resolve=>setTimeout(resolve,5));
  assert.deepEqual(updates,[{id:12,url:'chrome-extension://test/options.html#/dashboard',active:true}]);assert.deepEqual(f.calls,[]);
});

test('toolbar grants only the clicked document; stale documents and child frames cannot access records',async()=>{
  const f=fixture();await f.service.launch(f.tab);
  assert.equal(f.calls[0].target.tabId,7);assert.deepEqual(f.calls[1].target,{tabId:7,documentIds:['doc-7']});
  const payload={version:1,requestId:'a',operation:'DASHBOARD_STATE',payload:{}};
  assert.equal((await f.request('request',payload)).ok,true);
  for(const override of [{frameId:1},{documentId:'old-document'},{id:'other'},{tab:{id:8,windowId:42}}])await assert.rejects(f.request('request',payload,override));
  await assert.rejects(f.request('request',{...payload,operation:'CANDIDATE_EXPORT_JSON'}));
  await assert.rejects(f.request('request',{...payload,payload:{windowId:42}}));
  await assert.rejects(f.service.handle({action:'context',token:'wrong'},f.sender));
});

test('rapid toolbar clicks share one launch and keep an existing dock connected',async()=>{
  const f=fixture();await Promise.all(Array.from({length:8},()=>f.service.launch(f.tab)));
  assert.equal(f.calls.filter(call=>call.files).length,1);
  const initial=(await f.browser.storage.session.get('inline-dock:v1:7'))['inline-dock:v1:7'];
  await f.service.launch(f.tab);
  assert.equal((await f.browser.storage.session.get('inline-dock:v1:7'))['inline-dock:v1:7'].token,initial.token);
  assert.deepEqual(await f.service.handle({action:'context',token:initial.token},f.sender),{windowId:41,tabId:7});
});

test('dock state belongs to its tab; navigation preserves collapse and private UI access is limited',async()=>{
  const f=fixture();await f.service.launch(f.tab);await f.request('collapse',{collapsed:true});
  await f.service.launch(f.tab,false);assert.equal(f.calls.at(-2).args[0].collapsed,true);
  await f.service.launch(f.tab,true);assert.equal(f.calls.at(-2).args[0].collapsed,false);
  await f.request('private-write',{key:'dock-apply-ui:v1:41:7',value:{step:'review'}});
  assert.deepEqual(await f.request('private-read',{key:'dock-apply-ui:v1:41:7'}),{'dock-apply-ui:v1:41:7':{step:'review'}});
  await assert.rejects(f.request('private-read',{key:'autofill-profile:candidate-1'}));
  await assert.rejects(f.request('session-read',{key:'inline-dock:v1:7'}));
  await assert.rejects(f.request('tabs-update',{id:8,active:true}));
  await assert.rejects(f.request('tabs-create',{url:'javascript:alert(1)'}));
  await f.request('tabs-create',{url:'https://example.test/application',windowId:42});assert.equal(f.calls.at(-1).windowId,41);
});

test('reserving and releasing page space restores original inline styles and priorities',async()=>{
  const page=new Window({width:1280,height:800});
  try{
    const body=page.document.body;body.style.setProperty('width','95%','important');body.style.margin='8px';
    const host=page.document.createElement('div');body.append(host);const before=body.getAttribute('style');
    const layout=reserveDockSpace(page.document,host);layout.setOpen(true);
    assert.match(body.style.width,/384|400/);assert.equal(body.style.getPropertyPriority('width'),'important');
    layout.setOpen(false);assert.equal(body.getAttribute('style'),before);layout.close();
  }finally{await page.happyDOM.abort();}
});

test('packaged dock mounts in Shadow DOM, collapses to an icon, restores page space and reuses its instance',async()=>{
  const f=fixture();await f.service.launch(f.tab);
  const page=new Window({url:f.tab.url,width:1280,height:800,settings:{disableJavaScriptEvaluation:true}});let shadow;
  try{
    const attach=page.HTMLElement.prototype.attachShadow;
    page.HTMLElement.prototype.attachShadow=function(options){shadow=attach.call(this,options);return shadow;};
    page.__applicationTrackerInlineConfig={token:(await f.browser.storage.session.get('inline-dock:v1:7'))['inline-dock:v1:7'].token,collapsed:false,windowId:41};
    page.chrome={...f.browser,runtime:{...f.browser.runtime,sendMessage:async message=>{try{return{ok:true,result:await f.service.handle(message,f.sender)};}catch(error){return{ok:false,error:{message:error.message}};}}}};
    const source=await readFile('extension/content-scripts/inline-dock.js','utf8');page.eval(source);
    for(let i=0;i<100&&!shadow?.querySelector('.inline-collapse');i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(shadow.querySelector('#at-reference-dock'));assert.equal(shadow.querySelector('iframe'),null);
    assert.equal(shadow.querySelector('#rd-candidate'),null);assert.ok(shadow.querySelector('#rd-avatar'));assert.ok(shadow.querySelector('.rd-brand-name').textContent.includes('Application Tracker'));
    assert.equal(shadow.querySelector('.inline-settings').nextElementSibling,shadow.querySelector('.inline-collapse'));
    shadow.querySelector('.inline-settings').click();
    for(let i=0;i<100&&!f.calls.some(call=>call.url?.endsWith('options.html#/settings'));i++)await new Promise(resolve=>setTimeout(resolve,5));
    assert.ok(f.calls.some(call=>call.url==='chrome-extension://test/options.html#/settings'&&call.windowId===41));
    assert.equal(page.document.querySelector('#at-reference-dock'),null);
    assert.equal(shadow.querySelector('.inline-panel').hidden,false);assert.notEqual(page.document.body.style.width,'');
    shadow.querySelector('.inline-collapse').click();assert.equal(shadow.querySelector('.inline-panel').hidden,true);assert.equal(page.document.body.style.width,'');
    shadow.querySelector('.inline-launcher').click();assert.equal(shadow.querySelector('.inline-panel').hidden,false);
    page.eval(source);await new Promise(resolve=>setTimeout(resolve,10));assert.equal(page.document.querySelectorAll('application-tracker-dock').length,1);
    // An extension reload loses its isolated-world singleton while the old DOM remains.
    const previous=page.__applicationTrackerInlineDock,previousShadow=shadow;
    page.eval('globalThis.__applicationTrackerInlineDock=undefined');page.eval(source);
    for(let i=0;i<100&&(shadow===previousShadow||!shadow?.querySelector('.inline-collapse'));i++)await new Promise(resolve=>setTimeout(resolve,5));
    try{assert.equal(page.document.querySelectorAll('application-tracker-dock').length,1,'a stale dock must be disposed before a replacement mounts');}
    finally{previous.close();}
    assert.ok(page.__applicationTrackerInlineDock,'old cleanup must not clear the new singleton');
    shadow.querySelector('.inline-collapse').click();assert.equal(page.document.body.style.width,'');
    page.dispatchEvent(new page.Event('pagehide'));assert.equal(page.document.querySelector('application-tracker-dock'),null);assert.equal(page.document.body.style.width,'');
  }finally{page.__applicationTrackerInlineDock?.close?.();await page.happyDOM.abort();}
});
