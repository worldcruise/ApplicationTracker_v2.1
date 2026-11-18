import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {readFile} from 'node:fs/promises';
import {configureApplyTools,questionDraftPrompt,stageQuestionDraft} from '../extension/studio/apply-tools-service.js';
import {sendQuestionBatch} from '../extension/studio/question-answer-chat.js';
import {mountAutofillProfile} from '../extension/ai-apply/src/profile-editor.mjs';
import {emptyProfile} from '../extension/studio/profile-model.js';
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
