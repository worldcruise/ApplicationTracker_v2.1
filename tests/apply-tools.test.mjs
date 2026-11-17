import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {configureApplyTools,questionDraftPrompt,stageQuestionDraft} from '../extension/studio/apply-tools-service.js';
import {sendQuestionBatch} from '../extension/studio/question-answer-chat.js';
import {mountAutofillProfile} from '../extension/ai-apply/src/profile-editor.mjs';
import {emptyProfile} from '../extension/studio/profile-model.js';
import {connectTrackerWorkspace} from '../extension/ai-apply/src/autofill-workspace.mjs';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('profile popup edits the single canonical profile and preserves its resume and unrelated details',async t=>{
 const win=new Window();t.after(()=>win.happyDOM.abort());const original=emptyProfile();original.nameData.firstName='Original';original.resumeData.fileName='current.pdf';original.websiteData.websites=['https://preserved.test'];let saved;
 const root=win.document.createElement('main');win.document.body.append(root);
 const editor=mountAutofillProfile(root,{read:async()=>({candidate:{profile:original}}),save:async payload=>{saved=payload;return{candidate:{profile:payload.profile}};}});await editor.ready;
 const country=root.querySelector('[aria-label="Phone country code"]');assert.ok(country.options.length>200);country.value='GB';country.dispatchEvent(new win.Event('change'));const toggle=root.querySelector('.af-sidebar-toggle');toggle.click();assert.equal(root.querySelector('.af-nav').hidden,true);assert.equal(toggle.getAttribute('aria-expanded'),'false');toggle.click();assert.equal(root.querySelector('.af-nav').hidden,false);
 const first=root.querySelector('[name=firstName]');first.value='Updated';first.dispatchEvent(new win.Event('change'));
 root.querySelector('[data-section=preferences]').click();const salary=root.querySelector('[name=expectedSalary]');salary.value='$120,000';salary.dispatchEvent(new win.Event('change'));
 root.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));await flush();
 assert.equal(saved.profile.nameData.firstName,'Updated');assert.equal(saved.profile.contactData.phoneCountryCode,'+44');assert.equal(saved.profile.contactData.phoneCountry,'GB');assert.equal(saved.profile.employmentData.expectedSalary,'$120,000');assert.equal(saved.profile.resumeData.fileName,'current.pdf');assert.deepEqual(saved.profile.websiteData.websites,['https://preserved.test']);assert.equal(saved.expectedProfile.nameData.firstName,'Original');assert.match(root.querySelector('[role=status]').textContent,/Profile saved/);
});

test('required questions are selected, optional questions opt in, filled answers collapse, and bulk actions use only selected questions',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));
 const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 const fields=[{key:'required',label:'Why this role?',required:true,type:'textarea',filled:false},{key:'optional',label:'Anything else?',required:false,type:'textarea',filled:false},{key:'filled',label:'Name',type:'text',filled:true,answer:'User'}],requests=[],job={id:'one',state:'ready',resume:{},input:{job:{url:'https://employer.test'}}};
 const browser={runtime:{sendMessage:async message=>{requests.push(message);return{ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields}:message.type==='ai-apply.tools'?{staged:true}:{run:null,tabs:[{id:7,url:job.input.job.url,active:true}],defaults:{}}};}}};
 const controller=connectTrackerWorkspace({studio:{ready:Promise.resolve(),selectedJob:()=>job},queue:{subscribe:()=>()=>{}},root:win.document,events:win,browser});await flush();const doc=win.document;
 doc.querySelector('.tracker-autofill-dialog').open=true;await controller.refresh();
 const mandatory=doc.querySelector('[data-field-key=required]'),optional=doc.querySelector('[data-field-key=optional]');assert.equal(mandatory.checked,true);assert.equal(optional.checked,false);assert.equal(doc.querySelector('.tracker-filled-field').open,false);assert.equal(doc.querySelectorAll('.tracker-autofill-controls button').length,2);
 mandatory.checked=false;mandatory.dispatchEvent(new win.Event('change'));optional.checked=true;optional.dispatchEvent(new win.Event('change'));
 doc.querySelector('[data-answer-key=optional]').value='My answer';doc.querySelector('[data-answer-key=optional]').dispatchEvent(new win.Event('input'));
 doc.querySelector('[data-draft-selected]').click();await flush();const draft=requests.find(message=>message.payload?.action==='chat.draft');assert.deepEqual(draft.payload.fields.map(field=>field.key),['optional']);assert.equal(draft.payload.fields[0].answer,'My answer');
 doc.querySelector('[data-fill-selected]').click();await flush();const fill=requests.find(message=>message.operation==='DOCK_APPLY_START');assert.deepEqual(fill.payload.fieldKeys,['optional']);assert.equal(fill.payload.answers.optional,'My answer');assert.equal(fill.payload.options.autoSubmit,undefined);
 doc.querySelector('[data-profile-settings]').click();await flush();assert.ok(requests.some(message=>message.payload?.action==='profile.open'));win.dispatchEvent(new win.Event('pagehide'));
});

test('profile overlay grants bind to the employer tab and answer batches send through the AI adapter',async()=>{
 const messages=event(),sessions=memoryStorage({}),calls=[],scripts=[],tabs=new Map([[7,{id:7,windowId:41,active:true,url:'https://employer.test/apply'}]]),job={id:'one',input:{candidateId:'profile',job:{company:'Employer',role:'Engineer'},profile:{name:'Original'}}};
 const browser={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onMessage:messages},storage:{session:sessions,local:memoryStorage({})},windows:{get:async()=>({type:'normal'}),update:async()=>{}},tabs:{query:async()=>[...tabs.values()],get:async id=>tabs.get(id),create:async props=>{const tab={id:9,...props};tabs.set(9,tab);return tab;},update:async(id,props)=>Object.assign(tabs.get(id),props)},scripting:{executeScript:async request=>{scripts.push(request);return[{result:{ready:true,staged:true}}];}}};
 configureApplyTools({browser,isUI:sender=>sender.url==='chrome-extension://test/ai-apply/index.html',authorizeUI:async()=>{},dispatch:async(...args)=>{calls.push(args);return {candidate:{profile:{}}};},store:async()=>({requests:[job],profiles:[{id:'profile',data:{name:'Current'}}]})});
 const request=(payload,sender={id:'test',url:'chrome-extension://test/ai-apply/index.html'})=>new Promise(resolve=>messages.emit({type:'ai-apply.tools',payload:{windowId:41,...payload}},sender,resolve));
 assert.equal((await request({action:'profile.open'})).ok,true);const grant=sessions.values['apply-profile-overlay:v1:7'];assert.ok(grant.token);assert.equal(scripts[0].args[1],grant.token);
 const sender={id:'test',url:'chrome-extension://test/ai-apply/profile.html?token='+grant.token,tab:tabs.get(7),frameId:2};
 assert.equal((await request({action:'profile.read'},sender)).ok,true);assert.equal(calls[0][0],'DOCK_APPLY_PROFILE');assert.equal(calls[0][1].windowId,41);
 assert.equal((await request({action:'profile.save'},{...sender,url:sender.url+'bad'})).ok,false);
 assert.equal((await request({action:'chat.draft',jobId:'one',fields:[{key:'why',label:'Why this company?',filled:false}]})).ok,true);assert.equal(tabs.get(9).url,'https://chatgpt.com/');assert.match(scripts.at(-1).args[0].prompt,/Why this company/);assert.ok(!scripts.at(-1).args[0].prompt.includes('Current'));assert.equal(scripts.at(-1).func,sendQuestionBatch);
 tabs.get(7).url='https://employer.test/other';assert.equal((await request({action:'profile.read'},sender)).ok,false);
});

test('ChatGPT draft staging preserves an existing draft and never clicks Send',async t=>{
 const win=new Window();t.after(()=>win.happyDOM.abort());win.document.body.innerHTML='<textarea id="prompt-textarea"></textarea><button>Send</button>';let sent=0;win.document.querySelector('button').onclick=()=>sent++;
 const previous={document:globalThis.document,HTMLTextAreaElement:globalThis.HTMLTextAreaElement,InputEvent:globalThis.InputEvent};Object.assign(globalThis,{document:win.document,HTMLTextAreaElement:win.HTMLTextAreaElement,InputEvent:win.InputEvent});t.after(()=>Object.assign(globalThis,previous));
 assert.equal(stageQuestionDraft('Question draft').staged,true);assert.equal(win.document.querySelector('textarea').value,'Question draft');assert.equal(stageQuestionDraft('Different draft').blocked,true);assert.equal(sent,0);
 assert.throws(()=>questionDraftPrompt({input:{job:{}}},[]),/Select/);
});

test('Apply mounts safely before a job is selected',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 const controller=connectTrackerWorkspace({root:win.document,events:win,studio:{ready:Promise.resolve(),selectedJob:()=>undefined},queue:{subscribe:()=>()=>{}},browser:{runtime:{sendMessage:async()=>({ok:true,value:{run:null,tabs:[]}})}}});await controller.refresh();assert.equal(win.document.querySelector('[data-fill-start]').disabled,true);win.dispatchEvent(new win.Event('pagehide'));
});

test('the first Autofill click waits for inspection and includes known optional facts on an unprepared job',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 const job={id:'queued',state:'queued',resume:null,input:{job:{url:'https://employer.test/apply'}}},requests=[];let release;
 const fields=[{key:'email',label:'Email',type:'email',filled:false,canAutofill:true},{key:'required',label:'Why this role?',type:'textarea',filled:false,required:true},{key:'optional',label:'Other comments',type:'textarea',filled:false}];
 const browser={runtime:{sendMessage:async message=>{requests.push(message);if(message.operation==='DOCK_APPLY_INSPECT')return new Promise(resolve=>{release=()=>resolve({ok:true,value:{tabId:7,fields}});});return{ok:true,value:{run:null,tabs:[{id:7,url:job.input.job.url,active:true}],defaults:{}}};}}};
 connectTrackerWorkspace({root:win.document,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>job,prepareApplyChat:async()=>{throw Error('Chat is unavailable');}},queue:{subscribe:()=>()=>{}}});t.after(()=>win.dispatchEvent(new win.Event('pagehide')));await flush();
 const button=win.document.querySelector('[data-fill-start]');assert.equal(button.disabled,false);button.click();await flush();assert.ok(release);assert.ok(!requests.some(message=>message.operation==='DOCK_APPLY_START'));
 release();await flush();await flush();const fill=requests.find(message=>message.operation==='DOCK_APPLY_START');assert.deepEqual(fill.payload.fieldKeys,['email','required']);assert.equal(fill.payload.tabId,7);assert.equal(win.document.querySelector('.tracker-autofill-dialog').open,true);
});

test('Autofill remains visible and enabled with an empty queue and fills from the saved profile',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 win.document.querySelector('#apply-setup').hidden=true;
 const fields=[{key:'email',label:'Email',type:'email',filled:false,canAutofill:true}],requests=[];let run=null;
 const browser={runtime:{sendMessage:async message=>{requests.push(message);if(message.operation==='DOCK_APPLY_INSPECT')return{ok:true,value:{tabId:7,fields}};if(message.operation==='DOCK_APPLY_START')run={id:'profile-run',profileOnly:true,jobId:null,tabId:7,targetUrl:'https://employer.test/apply',phase:'questions',fields:fields.map(field=>({...field,filled:true,answer:'profile@example.test'}))};return{ok:true,value:{candidate:{id:'profile'},run,tabs:[{id:7,url:'https://employer.test/apply',active:true}],defaults:{}}};}}};
 connectTrackerWorkspace({root:win.document,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>undefined},queue:{subscribe:()=>()=>{}}});t.after(()=>win.dispatchEvent(new win.Event('pagehide')));await flush();
 const button=win.document.querySelector('[data-fill-start]');assert.equal(button.closest('[hidden]'),null);assert.equal(button.disabled,false);button.click();await flush();await flush();
 const fill=requests.find(message=>message.operation==='DOCK_APPLY_START');assert.equal(fill.payload.profileOnly,true);assert.equal(fill.payload.jobId,undefined);assert.equal(fill.payload.tabId,7);assert.deepEqual(fill.payload.fieldKeys,['email']);assert.equal(win.document.querySelector('[data-draft-selected]').disabled,true);
});

test('a previous filling run does not disable the current page and the click requests an atomic switch',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 const job={id:'new-job',state:'queued',input:{job:{url:'https://employer.test/jobs/new'}}},fields=[{key:'new-name',label:'First name',type:'text',filled:false,canAutofill:true}],requests=[];let run={id:'old-run',jobId:'old-job',tabId:7,phase:'filling',fields:[]};
 const browser={runtime:{sendMessage:async message=>{requests.push(message);if(message.operation==='DOCK_APPLY_INSPECT')return{ok:true,value:{tabId:8,fields}};if(message.operation==='DOCK_APPLY_START')run={id:'new-run',jobId:job.id,tabId:8,phase:'questions',fields:fields.map(field=>({...field,filled:true,answer:'Jordan'}))};return{ok:true,value:{candidate:{id:'profile'},run,tabs:[{id:8,url:job.input.job.url,active:true}],defaults:{}}};}}};
 connectTrackerWorkspace({root:win.document,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>job},queue:{subscribe:()=>()=>{}}});t.after(()=>win.dispatchEvent(new win.Event('pagehide')));await flush();
 const button=win.document.querySelector('[data-fill-start]');assert.equal(button.disabled,false);assert.doesNotMatch(win.document.querySelector('.tracker-autofill-status').textContent,/Another application/);assert.ok(!requests.some(message=>message.operation==='DOCK_APPLY_START'));
 button.click();await flush();await flush();const start=requests.find(message=>message.operation==='DOCK_APPLY_START');assert.equal(start.payload.replaceRunId,'old-run');assert.equal(start.payload.tabId,8);assert.deepEqual(start.payload.fieldKeys,['new-name']);assert.ok(!requests.some(message=>message.payload?.action==='cancel'));
});

test('AI replies return to their question inputs, preserve manual edits and feed Fill all only when requested',async t=>{
 const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41'});t.after(()=>win.happyDOM.abort());win.document.write(await readFile('extension/ai-apply/index.html','utf8'));const previous=globalThis.document;globalThis.document=win.document;t.after(()=>globalThis.document=previous);
 const fields=[{key:'first',label:'First question',type:'textarea',required:true,filled:false},{key:'second',label:'Second question',type:'textarea',required:true,filled:false}],requests=[],job={id:'one',state:'ready',resume:{},input:{job:{url:'https://employer.test'}}};let complete=false,fillRun=null;
 const browser={runtime:{sendMessage:async message=>{requests.push(message);let value;
   if(message.type==='ai-apply.tools')value=message.payload.action==='chat.draft'?{id:'batch',phase:'waiting'}:complete?{phase:'complete',answers:[{id:'first',answer:'AI first',needsUser:false},{id:'second',answer:'AI second',needsUser:false}]}:{phase:'waiting'};
   else {if(message.operation==='DOCK_APPLY_START')fillRun={id:'fill-run',jobId:job.id,tabId:7,phase:'filling',fields};value=message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields}:{run:fillRun,tabs:[{id:7,url:job.input.job.url,active:true}],defaults:{}};}
   return {ok:true,value};}}};
 let tick;win.setInterval=callback=>{tick=callback;return 1;};
 const controller=connectTrackerWorkspace({studio:{ready:Promise.resolve(),selectedJob:()=>job},queue:{subscribe:()=>()=>{}},root:win.document,events:win,browser});t.after(()=>win.dispatchEvent(new win.Event('pagehide')));await flush();
 const popup=win.document.querySelector('.tracker-autofill-dialog');assert.equal(popup.open,false);win.document.querySelector('[data-open-autofill]').click();await flush();assert.equal(popup.open,true);await controller.refresh();win.document.querySelector('[data-close-autofill]').click();assert.equal(popup.open,false);win.document.querySelector('[data-open-autofill]').click();await flush();
 win.document.querySelector('[data-draft-selected]').click();await flush();assert.equal(win.document.querySelector('[data-draft-selected]').disabled,true);await controller.refresh();
 assert.equal(JSON.parse(win.sessionStorage.getItem('tracker-answer-batch:41')).id,'batch');
 const manual=win.document.querySelector('[data-answer-key=first]');manual.value='My manual answer';manual.dispatchEvent(new win.Event('input'));manual.focus();complete=true;
 Object.defineProperty(win.document,'hidden',{configurable:true,value:true});tick();await flush();assert.equal(win.document.activeElement,manual);assert.equal(win.sessionStorage.getItem('tracker-answer-batch:41'),null);
 assert.equal(win.document.querySelector('[data-answer-key=first]').value,'My manual answer');assert.equal(win.document.querySelector('[data-answer-key=second]').value,'AI second');assert.equal(win.document.querySelector('[data-draft-selected]').disabled,false);assert.ok(!requests.some(message=>message.operation==='DOCK_APPLY_START'));
 const alert=win.document.querySelector('.tracker-answer-alert');assert.equal(alert.getAttribute('role'),'alert');assert.match(alert.textContent,/1 AI answers ready for review/);assert.ok(alert.parentElement===popup);win.document.querySelector('[data-close-autofill]').click();await flush();assert.ok(alert.parentElement===win.document.querySelector('#apply-actions'));win.document.querySelector('[data-open-autofill]').click();await flush();assert.ok(alert.parentElement===popup);
 assert.equal(win.document.querySelector('.tracker-autofill-notice').hidden,true);assert.ok(!win.document.querySelector('.tracker-autofill-status').textContent.includes('ready for review'));
 win.document.querySelector('[data-fill-selected]').click();await flush();const fill=requests.find(message=>message.operation==='DOCK_APPLY_START');assert.deepEqual(fill.payload.answers,{first:'My manual answer',second:'AI second'});assert.equal(popup.open,true);assert.ok(win.document.querySelector('.tracker-answer-alert'));fillRun={...fillRun,phase:'ready',fields:fields.map(field=>({...field,filled:true}))};await controller.refresh();assert.equal(popup.open,false);assert.equal(win.document.querySelector('.tracker-answer-alert'),null);
});
