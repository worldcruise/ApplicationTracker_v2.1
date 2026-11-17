import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {configureApplyTools} from '../extension/studio/apply-tools-service.js';
import {installDocumentPreviewOverlay} from '../extension/studio/page-document-preview.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

function service(){
  const messages=event(),scripts=[],renders=[],tab={id:7,windowId:41,active:true,url:'https://employer.test/apply'},job={id:'job',state:'ready',resume:{title:'Engineer'},coverLetter:'Saved letter.',coverLetterEnabled:true,input:{job:{company:'Employer',role:'Engineer'}}};
  const browser={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onMessage:messages},storage:{local:memoryStorage({}),session:memoryStorage({})},windows:{get:async()=>({type:'normal'})},tabs:{get:async()=>tab,query:async()=>[tab],create:async()=>{throw Error('Preview must not open a browser tab.');}},scripting:{executeScript:async request=>{scripts.push(request);return[{result:true}];}}};
  configureApplyTools({browser,isUI:sender=>sender.id==='test'&&sender.url==='chrome-extension://test/ai-apply/index.html',authorizeUI:async()=>{},store:async()=>({requests:[job]}),previewPDF:async(request,options)=>{renders.push({request,options});return 'chrome-extension://test/preview.html?aiFile=preview%2Fjob%2F'+options.kind+'.pdf&embedded=1';}});
  const request=payload=>new Promise(resolve=>messages.emit({type:'ai-apply.tools',payload:{windowId:41,tabId:7,jobId:'job',action:'document.preview',...payload}},{id:'test',url:'chrome-extension://test/ai-apply/index.html'},resolve));
  return {browser,messages,scripts,renders,tab,job,request};
}

for(const kind of ['resume','cover-letter'])test(`Apply to Jobs previews ${kind} over the selected webpage using the saved Studio PDF`,async()=>{
  const s=service(),reply=await s.request({kind});assert.equal(reply.ok,true);assert.deepEqual(reply.value,{opened:true,tabId:7,kind});
  assert.equal(s.renders[0].request,s.job);assert.equal(s.renders[0].options.kind,kind);
  assert.equal(typeof s.renders[0].options.exporter.exportDocuments,'function','The worker must supply its static exporter instead of using import()');
  const script=s.scripts[0],url=new URL(script.args[0]);assert.equal(script.func,installDocumentPreviewOverlay);assert.deepEqual(script.target,{tabId:7});
  assert.equal(url.pathname,'/preview.html');assert.equal(url.searchParams.get('embedded'),'1');assert.ok(url.searchParams.get('overlayToken'));
  assert.equal(url.searchParams.get('overlayToken'),script.args[2]);assert.equal(script.args[3],s.tab.url);
  assert.equal(script.args[1],kind==='resume'?'Employer \u00b7 Resume':'Employer \u00b7 Cover letter');
});

test('page previews reject unavailable documents and tabs in another window before rendering',async()=>{
  const s=service();assert.equal((await s.request({kind:'jd'})).ok,false);
  s.tab.windowId=42;assert.equal((await s.request({kind:'resume'})).ok,false);s.tab.windowId=41;
  s.tab.url='chrome://extensions';assert.equal((await s.request({kind:'resume'})).ok,false);s.tab.url='https://employer.test/apply';
  s.job.coverLetterEnabled=false;assert.equal((await s.request({kind:'cover-letter'})).ok,false);
  s.job.documentsStale=true;assert.equal((await s.request({kind:'resume'})).ok,false);s.job.documentsStale=false;
  s.job.resume=null;assert.equal((await s.request({kind:'resume'})).ok,false);
  assert.equal(s.renders.length,0);assert.equal(s.scripts.length,0);
});

function webpage(t){
  const win=new Window({url:'https://employer.test/apply'}),saved=Object.fromEntries(['document','window','location'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)])),shadows=new Map();
  for(const [key,value] of Object.entries({document:win.document,window:win,location:win.location}))Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  const attach=win.Element.prototype.attachShadow;win.Element.prototype.attachShadow=function(options){const shadow=attach.call(this,options);shadows.set(this,shadow);return shadow;};
  t.after(()=>{globalThis.__trackerDocumentPreviewClose?.();for(const [key,descriptor]of Object.entries(saved))if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];win.happyDOM.abort();});
  win.document.body.innerHTML='<button id="original">Original focus</button>';win.document.querySelector('button').focus();
  const open=(token='one')=>{installDocumentPreviewOverlay('chrome-extension://test/preview.html?aiFile=one&embedded=1','Employer resume',token,win.location.href);const host=win.document.querySelector('#application-tracker-document-preview');return {host,shadow:shadows.get(host)};};
  return {win,open};
}

test('webpage preview replaces an earlier popup and supports close button, outside click, Escape and focus restoration',t=>{
  const {win,open}=webpage(t);let view=open();assert.ok(view.shadow.querySelector('dialog').open);assert.equal(view.host.shadowRoot,null);
  assert.equal(view.shadow.querySelector('iframe').src,'chrome-extension://test/preview.html?aiFile=one&embedded=1');
  const previous=view.host;view=open('two');assert.equal(previous.isConnected,false);assert.equal(win.document.querySelectorAll('#application-tracker-document-preview').length,1);
  view.shadow.querySelector('button').click();assert.equal(view.host.isConnected,false);assert.equal(win.document.activeElement.id,'original');
  view=open();view.shadow.querySelector('dialog').dispatchEvent(new win.MouseEvent('click',{clientX:-1,clientY:-1}));assert.equal(view.host.isConnected,false);
  view=open();win.document.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert.equal(view.host.isConnected,false);
});

test('preview messages require the matching iframe, extension origin and token; navigation cancels injection',t=>{
  const {win,open}=webpage(t),view=open(),frame=view.shadow.querySelector('iframe');
  const message=override=>win.dispatchEvent(new win.MessageEvent('message',{source:frame.contentWindow,origin:new URL(frame.src).origin,data:{type:'tracker.document-preview.close',token:'one'},...override}));
  message({origin:'https://employer.test'});message({source:win});message({data:{type:'tracker.document-preview.close',token:'wrong'}});assert.equal(view.host.isConnected,true);
  message({});assert.equal(view.host.isConnected,false);
  assert.throws(()=>installDocumentPreviewOverlay('chrome-extension://test/preview.html','Resume','one','https://employer.test/old'),/webpage changed/);
});
