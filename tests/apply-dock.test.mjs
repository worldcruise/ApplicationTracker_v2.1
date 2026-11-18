import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { applyFixture } from './helpers/apply-dock-fixture.mjs';
import { mountDockDashboard } from '../extension/studio/dock-dashboard-view.js';
import { DOCK_APPLY_OPERATIONS } from '../extension/studio/dock-apply-service.js';
import { DASHBOARD_OPERATIONS } from '../extension/studio/reference-dashboard-access.js';

async function until(check){for(let i=0;i<80;i++){if(await check())return;await delay(10);}throw Error('Expected application state did not arrive.');}
test('Apply excludes stale resumes and removes a job when its status stops being Ready',async t=>{
  const app=await applyFixture(t),ready=await app.ready(await app.create('ready')),stale=await app.ready(await app.create('stale')),failed=await app.create('failed');
  await app.mutate('fail',failed);
  const key='dock-job-records:v1',saved=(await app.storage.get(key))[key];saved.jobs.find(job=>job.id===stale.id).resume.inputRevision=0;await app.storage.set({[key]:saved});
  assert.deepEqual((await app.request('DOCK_APPLY_STATE')).jobs.map(job=>job.id),[ready.id]);
  await app.mutate('update',ready,{...ready,description:'Changed job description'});
  assert.equal((await app.request('DOCK_APPLY_STATE')).jobs.length,0);
});

test('dock answers fill real questions, remember only approved facts, and record a confirmed application once',async t=>{
  const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());
  await app.start(job);await app.settled();let {run}=await app.request('DOCK_APPLY_STATE');
  const why=run.questions.find(field=>field.kind==='ai'),availability=run.questions.find(field=>field.kind==='fact');
  let result;const reviewedAnswer='My reviewed answer';
  assert.equal(employer.page.document.querySelector('[name="why"]').value,'');
  result=await app.action(run,'fill-answer',{fieldKey:why.key,answer:reviewedAnswer});
  result=await app.action(run,'fill-answer',{fieldKey:availability.key,answer:'Two weeks',remember:true});run=result.run;
  assert.equal(run.phase,'ready');assert.equal(employer.page.document.querySelector('[name="availability"]').value,'Two weeks');
  assert.ok((await app.storage.get('dock-approved-answers:v1:candidate-1'))['dock-approved-answers:v1:candidate-1']);
  assert.equal(employer.submits(),0);
});

test('pause and cancel stop delayed form writes, and restarting the worker preserves an interrupted run',async t=>{
  const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());
  let release,waiting=false;const send=app.browser.tabs.sendMessage;
  app.browser.tabs.sendMessage=async(...args)=>{if(args[1].action==='fill'){waiting=true;await new Promise(resolve=>{release=resolve;});}return send(...args);};
  const {run}=await app.start(job);await until(()=>waiting);
  await app.action(run,'pause');release();await app.settled();assert.equal(employer.page.document.querySelector('[name="firstName"]').value,'');
  app.browser.tabs.sendMessage=send;await app.action(run,'resume');await app.settled();assert.equal(employer.page.document.querySelector('[name="firstName"]').value,'Jordan');
  await app.action(run,'cancel');await assert.rejects(app.action(run,'fill-answer',{fieldKey:'missing',answer:'Wrong run'}),/rescan this application/);
  app.restart();assert.equal((await app.request('DOCK_APPLY_STATE')).run.phase,'cancelled');
});

test('recording refuses a profile changed after starting; changed jobs can fill facts without attaching stale documents',async t=>{
  const app=await applyFixture(t);app.employer();const job=await app.ready(await app.create());await app.start(job);await app.settled();const {run}=await app.request('DOCK_APPLY_STATE');
  app.bumpProfile();await assert.rejects(app.action(run,'confirm-submission'),/profile or prepared resume changed/);assert.equal(app.browser.storage.local.values.appliedList.length,1);
  await app.action(run,'cancel');await app.mutate('update',job,{url:job.url,description:'Different input',notes:'',conversationUrl:''});
  const page=app.employer();await app.start(job);const next=await app.settled();assert.notEqual(next.phase,'error');
  assert.equal(page.page.document.querySelector('[name=firstName]').value,'Jordan');assert.equal(page.uploads(),0);assert.equal(app.browser.storage.local.values.appliedList.length,1);
});

test('autofill accepts the offscreen renderer response envelope',async t=>{
  const app=await applyFixture(t),employer=app.employer();
  const renderer=app.serviceDeps.renderSnapshot;
  app.serviceDeps.renderSnapshot=async snapshot=>({stale:false,result:await renderer(snapshot)});app.restart();
  const job=await app.ready(await app.create());await app.start(job);const run=await app.settled();
  assert.notEqual(run.phase,'error');assert.equal(employer.page.document.querySelector('input[name=firstName]').value,'Jordan');assert.equal(employer.uploads(),1);
});

test('Dashboard Apply to Job opens the template in place and preserves Dashboard navigation',async t=>{
  const app=await applyFixture(t);app.employer();
  const page=new Window({settings:{disableIframePageLoading:true}}),host=page.document.createElement('div');page.document.body.append(host);
  app.browser.runtime.sendMessage=async message=>({ok:true,result:message.operation==='DASHBOARD_STATE'?{candidate:await app.deps.profiles.bootstrap(),candidates:[]}:await app.recordsRequest(message.operation,message.payload)});
  const dock=mountDockDashboard(host,{browser:app.browser,privateStorage:app.storage,applyAccess:'dock-access'});t.after(()=>{dock.close();return page.happyDOM.abort();});
  await delay(20);host.querySelector('[data-action="Apply to Job"]').click();
  await until(()=>host.querySelector('.dock-ai-apply-frame')?.src.includes('windowId='));
  const frame=host.querySelector('.dock-ai-apply-frame'),url=new URL(frame.src);
  page.dispatchEvent(new page.MessageEvent('message',{source:frame.contentWindow,origin:'chrome-extension://dock-test',data:{type:'ai-apply.ready',nonce:url.searchParams.get('nonce')}}));
  await delay(5);
  assert.equal(url.pathname,'/ai-apply/index.html');assert.equal(url.searchParams.get('access'),'dock-access');
  assert.equal(host.querySelector('.rd-main').hidden,true);assert.equal(host.querySelector('#apply-ready-queue-design'),null);assert.equal(app.tabs.length,0);
  host.querySelector('.dock-ai-apply .dock-workspace-header button').click();assert.equal(host.querySelector('.rd-main').hidden,false);
  await dock.showApplications('queue');assert.equal(host.querySelectorAll('.dock-ai-apply-frame').length,1);assert.equal(host.querySelector('#at-reference-dock').dataset.dockView,'apply');
});

test('Fill all respects selected fields and manual answers while attaching both saved documents',async t=>{
 const app=await applyFixture(t),employer=app.employer('<form><label>First name *<input name="firstName"></label><label>Email<input type="email" name="email" required></label><label>Resume<input type="file" name="resume"></label><label>Cover letter file<input type="file" name="letter"></label><label>Cover letter<textarea name="letter-text"></textarea></label><label>Why this role?<textarea name="why" required></textarea></label></form>');
 const job=await app.ready(await app.create());app.serviceDeps.renderCoverLetter=async()=>({text:'My saved letter',resumeBase64:btoa('%PDF cover letter'),fileName:'Cover letter.pdf'});app.restart();
 const inspected=await app.request('DOCK_APPLY_INSPECT'),why=inspected.fields.find(field=>field.label==='Why this role?');
 await app.request('DOCK_APPLY_START',{jobId:job.id,tabId:7,fieldKeys:[why.key],answers:{[why.key]:'My reviewed answer'}});await app.settled();
 assert.equal(employer.page.document.querySelector('[name="firstName"]').value,'');assert.equal(employer.page.document.querySelector('[name="email"]').value,'');assert.equal(employer.page.document.querySelector('[name="why"]').value,'My reviewed answer');
 assert.equal(employer.page.document.querySelector('[name="resume"]').files.length,1);assert.equal(employer.page.document.querySelector('[name="letter"]').files[0].name,'Cover letter.pdf');assert.equal(employer.page.document.querySelector('[name="letter-text"]').value,'My saved letter');assert.equal(employer.submits(),0);
});

test('bulk refill accepts answers to questions discovered after the initial autofill run',async t=>{
 const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());await app.start(job);await app.settled();const {run}=await app.request('DOCK_APPLY_STATE');
 const label=employer.page.document.createElement('label');label.textContent='Why this company now?';const input=employer.page.document.createElement('textarea');input.required=true;label.append(input);employer.page.document.querySelector('form').append(label);
 const inspected=await app.request('DOCK_APPLY_INSPECT'),question=inspected.fields.find(field=>field.label==='Why this company now?');
 await app.action(run,'rescan',{fieldKeys:[question.key],answers:{[question.key]:'My newly reviewed answer'}});await app.settled();assert.equal(input.value,'My newly reviewed answer');
});

test('explicit form-review edits replace committed answers once; later Autofill preserves new employer-page edits',async t=>{
 const app=await applyFixture(t),employer=app.employer('<form><label>First name<input name="firstName"></label><label>Work arrangement<select name="arrangement"><option value="">Choose</option><option value="remote">Remote</option><option value="hybrid">Hybrid</option></select></label><fieldset><legend>Work authorization</legend><label><input type="radio" name="authorization" value="yes">Yes</label><label><input type="radio" name="authorization" value="no">No</label></fieldset></form>');
 const job=await app.ready(await app.create());await app.start(job);await app.settled();const {run}=await app.request('DOCK_APPLY_STATE');
 const doc=employer.page.document,select=doc.querySelector('select');select.value='remote';doc.querySelector('[value=yes]').checked=true;
 const inspected=await app.request('DOCK_APPLY_INSPECT'),answers=Object.fromEntries(inspected.fields.map(field=>[field.key,field.label==='First name'?'Jordanette':field.label==='Work arrangement'?'hybrid':'no']));
 await app.action(run,'rescan',{answers});await app.settled();
 assert.equal(doc.querySelector('[name=firstName]').value,'Jordanette');assert.equal(select.value,'hybrid');assert.equal(doc.querySelector('[value=no]').checked,true);
 doc.querySelector('[name=firstName]').value='Edited on page';select.value='remote';doc.querySelector('[value=yes]').checked=true;
 await app.action(run,'rescan');await app.settled();
 assert.equal(doc.querySelector('[name=firstName]').value,'Edited on page');assert.equal(select.value,'remote');assert.equal(doc.querySelector('[value=yes]').checked,true);
 assert.ok(app.sent.filter(call=>call.message.action==='fill').at(-1).message.overwriteIds.length===0);
});

test('profile-only autofill works before documents are generated and saves only a confirmed submission',async t=>{
 const app=await applyFixture(t),employer=app.employer(),job=await app.create();
 await app.start(job);let run=await app.settled();
 assert.equal(employer.page.document.querySelector('[name=firstName]').value,'Jordan');assert.equal(employer.page.document.querySelector('[name=email]').value,'jordan@example.test');
 assert.equal(employer.uploads(),0);assert.equal(app.rendered.length,0);assert.equal(app.browser.storage.local.values.appliedList.length,1);
 const result=await app.action(run,'confirm-submission');assert.equal(result.run.phase,'submitted');assert.ok(result.run.applicationId);
 assert.equal(app.browser.storage.local.values.appliedList.length,2);
 const records=await app.recordsRequest('DOCK_RECORDS_STATE');assert.equal(records.jobs.length,0);assert.equal(records.applications.find(item=>item.id===result.run.applicationId).resume,null);
 await app.action(result.run,'confirm-submission');assert.equal(app.browser.storage.local.values.appliedList.length,2);assert.equal(employer.submits(),0);
});

test('slow or failed PDF rendering never blocks profile facts and a retry can still attach documents',async t=>{
 const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());
 let release;app.serviceDeps.renderSnapshot=()=>new Promise((resolve,reject)=>{release=()=>reject(Error('Renderer unavailable'));});app.restart();
 await app.start(job);await until(()=>release);assert.equal(employer.page.document.querySelector('[name=firstName]').value,'Jordan');
 release();const run=await app.settled();assert.equal(run.phase,'questions');assert.match(run.warnings[0],/Resume could not be attached/);assert.equal(employer.uploads(),0);
 app.serviceDeps.renderSnapshot=async()=>({base64:btoa('%PDF retry')});app.restart();await app.action(run,'rescan');const retried=await app.settled();assert.notEqual(retried.phase,'error');assert.equal(employer.uploads(),1);
});

test('autofill skips PDF rendering on text-only forms and can use the uploaded original resume',async t=>{
 const app=await applyFixture(t),page=app.employer('<form><label>First name<input name="firstName"></label></form>'),job=await app.ready(await app.create());
 await app.start(job);let run=await app.settled();assert.equal(app.rendered.length,0);assert.equal(page.page.document.querySelector('input').value,'Jordan');await app.action(run,'cancel');
 const original=app.profiles.get('candidate-1');original.profile.resumeData={resumeBase64:btoa('%PDF original'),fileName:'Original.pdf'};
 const employer=app.employer();const queued=await app.create('original');await app.start(queued);run=await app.settled();assert.equal(employer.page.document.querySelector('[name=resume]').files[0].name,'Original.pdf');assert.equal(app.rendered.length,0);assert.notEqual(run.phase,'error');
});

test('inspection finds the selected employer tab when the active tab is an extension page',async t=>{
 const app=await applyFixture(t);app.employer();const job=await app.create();app.openTabs.get(7).active=false;
 const inspected=await app.request('DOCK_APPLY_INSPECT',{jobId:job.id});
 // The form URL follows the saved listing after opening Apply.
 assert.equal(inspected.tabId,null);
 app.openTabs.get(7).url=job.url;
 const matched=await app.request('DOCK_APPLY_INSPECT',{jobId:job.id});assert.equal(matched.tabId,7);assert.ok(matched.fields.find(field=>field.label==='Email').canAutofill);
});

test('profile autofill fills the current page without any queued job and never manufactures an application record',async t=>{
 const app=await applyFixture(t),page=app.employer();const before=await app.recordsRequest('DOCK_RECORDS_STATE');assert.equal(before.jobs.length,0);
 await app.request('DOCK_APPLY_START',{profileOnly:true,tabId:7});let run=await app.settled();
 assert.equal(run.profileOnly,true);assert.equal(run.jobId,null);assert.equal(run.options.record,false);assert.equal(page.page.document.querySelector('[name=firstName]').value,'Jordan');assert.equal(page.page.document.querySelector('[name=email]').value,'jordan@example.test');
 assert.equal(page.page.document.querySelector('[name=why]').value,'');assert.equal(page.submits(),0);
 app.profiles.get('candidate-1').profile.nameData.firstName='Updated';page.page.document.querySelector('[name=firstName]').value='';await app.action(run,'rescan');run=await app.settled();assert.equal(page.page.document.querySelector('[name=firstName]').value,'Updated');
 const confirmed=await app.action(run,'confirm-submission');assert.equal(confirmed.run.phase,'submitted');assert.equal(app.browser.storage.local.values.appliedList.length,1);assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).jobs.length,0);
});

test('switching to another application cancels delayed writes and fills the selected page in one request',async t=>{
 const app=await applyFixture(t),first=await app.ready(await app.create('jobs/first')),oldPage=app.employer(undefined,first.url),send=app.browser.tabs.sendMessage;
 let release,waiting=false;app.browser.tabs.sendMessage=async(...args)=>{if(args[0]===7&&args[1].action==='fill'&&!waiting){waiting=true;await new Promise(resolve=>{release=resolve;});}return send(...args);};
 const {run:old}=await app.start(first);await until(()=>waiting);t.after(()=>release?.());
 const second=await app.create('jobs/second'),newPage=app.employer(undefined,second.url,8);
 await app.request('DOCK_APPLY_START',{jobId:second.id,tabId:8,replaceRunId:old.id});const next=await app.settled();assert.notEqual(next.id,old.id);assert.equal(next.tabId,8);assert.equal(newPage.page.document.querySelector('[name=firstName]').value,'Jordan');
 release();await delay(25);assert.equal(oldPage.page.document.querySelector('[name=firstName]').value,'',JSON.stringify(app.sent.map(({id,message})=>({id,action:message.action,runId:message.runId}))));assert.equal((await app.request('DOCK_APPLY_STATE')).run.id,next.id);assert.equal(oldPage.submits(),0);assert.equal(newPage.submits(),0);
});

test('a stale switch or invalid new target never cancels the previous run',async t=>{
 const app=await applyFixture(t),first=await app.ready(await app.create('jobs/first'));app.employer(undefined,first.url);await app.start(first);const old=await app.settled();
 const second=await app.create('jobs/second');app.employer(undefined,second.url,8);
 await assert.rejects(app.request('DOCK_APPLY_START',{jobId:second.id,tabId:8,replaceRunId:'obsolete'}),/active autofill changed/);
 await assert.rejects(app.request('DOCK_APPLY_START',{jobId:second.id,tabId:7,replaceRunId:old.id}),/another job/);
 assert.equal((await app.request('DOCK_APPLY_STATE')).run.id,old.id);assert.ok(!app.sent.some(({message})=>message.action==='cancel'));
});

test('rejected document types report upload warnings while profile fields still fill',async t=>{
 const app=await applyFixture(t),page=app.employer('<form><label>Email<input id="email" required></label><label>Resume<input type="file" accept=".docx" required></label></form>'),job=await app.ready(await app.create());
 await app.start(job);const run=await app.settled();assert.equal(page.page.document.querySelector('#email').value,'jordan@example.test');assert.equal(page.uploads(),0);assert.equal(run.phase,'questions');assert.match(run.warnings.join(' '),/accepts \.docx/);assert.ok(run.fields.find(field=>field.type==='file').uploadError);
});
