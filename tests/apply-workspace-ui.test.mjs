import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createApplyJobs} from '../extension/ai-apply/src/apply-jobs.mjs';
import {autofillPresentation} from '../extension/ai-apply/src/autofill-workspace.mjs';
import {mountNativePanelHeader} from '../extension/studio/native-panel-header.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
async function workspace(t){const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41&nonce=test'});win.document.write(await readFile('extension/ai-apply/index.html','utf8'));t.after(()=>win.happyDOM.abort());return win;}
function job(id,url,state='ready'){return{id,updatedAt:'2026-11-10',state,resume:state==='ready'?{}:null,input:{job:{company:'Employer '+id,role:'Engineer',url},profile:{name:'Test User',contact:{email:'test@example.com',phone:'123'}}}};}

test('webpage matching shows the queued card without filling, includes unprepared jobs, and respects explicit selection',async t=>{
  const win=await workspace(t),root=win.document,changes=[],view=createApplyJobs({root,onSelectionChange:item=>changes.push(item?.id)}),a=job('a','https://employer.test/a'),b=job('b','https://employer.test/b','queued');
  const state={candidate:{id:'one',name:'Test'},jobs:[a,b],pending:new Set(),currentTabUrl:'https://employer.test/b?utm_source=mail'};
  view.render(state);assert.equal(view.selected().id,'b');assert.equal(root.querySelector('#apply-company').textContent,'Employer b');assert.equal(root.querySelector('.apply-job-picker').hidden,false);assert.equal(root.querySelector('#apply-resume').disabled,true);
  assert.equal(root.querySelector('#apply-update').disabled,false,'An unprepared job can accept manually generated JSON');
  assert.equal(root.querySelector('#apply-copy').dataset.request,'b');assert.equal(root.querySelector('#apply-copy').textContent.trim(),'Copy');
  view.render({...state,pending:new Set(['copy-prompt:b'])});assert.equal(root.querySelector('#apply-copy').disabled,true);
  view.select('a');view.render(state);assert.equal(view.selected().id,'a','A manual choice stays selected on the same webpage');
  view.render({...state,currentTabUrl:'https://employer.test/a'});assert.equal(view.selected().id,'a');
  view.render({...state,currentTabUrl:'https://employer.test/b'});assert.equal(view.selected().id,'b');
});

test('autofill header permits retries and switching from a previous application',()=>{
  const selected=job('one','https://employer.test/a');
  assert.equal(autofillPresentation(selected,null).label,'Autofill');
  assert.equal(autofillPresentation(selected,{jobId:'one',phase:'questions',fields:[]}).disabled,false,'No fields must not permanently disable the action');
  assert.equal(autofillPresentation(selected,{jobId:'one',phase:'paused',fields:[]}).label,'Resume');
  const filled=autofillPresentation(selected,{jobId:'one',phase:'ready',fields:[{filled:true},{filled:false}]});assert.equal(filled.status,'1 of 2 fields filled');assert.equal(filled.label,'Autofill again');
  for(const phase of ['ready','questions','paused','error','filling','drafting','submission-pending'])assert.equal(autofillPresentation(selected,{jobId:'another',phase}).disabled,false,phase+' on another application must not lock this page');
  assert.equal(autofillPresentation(selected,{jobId:'one',tabId:7,phase:'filling'},8).disabled,false,'A second tab can take over the same saved job');
  assert.equal(autofillPresentation(selected,{jobId:'one',tabId:7,phase:'filling'},7).disabled,true,'The current fill still prevents duplicate clicks');
  const queued=autofillPresentation(job('not-ready','https://employer.test/b','queued'),null);assert.equal(queued.disabled,false);assert.equal(queued.status,'Ready to fill saved profile details');
});

test('saved document buttons depend on each document rather than the generation or salary status',async t=>{
  const win=await workspace(t),root=win.document,view=createApplyJobs({root}),saved=job('saved','https://employer.test/job','attention');
  saved.resume={title:'Saved resume'};saved.coverLetterEnabled=true;saved.coverLetter='Saved cover letter';
  const value={candidate:{id:'one',name:'Test'},jobs:[saved],pending:new Set(),currentTabUrl:saved.input.job.url};
  view.render(value);assert.equal(root.querySelector('#apply-download').disabled,false);assert.equal(root.querySelector('#apply-letter-download').disabled,false);assert.equal(root.querySelector('#apply-resume').disabled,false);
  view.render({...value,jobs:[{...saved,resume:null}]});assert.equal(root.querySelector('#apply-download').disabled,true);assert.equal(root.querySelector('#apply-letter-download').disabled,false,'a saved letter can download independently');
  view.render({...value,jobs:[{...saved,documentsStale:true}]});assert.equal(root.querySelector('#apply-download').disabled,true);assert.equal(root.querySelector('#apply-letter-download').disabled,true);
  view.render({...value,pending:new Set(['download-resume:saved'])});assert.equal(root.querySelector('#apply-download').disabled,true);assert.equal(root.querySelector('#apply-letter-download').disabled,false);
});

test('header opens the local profile, preserves its initial, and saves the shared theme',async()=>{
  const win=new Window(),doc=win.document;doc.documentElement.dataset.theme='light';doc.body.innerHTML='<div id="at-reference-dock"><header class="rd-header"><span class="rd-person"><span class="rd-avatar" id="rd-avatar">T</span></span></header></div>';
  const changed=event(),routes=[],browser={storage:{onChanged:changed,local:memoryStorage({},changed,'local')}};
  const header=mountNativePanelHeader(doc.querySelector('#at-reference-dock'),{browser,navigate:async route=>routes.push(route)});await header.ready;
  const account=doc.querySelector('.native-account-button'),theme=doc.querySelector('.native-theme-toggle');assert.equal(account.getAttribute('aria-label'),'Profile settings');account.click();await flush();assert.deepEqual(routes,['/settings/profile']);
  theme.click();await flush();assert.equal((await browser.storage.local.get('ui-theme:v1'))['ui-theme:v1'],'dark');assert.equal(doc.querySelector('#rd-avatar').textContent,'T');
  header.close();win.happyDOM.abort();
});
