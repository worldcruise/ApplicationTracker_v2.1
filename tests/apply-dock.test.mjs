import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';
import { applyFixture } from './helpers/apply-dock-fixture.mjs';
import { mountApplyDock } from '../extension/studio/apply-dock-view.js';
import { mountDockDashboard } from '../extension/studio/dock-dashboard-view.js';
import { APPLY_DOCK_MARKUP } from '../extension/studio/apply-dock-markup.js';
import { DOCK_APPLY_OPERATIONS } from '../extension/studio/dock-apply-service.js';
import { DASHBOARD_OPERATIONS } from '../extension/studio/reference-dashboard-access.js';

async function until(check){for(let i=0;i<80;i++){if(await check())return;await delay(10);}throw Error('Expected application state did not arrive.');}
test('dock Apply lists only Ready jobs and binds a frozen resume to a real form',async t=>{
  const app=await applyFixture(t),employer=app.employer();
  await assert.rejects(app.request('DOCK_APPLY_START',{jobId:'missing',tabId:7}),/validated resume/);
  const queued=await app.create('queued'),job=await app.ready(await app.create('ready'));
  const initial=await app.request('DOCK_APPLY_STATE');assert.equal(initial.jobs.length,1);assert.equal(initial.jobs[0].id,job.id);assert.ok(!initial.jobs.some(item=>item.id===queued.id));
  await assert.rejects(app.start(queued),/validated resume/);
  await assert.rejects(app.request('DOCK_APPLY_IMPORT',{action:'parse',jobId:queued.id,fileName:'Resume.pdf',base64:btoa('PDF')}),/validated resume/);
  const started=await app.start(job);assert.equal(started.run.jobId,job.id);assert.equal(started.run.tabId,7);
  await app.settled();const state=await app.request('DOCK_APPLY_STATE');
  assert.equal(state.run.phase,'questions');assert.equal(employer.page.document.querySelector('[name="firstName"]').value,'Jordan');assert.equal(employer.page.document.querySelector('[name="email"]').value,'jordan@example.test');assert.equal(employer.uploads(),1);
  assert.deepEqual(app.rendered[0],{...job.resume.snapshot,workspaceId:`dock-apply:${job.id}:${job.resume.version}`});assert.equal(state.run.fields.length,5);assert.equal(state.run.fields.filter(field=>field.filled).length,3);
  assert.ok(app.sent.every(item=>item.id===7&&item.options.documentId==='document-7'));
  await assert.rejects(app.request('DOCK_APPLY_SELECT',{candidateId:'candidate-2'}),/cancel the current run/);
  await app.action(state.run,'cancel');const switched=await app.request('DOCK_APPLY_SELECT',{candidateId:'candidate-2'});assert.equal(switched.jobs.length,0);assert.equal(switched.candidate.id,'candidate-2');
  assert.equal(app.tabs.length,0);
});

test('Apply excludes stale resumes and removes a job when its status stops being Ready',async t=>{
  const app=await applyFixture(t),ready=await app.ready(await app.create('ready')),stale=await app.ready(await app.create('stale')),failed=await app.create('failed');
  await app.mutate('fail',failed);
  const key='dock-job-records:v1',saved=(await app.storage.get(key))[key];saved.jobs.find(job=>job.id===stale.id).resume.inputRevision=0;await app.storage.set({[key]:saved});
  assert.deepEqual((await app.request('DOCK_APPLY_STATE')).jobs.map(job=>job.id),[ready.id]);
  await app.mutate('update',ready,{...ready,description:'Changed job description'});
  assert.equal((await app.request('DOCK_APPLY_STATE')).jobs.length,0);
});

test('Import from Queue parses the saved PDF file rather than mapping queue JSON',async t=>{
  const app=await applyFixture(t),job=await app.ready(await app.create());let parsed;
  app.serviceDeps.readQueueFile=async()=>({resumeBase64:btoa('%PDF saved file'),fileName:'saved-resume.pdf'});
  app.serviceDeps.parseResume=async file=>{parsed=file;return {skillsData:['Skill from the saved PDF']};};app.restart();
  const result=await app.request('DOCK_APPLY_IMPORT',{action:'queue-file',jobId:job.id});assert.equal(result.fileName,'saved-resume.pdf');assert.deepEqual(parsed,{base64:btoa('%PDF saved file'),fileName:'saved-resume.pdf'});assert.ok(result.token);assert.deepEqual(result.changes.skills,['Skill from the saved PDF']);assert.equal(app.rendered.length,0);
});

test('dock answers fill real questions, remember only approved facts, and record a confirmed application once',async t=>{
  const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());
  await app.start(job);await app.settled();let {run}=await app.request('DOCK_APPLY_STATE');
  const why=run.questions.find(field=>field.kind==='ai'),availability=run.questions.find(field=>field.kind==='fact');
  let result=await app.action(run,'draft',{fieldKey:why.key});await app.settled();result=await app.request('DOCK_APPLY_STATE');assert.ok(result.run.drafts[why.key]);assert.equal(app.generated[0].profile.nameData.firstName,'Jordan');
  assert.equal(employer.page.document.querySelector('[name="why"]').value,'');
  result=await app.action(run,'fill-answer',{fieldKey:why.key,answer:result.run.drafts[why.key]});
  result=await app.action(run,'fill-answer',{fieldKey:availability.key,answer:'Two weeks',remember:true});run=result.run;
  assert.equal(run.phase,'ready');assert.equal(employer.page.document.querySelector('[name="availability"]').value,'Two weeks');
  assert.ok((await app.storage.get('dock-approved-answers:v1:candidate-1'))['dock-approved-answers:v1:candidate-1']);
  await app.action(run,'review');result=await app.action(run,'submit');assert.equal(result.run.phase,'submission-pending');assert.equal(employer.submits(),1);
  await assert.rejects(app.action(run,'submit'),/rescan this application/);assert.equal(employer.submits(),1);
  const before=app.browser.storage.local.values.appliedList.length;
  result=await app.action(run,'confirm-submission');assert.equal(result.run.phase,'submitted');assert.ok(result.run.applicationId);assert.equal(app.browser.storage.local.values.appliedList.length,before+1);
  await app.action(run,'confirm-submission');assert.equal(app.browser.storage.local.values.appliedList.length,before+1);
  app.restart();assert.equal((await app.request('DOCK_APPLY_STATE')).run.phase,'submitted');
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

test('resume import reviews changes, rejects a stale profile, and keeps SpeedyApply data fields',async t=>{
  const app=await applyFixture(t);app.employer();const job=await app.ready(await app.create());
  const parsed=await app.request('DOCK_APPLY_IMPORT',{action:'parse',jobId:job.id,fileName:'Resume.pdf',base64:btoa('%PDF resume')});assert.ok(parsed.summary.includes('1 skills'));
  app.bumpProfile();await assert.rejects(app.request('DOCK_APPLY_IMPORT',{action:'apply',jobId:job.id,token:parsed.token}),/profile or job changed/);
  const next=await app.request('DOCK_APPLY_IMPORT',{action:'parse',jobId:job.id,fileName:'Resume.pdf',base64:btoa('%PDF resume')});
  await app.request('DOCK_APPLY_IMPORT',{action:'apply',jobId:job.id,token:next.token});
  const candidate=await app.deps.profiles.get('candidate-1');assert.deepEqual(candidate.profile.skillsData,['Parsed skill']);assert.equal(candidate.profile.contactData.email,'jordan@example.test');assert.equal(candidate.profile.profileName,'Profile One');
});

test('recording refuses a profile changed after starting, and stale jobs cannot start',async t=>{
  const app=await applyFixture(t);app.employer();const job=await app.ready(await app.create());await app.start(job);await app.settled();const {run}=await app.request('DOCK_APPLY_STATE');
  app.bumpProfile();await assert.rejects(app.action(run,'confirm-submission'),/profile or prepared resume changed/);assert.equal(app.browser.storage.local.values.appliedList.length,1);
  await app.action(run,'cancel');await app.mutate('update',job,{url:job.url,description:'Different input',notes:'',conversationUrl:''});await assert.rejects(app.start(job),/validated resume/);
});

test('Apply UI imports no demo runtime, preserves question drafts and returns to the dock',async t=>{
  const app=await applyFixture(t);app.employer();const job=await app.ready(await app.create());
  const page=new Window(),host=page.document.createElement('div');page.document.body.append(host);let dashboard=0,queue=0;
  app.browser.runtime.sendMessage=async message=>{try{return{ok:true,result:await app.request(message.operation,message.payload)};}catch(error){return{ok:false,error:{message:error.message}};}};
  const view=mountApplyDock(host,{browser:app.browser,privateStorage:app.storage,onDashboard:()=>dashboard++,onQueue:()=>queue++});t.after(()=>{view.close();return page.happyDOM.abort();});await view.ready;
  const $=selector=>host.querySelector(selector),click=async selector=>{$(selector).click();await until(()=>view.root.getAttribute('aria-busy')==='false');};
  assert.equal($('#aj-setup').hidden,false);assert.equal($('#aj-profile').textContent,'Test Candidate');assert.equal($('#aj-prepared-company').textContent,job.company);assert.ok(!APPLY_DOCK_MARKUP.includes('<script'));assert.ok(!APPLY_DOCK_MARKUP.includes('Morgan'));assert.ok(!APPLY_DOCK_MARKUP.includes('Demo'));
  assert.equal($('#aj-tailor').checked,true);assert.equal($('#aj-upload').hidden,false);
  assert.equal($('#aj-update-profile').textContent,'Update Test Candidate’s profile');
  $('#aj-target-tab').value='7';$('#aj-target-tab').dispatchEvent(new page.Event('input',{bubbles:true}));
  await click('#aj-start');await app.settled();await view.show();assert.equal($('#aj-autofill').hidden,false);assert.equal($('#aj-profile').tagName,'SPAN');
  $('#aj-answer').value='Draft answer retained';$('#aj-answer').dispatchEvent(new page.Event('input',{bubbles:true}));await view.show();assert.equal($('#aj-answer').value,'Draft answer retained');
  await click('[data-step="setup"]');assert.equal($('#aj-setup').hidden,false);assert.equal($('#aj-header-state').textContent,'Draft');assert.equal($('#aj-start').disabled,false);
  assert.ok($('#aj-target-tab').closest('.aj-option-list'));assert.equal($('#aj-rescan').closest('#aj-autofill').id,'aj-autofill');
  await click('[data-action="dashboard"]');assert.equal(dashboard,1);await click('[data-action="job-details"]');assert.equal(queue,1);
  assert.equal((await readFile('extension/options.html','utf8')).includes('apply-dock.css'),false);
  assert.ok((await readFile('extension/dashboard.html','utf8')).includes('href="apply-dock.css"'),'The actual dock entry point loads the imported styles');
  assert.ok(DOCK_APPLY_OPERATIONS.every(operation=>DASHBOARD_OPERATIONS.has(operation)));
});

test('tailoring defaults on for saved setups and preserves an explicit off choice when reopening',async t=>{
  const app=await applyFixture(t),page=new Window(),host=page.document.createElement('div');page.document.body.append(host);
  app.browser.runtime.sendMessage=async message=>({ok:true,result:await app.request(message.operation,message.payload)});
  await app.storage.set({'dock-apply-ui:v1:41':{tailor:false}});
  let view=mountApplyDock(host,{browser:app.browser,privateStorage:app.storage});await view.ready;
  assert.equal(host.querySelector('#aj-tailor').checked,true);assert.equal(host.querySelector('#aj-upload').hidden,false);
  const toggle=host.querySelector('#aj-tailor');toggle.checked=false;toggle.dispatchEvent(new page.Event('input',{bubbles:true}));
  await until(async()=>!!(await app.storage.get('dock-apply-ui:v1:41'))['dock-apply-ui:v1:41']?.tailorPreferenceSet);
  view.close();view=mountApplyDock(host,{browser:app.browser,privateStorage:app.storage});await view.ready;
  assert.equal(host.querySelector('#aj-tailor').checked,false);assert.equal(host.querySelector('#aj-upload').hidden,true);
  view.close();await page.happyDOM.abort();
});

test('Apply Dashboard back navigation works during a pending operation and a failed setup save',async t=>{
  const app=await applyFixture(t);await app.ready(await app.create());
  const page=new Window(),host=page.document.createElement('div');page.document.body.append(host);let dashboard=0,finishPreview;
  app.browser.runtime.sendMessage=async message=>{if(message.operation==='DOCK_APPLY_PDF')return new Promise(resolve=>{finishPreview=resolve;});return{ok:true,result:await app.request(message.operation,message.payload)};};
  const view=mountApplyDock(host,{browser:app.browser,privateStorage:app.storage,onDashboard:()=>dashboard++});t.after(()=>{view.close();return page.happyDOM.abort();});await view.ready;
  host.querySelector('[data-action="preview-prepared-job"]').click();await until(()=>finishPreview);
  app.storage.set=async()=>{throw Error('Storage unavailable');};
  host.querySelector('[data-action="dashboard"]').click();assert.equal(dashboard,1,'Back navigation works while Apply is busy');
  await delay(10);assert.match(host.querySelector('#aj-feedback').textContent,/Unsaved setup remains/);
  finishPreview({ok:false,error:{message:'Preview cancelled'}});await delay(10);
});

test('Dashboard Apply to Job and a Ready queue card open the same dock view without creating web tabs',async t=>{
  const app=await applyFixture(t);app.employer();const job=await app.ready(await app.create());
  const page=new Window(),host=page.document.createElement('div');page.document.body.append(host);
  app.browser.runtime.sendMessage=async message=>{try{return{ok:true,result:message.operation==='DASHBOARD_STATE'?{candidate:await app.deps.profiles.bootstrap(),candidates:await app.deps.profiles.list()}:message.operation.startsWith('DOCK_RECORDS_')?await app.recordsRequest(message.operation,message.payload):await app.request(message.operation,message.payload)};}catch(error){return{ok:false,error:{message:error.message}};}};
  const dock=mountDockDashboard(host,{browser:app.browser,privateStorage:app.storage});t.after(()=>{dock.close();return page.happyDOM.abort();});
  await delay(20);host.querySelector('[data-action="Apply to Job"]').click();await until(()=>host.querySelector('#aj-profile')?.textContent==='Test Candidate');
  assert.equal(host.querySelector('.rd-main').hidden,true);assert.equal(host.querySelector('#apply-ready-queue-design').hidden,false);assert.equal(app.tabs.length,0);
  host.querySelector('#apply-ready-queue-design [data-action="job-details"]').click();await until(()=>host.querySelector(`#jr-detail-actions [data-record="${job.id}"][data-command="apply"]`));
  assert.equal(host.querySelector('#apply-ready-queue-design').hidden,true);assert.equal(host.querySelector('#job-records-design').hidden,false);
  await until(()=>host.querySelector('#jr-detail-company').textContent===job.company);
  host.querySelector(`#jr-detail-actions [data-record="${job.id}"][data-command="apply"]`).click();await until(()=>!host.querySelector('#apply-ready-queue-design').hidden);
  assert.equal(host.querySelector('#aj-prepared-title').textContent,job.role);assert.equal(host.querySelector('#job-records-design').hidden,true);
  host.querySelector('#apply-ready-queue-design [data-action="dashboard"]').click();await until(()=>!host.querySelector('.rd-main').hidden);assert.equal(app.tabs.length,0);
});

test('concurrent submission clicks and interrupted recording cannot duplicate an application',async t=>{
  const app=await applyFixture(t),employer=app.employer('<form><label>First name<input name="firstName" required></label><button type="submit">Submit application</button></form>');
  const job=await app.ready(await app.create());await app.start(job);await app.settled();let {run}=await app.request('DOCK_APPLY_STATE');
  const clicks=await Promise.allSettled([app.action(run,'submit'),app.action(run,'submit')]);assert.equal(clicks.filter(result=>result.status==='fulfilled').length,1);assert.equal(employer.submits(),1);
  const set=app.storage.set.bind(app.storage);let interrupted=false;
  app.storage.set=async input=>{if(!interrupted&&Object.entries(input).some(([key,value])=>key.startsWith('dock-apply-run:v1:')&&value.phase==='submitted')){interrupted=true;throw Error('Interrupted final run write');}return set(input);};
  await assert.rejects(app.action(run,'confirm-submission'),/Interrupted final run write/);assert.equal(app.browser.storage.local.values.appliedList.length,2);
  app.storage.set=set;app.restart();run=(await app.request('DOCK_APPLY_STATE')).run;
  const result=await app.action(run,'confirm-submission');assert.equal(result.run.phase,'submitted');assert.equal(app.browser.storage.local.values.appliedList.length,2);
});

test('an obsolete AI response cannot overwrite a paused and resumed run',async t=>{
  const app=await applyFixture(t),employer=app.employer(),job=await app.ready(await app.create());let release;
  app.serviceDeps.generateAnswer=()=>new Promise(resolve=>{release=resolve;});app.restart();
  await app.start(job);await app.settled();let {run}=await app.request('DOCK_APPLY_STATE');const why=run.questions.find(field=>field.kind==='ai');
  const result=await app.action(run,'draft',{fieldKey:why.key});assert.equal(result.run.phase,'drafting');await until(()=>release);
  await app.action(run,'pause');await app.action(run,'resume');await app.settled();release('Obsolete AI draft');await delay(20);
  run=(await app.request('DOCK_APPLY_STATE')).run;assert.equal(run.drafts[why.key],undefined);assert.equal(employer.page.document.querySelector('[name="why"]').value,'');
});
