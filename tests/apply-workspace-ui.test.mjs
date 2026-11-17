import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createApplyJobs} from '../extension/ai-apply/src/apply-jobs.mjs';
import {autofillPresentation,connectTrackerWorkspace} from '../extension/ai-apply/src/autofill-workspace.mjs';
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

test('autofill observes the matched job on load; a user click fills, exposes grouped fields, and keeps typed answers on refresh',async t=>{
  const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;});
  const selected=job('one','https://employer.test/a'),requests=[];let run=null,chatPreparations=0;
  const browser={runtime:{getURL:path=>'chrome-extension://test/'+path,sendMessage:async message=>{requests.push(message);if(message.operation==='DOCK_APPLY_INSPECT')return{ok:true,value:{tabId:7,fields:run?run.fields:[{key:'site-name',label:'Employer first name',type:'text',answer:'Already entered',filled:true},{key:'site-why',label:'Employer question',type:'textarea',answer:'',filled:false}]}};if(message.operation==='DOCK_APPLY_START')run={id:'run',jobId:'one',tabId:7,phase:'questions',fields:[{key:'name',label:'Full name',type:'text',filled:true,answer:'Test User'},{key:'why',label:'Why this role?',type:'textarea',kind:'ai',required:true,filled:false}],drafts:{}};return{ok:true,value:{run,tabs:[{id:7,url:selected.input.job.url,active:true}],defaults:{}}};}}};
  const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected,prepareApplyChat:()=>{chatPreparations++;return Promise.resolve();}},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});await flush();
  assert.ok(requests.length>0);assert.ok(requests.every(message=>['DOCK_APPLY_STATE','DOCK_APPLY_TRACK'].includes(message.operation)));assert.equal(root.querySelector('.tracker-field-group'),null);assert.equal(root.querySelector('.tracker-autofill-dialog').open,false);assert.ok(root.querySelector('[data-fill-start]'));assert.ok(root.querySelector('#apply-open-chat'));assert.ok(root.querySelector('.apply-documents').compareDocumentPosition(root.querySelector('#apply-actions'))&4);
  root.querySelector('.tracker-autofill-dialog').open=true;await controller.refresh();assert.equal(requests.filter(message=>message.operation==='DOCK_APPLY_START').length,0);assert.ok(root.querySelector('.tracker-field-group').textContent.includes('Employer first name'));assert.equal(root.querySelector('.tracker-filled-field textarea').value,'Already entered');assert.equal(root.querySelector('.tracker-profile-link'),null);assert.ok(root.querySelector('#apply-open-job #apply-site'));assert.ok(root.querySelector('#apply-open-job #apply-tab-state'));assert.ok(root.querySelector('#apply-open-job').compareDocumentPosition(root.querySelector('#apply-open-chat'))&4);assert.equal(chatPreparations,0);assert.equal(root.querySelector('#apply-open-chat').textContent.trim(),'');
  root.querySelector('[data-fill-start]').click();await flush();assert.equal(requests.filter(message=>message.operation==='DOCK_APPLY_START').length,1);assert.equal(chatPreparations,1);assert.equal(root.querySelector('.tracker-autofill-progress').getAttribute('aria-valuenow'),'50');
  const input=root.querySelector('.tracker-question textarea');input.value='Keep my answer';input.dispatchEvent(new win.Event('input'));input.focus();await controller.refresh();assert.equal(root.querySelector('.tracker-question textarea'),input);assert.equal(input.value,'Keep my answer');assert.equal(root.querySelector('[data-autofill-label]').textContent,'Autofill again');
  input.blur();run={...run,fields:[]};await controller.refresh();assert.equal(root.querySelector('[data-fill-start]').disabled,false);root.querySelector('[data-fill-start]').click();await flush();assert.ok(requests.some(message=>message.operation==='DOCK_APPLY_ACTION'&&message.payload.action==='rescan'));
  win.dispatchEvent(new win.Event('pagehide'));
});

test('header opens the local profile, preserves its initial, and saves the shared theme',async()=>{
  const win=new Window(),doc=win.document;doc.documentElement.dataset.theme='light';doc.body.innerHTML='<div id="at-reference-dock"><header class="rd-header"><span class="rd-person"><span class="rd-avatar" id="rd-avatar">T</span></span></header></div>';
  const changed=event(),routes=[],browser={storage:{onChanged:changed,local:memoryStorage({},changed,'local')}};
  const header=mountNativePanelHeader(doc.querySelector('#at-reference-dock'),{browser,navigate:async route=>routes.push(route)});await header.ready;
  const account=doc.querySelector('.native-account-button'),theme=doc.querySelector('.native-theme-toggle');assert.equal(account.getAttribute('aria-label'),'Profile settings');account.click();await flush();assert.deepEqual(routes,['/settings/profile']);
  theme.click();await flush();assert.equal((await browser.storage.local.get('ui-theme:v1'))['ui-theme:v1'],'dark');assert.equal(doc.querySelector('#rd-avatar').textContent,'T');
  header.close();win.happyDOM.abort();
});

test('live employer changes refresh other fields while preserving the focused draft and collapsing completed answers',async t=>{
  const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
  const selected=job('one','https://employer.test/a');
  let fields=[{key:'email',label:'Email',type:'email',filled:false,answer:'',required:true},{key:'why',label:'Why this role?',kind:'ai',type:'textarea',filled:false,answer:'',required:true}];
  const run={id:'run',jobId:'one',tabId:7,phase:'questions',fields:structuredClone(fields),drafts:{},pageRevision:0};
  const browser={runtime:{sendMessage:async message=>message.operation==='DOCK_APPLY_INSPECT'?{ok:true,value:{tabId:7,fields:structuredClone(fields)}}:{ok:true,value:{run:structuredClone(run),candidate:{id:'one'},tabs:[{id:7,url:selected.input.job.url,active:true}]}}}};
  const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});await flush();root.querySelector('.tracker-autofill-dialog').open=true;await controller.refresh();
  const input=root.querySelector('[data-answer-key="why"]');input.value='My unsent answer';input.dispatchEvent(new win.Event('input'));input.focus();input.setSelectionRange(3,8);
  fields[0]={...fields[0],filled:true,answer:'edited@employer.test'};fields.push({key:'start',label:'Start date',type:'text',filled:false,answer:'',required:true});
  await controller.refresh();assert.equal(root.querySelector('[data-answer-key="why"]'),input);assert.equal(input.value,'My unsent answer');assert.equal(input.selectionStart,3);assert.ok(root.querySelector('[data-answer-key="start"]'));assert.equal(root.querySelector('[data-answer-key="email"]'),null);assert.equal(root.querySelector('.tracker-filled-field textarea').value,'edited@employer.test');assert.equal(root.querySelector('.tracker-autofill-status').textContent,'1 of 3 fields filled');
  fields[1]={...fields[1],filled:true,answer:'Answer typed directly on the employer page'};await controller.refresh();assert.equal(root.querySelector('[data-answer-key="why"]'),null);assert.ok([...root.querySelectorAll('.tracker-filled-field textarea')].some(node=>node.value===fields[1].answer));
  fields[1]={...fields[1],filled:false,answer:''};await controller.refresh();assert.equal(root.querySelector('[data-answer-key="why"]').value,'','clearing the employer answer must not restore an obsolete draft');
  fields=fields.filter(field=>field.key!=='start');await controller.refresh();assert.equal(root.querySelector('[data-answer-key="start"]'),null);assert.equal(root.querySelector('.tracker-autofill-status').textContent,'1 of 2 fields filled');
});

test('the Autofill popup follows the active employer tab instead of inspecting the previous run tab',async t=>{
  const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
  const selected=job('one','https://employer.test/a'),requests=[];let activeTab=7;
  const run={id:'run',jobId:'one',tabId:7,phase:'questions',fields:[],drafts:{}};
  const browser={runtime:{sendMessage:async message=>{requests.push(message);return message.operation==='DOCK_APPLY_INSPECT'?{ok:true,value:{tabId:message.payload.tabId,fields:[{key:'document-'+message.payload.tabId+':field',label:'Question on tab '+message.payload.tabId,type:'text',required:true,filled:false,answer:''}]}}:{ok:true,value:{run,candidate:{id:'one'},tabs:[{id:7,url:selected.input.job.url,active:activeTab===7},{id:8,url:'https://another.test/apply',active:activeTab===8}]}};}}};
  const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});await flush();root.querySelector('.tracker-autofill-dialog').open=true;await controller.refresh();
  const input=root.querySelector('[data-answer-key]');input.value='Only for the first page';input.dispatchEvent(new win.Event('input'));input.focus();activeTab=8;await controller.refresh();
  assert.equal(requests.findLast(message=>message.operation==='DOCK_APPLY_INSPECT').payload.tabId,8);assert.equal(root.querySelector('[data-answer-key]').dataset.answerKey,'document-8:field');assert.equal(root.querySelector('[data-answer-key]').value,'');assert.equal(root.querySelector('[data-answer-key="document-7:field"]'),null);
});

test('platform submission progress appears in the dock without an Autofill run and clears when changing employers',async t=>{
  const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
  let active=7,submission={tabId:7,metadata:{jobLink:'https://job-boards.greenhouse.io/acme/jobs/123'},phase:'form',message:'Review application'};
  const browser={runtime:{sendMessage:async message=>({ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?{tabId:active,fields:[]}:{run:null,submission,candidate:{id:'profile'},tabs:[{id:active,url:active===7?submission.metadata.jobLink:'https://another.test/application',active:true}]}})}};
  const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>undefined},queue:{subscribe:()=>()=>{}},selectView:()=>{},selectStudioTab:()=>{}});await flush();await controller.refresh();assert.equal(root.querySelector('.tracker-autofill-status').textContent,'Review application');
  submission={...submission,phase:'submitting',message:'Submitting application…'};await controller.refresh();assert.equal(root.querySelector('.tracker-autofill-status').textContent,submission.message);assert.equal(root.querySelector('[data-fill-start]').disabled,true);
  submission={...submission,phase:'submitted',message:'Application submitted and recorded.'};await controller.refresh();assert.equal(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');
  active=8;await controller.refresh();assert.notEqual(root.querySelector('.tracker-autofill-status').textContent,submission.message);assert.equal(root.querySelector('[data-fill-start]').disabled,false);
});

test('the popup renders one single-choice dropdown and one multi-choice editor and sends every selected value together',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 const selected=job('one','https://employer.test/a'),requests=[];let fields=[{key:'state',label:'State',type:'select-one',multiple:false,required:true,filled:false,answer:'',options:[{value:'TX',label:'Texas'},{value:'OR',label:'Oregon'}]},{key:'work',label:'Work arrangements',type:'select-multiple',multiple:true,required:true,filled:false,answer:'',answerValues:[],options:[{value:'remote',label:'Remote'},{value:'hybrid',label:'Hybrid'},{value:'onsite',label:'Onsite',disabled:true}]}];
 const run={id:'run',jobId:'one',tabId:7,phase:'questions',fields:[],drafts:{}};
 const browser={runtime:{sendMessage:async message=>{requests.push(message);return{ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields:structuredClone(fields)}:{run:structuredClone(run),candidate:{id:'one'},tabs:[{id:7,url:selected.input.job.url,active:true}]}};}}};
 const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});await flush();root.querySelector('.tracker-autofill-dialog').open=true;await controller.refresh();
 assert.equal(root.querySelectorAll('.tracker-question').length,2);assert.equal(root.querySelector('[data-answer-key="state"]').multiple,false);const input=root.querySelector('[data-answer-key="work"]');assert.equal(input.multiple,true);assert.equal(input.options[2].disabled,true);input.options[0].selected=true;input.options[1].selected=true;input.dispatchEvent(new win.Event('change'));await controller.refresh();assert.deepEqual([...root.querySelector('[data-answer-key="work"]').selectedOptions].map(option=>option.value),['remote','hybrid']);
 root.querySelector('[data-fill-selected]').click();await flush();const fill=requests.findLast(message=>message.operation==='DOCK_APPLY_ACTION');assert.equal(fill.payload.answers.work,'["remote","hybrid"]');assert.equal(fill.payload.answers.state,'');
 fields[1]={...fields[1],filled:true,answer:'Remote, Hybrid',answerValues:['remote','hybrid']};await controller.refresh();assert.equal(root.querySelector('[data-answer-key="work"]'),null);assert.equal(root.querySelector('.tracker-filled-field textarea').value,'Remote, Hybrid');
});

test('needs-input alerts update as answers are entered, cleared, or filled directly on the employer page',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 const selected=job('one','https://employer.test/jobs/123');let fields=[{key:'text',label:'Additional information',type:'textarea',required:true,filled:false,answer:''},{key:'choices',label:'Work arrangements',type:'select-multiple',multiple:true,required:true,filled:false,answer:'',answerValues:[],options:[{value:'remote',label:'Remote'},{value:'hybrid',label:'Hybrid'}]}],complete=false,tick;
 win.setInterval=callback=>{tick=callback;return 1;};
 const browser={runtime:{sendMessage:async message=>({ok:true,value:message.type==='ai-apply.tools'?message.payload.action==='chat.draft'?{id:'batch'}:complete?{phase:'complete',answers:fields.map(field=>({id:field.key,answer:'',needsUser:true}))}:{phase:'waiting'}:message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields:structuredClone(fields)}:{run:null,candidate:{id:'profile'},tabs:[{id:7,url:selected.input.job.url,active:true}]}})}};
 const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{}}});await flush();root.querySelector('[data-open-autofill]').click();await flush();await controller.refresh();root.querySelector('[data-draft-selected]').click();await flush();complete=true;tick();await flush();assert.match(root.querySelector('.tracker-answer-alert').textContent,/2 Answers need your input/);
 const input=root.querySelector('[data-answer-key="text"]');input.value='My answer';input.dispatchEvent(new win.Event('input'));assert.match(root.querySelector('.tracker-answer-alert').textContent,/1 Answers need your input/);
 const choices=root.querySelector('[data-answer-key="choices"]');choices.options[0].selected=true;choices.dispatchEvent(new win.Event('change'));assert.equal(root.querySelector('.tracker-answer-alert'),null);
 choices.options[0].selected=false;choices.dispatchEvent(new win.Event('change'));assert.match(root.querySelector('.tracker-answer-alert').textContent,/1 Answers need your input/);
 root.querySelector('[data-close-autofill]').click();fields[1]={...fields[1],filled:true,answer:'Hybrid',answerValues:['hybrid']};await controller.refresh();assert.equal(root.querySelector('.tracker-answer-alert'),null);root.querySelector('[data-open-autofill]').click();await flush();const currentInput=root.querySelector('[data-answer-key="text"]');currentInput.value='';currentInput.dispatchEvent(new win.Event('input'));assert.match(root.querySelector('.tracker-answer-alert').textContent,/1 Answers need your input/);
 fields[0]={...fields[0],filled:true,answer:'Answer entered on the employer page'};await controller.refresh();assert.equal(root.querySelector('.tracker-answer-alert'),null);
});

test('a completed profile-only run shows submitted on its confirmation page and stops scanning for absent fields',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 let url='https://employer.test/jobs/123/apply',run={id:'profile-run',profileOnly:true,tabId:7,listingUrl:url,targetUrl:url,phase:'questions',fields:[],drafts:{}};const requests=[];
 const browser={runtime:{sendMessage:async message=>{requests.push(message);return{ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields:[]}:{run:structuredClone(run),candidate:{id:'profile'},tabs:[{id:7,url,active:true}]}};}}};
 const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>null},queue:{subscribe:()=>()=>{}}});await flush();root.querySelector('[data-open-autofill]').click();await flush();await controller.refresh();assert.match(root.querySelector('.tracker-questions').textContent,/No application fields detected/);
 url='https://employer.test/thank-you';run={...run,phase:'submitted',targetUrl:url,visitedUrls:[run.listingUrl,url]};const inspections=requests.filter(message=>message.operation==='DOCK_APPLY_INSPECT').length;await controller.refresh();assert.equal(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');assert.equal(root.querySelector('[data-autofill-label]').textContent,'Submitted');assert.equal(root.querySelector('[data-fill-start]').disabled,true);assert.equal(root.querySelector('.tracker-questions').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-autofill-controls').hidden,true);assert.equal(requests.filter(message=>message.operation==='DOCK_APPLY_INSPECT').length,inspections);
 url='https://employer.test/jobs/456/apply';await controller.refresh();assert.notEqual(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');assert.equal(root.querySelector('[data-fill-start]').disabled,false);
});

test('confirmed platform submission replaces the empty form message without a run and does not restart observation',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 const selected=job('one','https://job-boards.greenhouse.io/acme/jobs/123'),requests=[];let url=selected.input.job.url,phase='submitting';
 const browser={runtime:{sendMessage:async message=>{requests.push(message);return{ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?{tabId:7,fields:[]}:{run:null,submission:{tabId:7,phase,url:selected.input.job.url,metadata:{jobLink:selected.input.job.url},message:phase==='submitted'?'Application submitted and recorded.':'Submitting application…'},candidate:{id:'profile'},tabs:[{id:7,url,active:true}]}};}}};
 const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{}}});await flush();root.querySelector('[data-open-autofill]').click();await flush();await controller.refresh();assert.match(root.querySelector('.tracker-questions').textContent,/Submitting application/);assert.doesNotMatch(root.querySelector('.tracker-questions').textContent,/No application fields detected/);
 phase='submitted';url='https://job-boards.greenhouse.io/thank-you';const tracks=requests.filter(message=>message.operation==='DOCK_APPLY_TRACK').length;await controller.refresh();assert.equal(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-questions').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-autofill-controls').hidden,true);assert.equal(requests.filter(message=>message.operation==='DOCK_APPLY_TRACK').length,tracks);
 url=selected.input.job.url;await controller.refresh();assert.equal(requests.filter(message=>message.operation==='DOCK_APPLY_TRACK').length,tracks);url='https://job-boards.greenhouse.io/acme/jobs/456';await controller.refresh();assert.notEqual(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');
});

test('submission finishing during Autofill inspection prevents the empty-form error and stops periodic tracking',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 const selected=job('one','https://employer.test/jobs/123'),requests=[];let submitted=false,tick;
 win.setInterval=callback=>{tick=callback;return 1;};
 const browser={runtime:{sendMessage:async message=>{requests.push(message);if(message.operation==='DOCK_APPLY_INSPECT'){submitted=true;return{ok:true,value:{tabId:7,fields:[]}};}return{ok:true,value:{run:null,candidate:{id:'profile'},submission:submitted?{tabId:7,phase:'submitted',url:selected.input.job.url,metadata:{jobLink:selected.input.job.url}}:null,tabs:[{id:7,url:selected.input.job.url,active:true}]}};}}};
 connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{}}});await flush();root.querySelector('[data-fill-start]').click();await flush();await flush();
 assert.equal(root.querySelector('.tracker-autofill-status').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-questions').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-autofill-notice').hidden,true);assert.ok(!requests.some(message=>message.operation==='DOCK_APPLY_START'||message.operation==='DOCK_APPLY_ACTION'));
 const count=requests.length;tick();await flush();assert.equal(requests.length,count);
});

test('a confirmation receipt found by inspection hides empty-form help and fill controls without a saved run',async t=>{
 const win=await workspace(t),root=win.document,previous=globalThis.document;globalThis.document=root;t.after(()=>{globalThis.document=previous;win.dispatchEvent(new win.Event('pagehide'));});
 const url='https://apply.workable.com/acme/j/ABC/';let scans=0;
 const browser={runtime:{sendMessage:async message=>({ok:true,value:message.operation==='DOCK_APPLY_INSPECT'?(scans++,{tabId:7,url,fields:[],submissionConfirmed:true}):{run:null,candidate:{id:'profile'},tabs:[{id:7,url,active:true}]}})}};
 const controller=connectTrackerWorkspace({root,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>null},queue:{subscribe:()=>()=>{}}});await flush();root.querySelector('[data-open-autofill]').click();await flush();await controller.refresh();assert.equal(root.querySelector('.tracker-questions').textContent,'Application submitted');assert.equal(root.querySelector('.tracker-autofill-controls').hidden,true);assert.equal(root.querySelector('[data-fill-start]').disabled,true);const count=scans;await controller.refresh();assert.equal(scans,count);
});
