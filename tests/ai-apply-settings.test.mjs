import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {webcrypto} from 'node:crypto';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';
import {PROMPT_SETTINGS_KEY,normalizePromptSettings,connectPromptSettings,prompts} from '../extension/ai-apply/src/studio-prompts.mjs';
import {createChatProviders} from '../extension/ai-apply/src/chat-providers.mjs';
import {connectKeywordPreferences} from '../extension/ai-apply/src/keyword-preferences.mjs';
import {openDocumentPreview} from '../extension/ai-apply/src/document-preview-tabs.mjs';
import {savedPDFPreview} from '../extension/ai-apply/src/saved-pdf-preview.mjs';
import {readAIApplyPDF} from '../extension/studio/ai-apply-pdf-preview.js';
import {configurePromptSettingsBridge} from '../extension/studio/prompt-settings-bridge.js';
import {profileEditorValue} from '../extension/studio/profile-resume-page.js';

function browserFixture(seed={}){const changed=event();return {runtime:{getURL:file=>'chrome-extension://test/'+file},storage:{local:memoryStorage(seed,changed,'local'),onChanged:changed}};}

test('older profiles with missing optional sections render safely without changing their stored facts',()=>{
  const source={profileName:'Default',nameData:{firstName:'Test',lastName:'Person'},contactData:{email:'test@example.com'},jobData:[],educationData:[]};
  const normalized=profileEditorValue(source);
  assert.deepEqual(normalized.languageData,[]);assert.deepEqual(normalized.websiteData.websites,[]);assert.equal(normalized.resumeData.fileName,'');assert.equal(normalized.nameData.firstName,'Test');
  assert.equal(source.languageData,undefined);assert.equal(profileEditorValue(null),null);
});

test('keyword defaults contain the requested color groups and only highlighting is enabled',()=>{
  const keywords=globalThis.AiAgentKeywords,defaults=keywords.normalize();
  assert.equal(defaults.enabled,true);assert.equal(defaults.caseSensitive,false);assert.equal(defaults.wholeWords,false);
  assert.deepEqual(defaults.groups.find(group=>group.id==='yellow').keywords,['travel','staff','architect','relocation']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='green').keywords,['remote']);
  assert.deepEqual(defaults.groups.find(group=>group.id==='red').keywords,['onsite','on-site','certification','license','volunteer','intern','hybrid']);
  assert.ok(defaults.groups.findIndex(group=>group.id==='red')<defaults.groups.findIndex(group=>group.id==='blue'));
  const saved=keywords.normalize({enabled:false,caseSensitive:true,wholeWords:true,groups:[{id:'yellow',keywords:['My own keyword']}]});
  assert.equal(saved.enabled,false);assert.equal(saved.wholeWords,true);assert.deepEqual(saved.groups.find(group=>group.id==='yellow').keywords,['My own keyword']);
  assert.deepEqual(saved.groups.find(group=>group.id==='red').keywords,[],'Defaults do not overwrite saved lists');
  const matches=keywords.findMatches('Remote: onsite travel, on-site intern certification license volunteer hybrid',defaults);
  assert.equal(matches[0].groupId,'green');assert.ok(matches.some(match=>match.groupId==='red'));assert.ok(matches.some(match=>match.groupId==='yellow'));
});

test('central prompt selection and edits reach the dock, reset safely and detach on disposal',async()=>{
  const browser=browserFixture({[PROMPT_SETTINGS_KEY]:{selectedId:'technical',templates:{technical:{text:'Preserve facts; emphasize testing.'}}}}),seen=[];
  const controller=connectPromptSettings({browser,onChange:value=>seen.push(value)});await controller.ready;
  assert.equal(seen.at(-1).selectedId,'technical');assert.equal(prompts.technical.text,'Preserve facts; emphasize testing.');
  await browser.storage.local.set({[PROMPT_SETTINGS_KEY]:{selectedId:'concise',templates:{concise:{text:'Use short factual bullets.'}}}});
  assert.equal(seen.at(-1).selectedId,'concise');assert.equal(prompts.concise.text,'Use short factual bullets.');
  const invalid=normalizePromptSettings({selectedId:'unknown',templates:{base:{text:' '},focused:{text:'x'.repeat(32001)}}});
  assert.equal(invalid.selectedId,'focused');assert.ok(invalid.templates.base.text.trim());assert.ok(invalid.templates.focused.text.length<32000);
  controller.dispose();const count=seen.length;await browser.storage.local.set({[PROMPT_SETTINGS_KEY]:{}});assert.equal(seen.length,count);
});

test('chat provider works with only the dock selector and syncs central settings without reloading frames',async()=>{
  const win=new Window(),doc=win.document;doc.body.innerHTML='<section id="chat-view" hidden></section><select id="dock-chat-provider"><option value="chatgpt">ChatGPT</option><option value="deepseek">DeepSeek</option></select><span id="dock-provider-status"></span><div id="chatgpt-pane"></div><div id="deepseek-pane"><iframe id="deepseek-frame"></iframe></div><button id="deepseek-open"></button>';
  const browser=browserFixture({chatProvider:'chatgpt'});browser.tabs={create:async()=>({})};
  const controller=createChatProviders({browser,document:doc,lazy:true});await controller.ready;
  await browser.storage.local.set({chatProvider:'deepseek'});
  assert.equal(controller.current(),'deepseek');assert.equal(doc.getElementById('dock-chat-provider').value,'deepseek');assert.equal(doc.getElementById('deepseek-pane').hidden,false);assert.equal(doc.getElementById('deepseek-frame').getAttribute('src'),null);
  controller.ensureCurrent();assert.equal(doc.getElementById('deepseek-frame').src,'https://chat.deepseek.com/');
  doc.getElementById('dock-chat-provider').value='chatgpt';doc.getElementById('dock-chat-provider').dispatchEvent(new win.Event('change'));await new Promise(resolve=>setTimeout(resolve,0));
  assert.equal((await browser.storage.local.get('chatProvider')).chatProvider,'chatgpt');
  win.dispatchEvent(new win.Event('pagehide'));win.happyDOM.abort();
});

test('central keyword edits and toolbar toggle preserve color groups and matching preferences',async()=>{
  const win=new Window(),doc=win.document;doc.body.innerHTML='<input id="highlight-keywords" type="checkbox">';
  const browser=browserFixture({keywordHighlights:{enabled:true,caseSensitive:true,wholeWords:false,groups:[{id:'blue',keywords:['React']}]}}),seen=[];
  const controller=connectKeywordPreferences({browser,root:doc,events:win,onChange:next=>seen.push(next)});await controller.ready;
  assert.equal(doc.getElementById('highlight-keywords').checked,true);
  await browser.storage.local.set({keywordHighlights:{...seen.at(-1),groups:[{id:'purple',keywords:['Node']} ]}});
  const toggle=doc.getElementById('highlight-keywords');toggle.checked=false;toggle.dispatchEvent(new win.Event('change'));await new Promise(resolve=>setTimeout(resolve,0));
  const saved=(await browser.storage.local.get('keywordHighlights')).keywordHighlights;assert.equal(saved.enabled,false);assert.equal(saved.caseSensitive,true);assert.equal(saved.wholeWords,false);assert.deepEqual(saved.groups.find(group=>group.id==='purple').keywords,['Node']);
  win.dispatchEvent(new win.Event('pagehide'));win.happyDOM.abort();
});

test('PDF previews use Studio, reuse legacy tabs and keep Word previews separate',async()=>{
  const browser=browserFixture(),updated=[],created=[];browser.tabs={query:async()=>[{id:4,url:'chrome-extension://test/ai-apply/document-preview.html?file=old&slot=resume%3Apdf'}],update:async(id,options)=>{updated.push({id,...options});},create:async options=>created.push(options)};
  await openDocumentPreview(browser,{kind:'resume',format:'pdf',key:'one/two.pdf'});
  assert.equal(updated.length,1);assert.equal(updated[0].id,4);const url=new URL(updated[0].url);assert.equal(url.pathname,'/preview.html');assert.equal(url.searchParams.get('aiFile'),'one/two.pdf');
  await openDocumentPreview(browser,{kind:'resume',format:'docx',key:'one/two.docx'});assert.equal(new URL(created[0].url).pathname,'/ai-apply/document-preview.html');
});

test('saved resume preview stores the generated PDF bytes and shares the native renderer contract',async()=>{
  const bytes=new TextEncoder().encode('%PDF-1.7\nLocal PDF preview\n'),records=new Map(),store={put:async file=>records.set(file.key,file),get:async key=>records.get(key)},browser=browserFixture();
  const request={id:'queue-job',resume:{title:'Engineer'},input:{profile:{name:'Test User'},job:{company:'Employer'}}};
  const url=new URL(await savedPDFPreview(request,{browser,store,exporter:{exportDocuments:async(run,options)=>{assert.equal(run.result.resume,request.resume);assert.deepEqual(options.kinds,['resume']);return {files:[{bytes,format:'pdf',kind:'resume',filename:'Resume.pdf'}],errors:[]};}}}));
  assert.equal(url.pathname,'/preview.html');assert.equal(url.searchParams.get('embedded'),'1');
  const {pdf,file}=await readAIApplyPDF(url.searchParams.get('aiFile'),{store,digest:data=>webcrypto.subtle.digest('SHA-256',data)});
  assert.deepEqual(Uint8Array.from(atob(pdf.base64),ch=>ch.charCodeAt(0)),bytes);assert.match(pdf.sha256,/^[a-f0-9]{64}$/);assert.equal(file.state,'preview');assert.equal(pdf.documentRevision,1);
  await assert.rejects(()=>readAIApplyPDF('missing',{store}),/unavailable/);
  records.set('wrong',{state:'complete',format:'docx',bytes});await assert.rejects(()=>readAIApplyPDF('wrong',{store}),/unavailable/);
});

test('prompt navigation resolves the current Chrome tab route and keeps external pages and frames blocked',async()=>{
  const browser=browserFixture();browser.runtime.id='test';const listeners=[];browser.runtime.onMessage={addListener:fn=>listeners.push(fn)};
  let current='chrome-extension://test/options.html#/settings/prompts',calls=0;browser.tabs={get:async()=>({url:current})};
  configurePromptSettingsBridge({browser,dispatch:async(operation,payload,sender)=>{calls++;assert.equal(sender.url,current);return {library:{selectedId:'focused'}};}});
  const sender={id:'test',url:'chrome-extension://test/options.html#/settings/other',frameId:0,tab:{id:7}},message={version:1,requestId:'navigation-test',operation:'PROMPT_SETTINGS',payload:{},settingsRoute:'#/settings/prompts'};
  const request=source=>new Promise(resolve=>{if(!listeners[0](message,source,resolve))resolve(null);});
  assert.equal((await request(sender)).ok,true);assert.equal(calls,1);
  current='chrome-extension://test/options.html#/dashboard';assert.equal((await request(sender)).ok,false);assert.equal(calls,1);
  assert.equal(await request({...sender,frameId:1}),null);assert.equal(await request({...sender,url:'https://example.test/options.html#/settings/prompts'}),null);
  assert.equal(await request({...sender,url:'chrome-extension://test/options.html#/settings/prompts'}),null,'Normal prompt documents use the existing scoped coordinator');
});

test('Profile requests after SPA navigation use the current trusted Chrome route for reads and saves',async()=>{
  const browser=browserFixture();browser.runtime.id='test';const listeners=[],calls=[];browser.runtime.onMessage={addListener:fn=>listeners.push(fn)};
  let route='chrome-extension://test/options.html#/settings/profile';browser.tabs={get:async()=>({url:route})};
  configurePromptSettingsBridge({browser,dispatch:async(operation,payload,sender)=>{calls.push({operation,payload,url:sender.url});return{candidate:{id:'single-profile'}};}});
  const sender={id:'test',url:'chrome-extension://test/options.html#/dashboard',frameId:0,tab:{id:7}},base={version:1,requestId:'profile-route',settingsRoute:'#/settings/profile'};
  const request=(operation,payload={},source=sender)=>new Promise(resolve=>{if(!listeners[0]({...base,operation,payload},source,resolve))resolve(null);});
  assert.equal((await request('PROFILE_STATE')).result.candidate.id,'single-profile');
  assert.equal((await request('PROFILE_SAVE',{expectedProfile:{},profile:{}})).ok,true);assert.equal(calls.length,2);assert.equal(calls[1].url,route);
  route='chrome-extension://test/options.html#/settings/ai/prompt';assert.equal((await request('PROFILE_SAVE')).ok,false);assert.equal(calls.length,2);
  assert.equal(await request('PROFILE_STATE',{}, {...sender,frameId:2}),null);
  assert.equal(await request('PROFILE_STATE',{}, {...sender,url:'https://example.test/options.html#/settings/profile'}),null);
});
