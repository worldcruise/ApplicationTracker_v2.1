import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {sameApplicationUrl,isApplicationTransition} from '../extension/ai-apply/src/application-identity.mjs';
import {applicationControl,applicationFormSubmission} from '../extension/studio/apply-navigation.js';
import {createApplyLifecycle} from '../extension/studio/apply-lifecycle.js';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';
import {openApplicationTabs} from '../extension/ai-apply/src/apply-tabs.mjs';
import {speedySubmissionControl} from '../extension/studio/speedy-submission-adapters.js';

test('SmartRecruiters listing, slug, and oneclick wizard routes share a requisition without accepting another job',()=>{
 const listing='https://jobs.smartrecruiters.com/Acme/744000123456789-software-engineer';
 for(const path of ['job/744000123456789','publication/744000123456789/application','job/744000123456789/questions']){
   const application='https://jobs.smartrecruiters.com/oneclick-ui/company/acme/'+path;
   assert.equal(sameApplicationUrl(listing,application),true);assert.equal(isApplicationTransition({listingUrl:listing,visitedUrls:[listing]},application),true);
 }
 assert.equal(sameApplicationUrl(listing,'https://jobs.smartrecruiters.com/oneclick-ui/company/acme/job/744000999999999'),false);
 assert.equal(sameApplicationUrl(listing,'https://jobs.smartrecruiters.com/Other/744000123456789-engineer'),false);
});

test('Workable listing Apply opens the flow while the candidate form button submits',t=>{
 const page=new Window({url:'https://jobs.workable.com/view/8qffGtZGbRGWzC2rByyNq8/example'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form><input type="search"><button type="submit">Apply</button></form>';assert.equal(applicationControl(page.document.querySelector('button')).kind,'apply');assert.equal(applicationFormSubmission(page.document.querySelector('form'),page.document.querySelector('button')).kind,'apply');
 page.happyDOM.setURL('https://apply.workable.com/employer/j/123/');page.document.body.innerHTML='<button data-ui="apply-button">Apply for this job</button>';assert.equal(speedySubmissionControl(page.document.querySelector('button')).kind,'apply');assert.equal(applicationControl(page.document.querySelector('button')).kind,'apply');
 page.document.body.innerHTML='<form><input type="email"><input type="file"><button type="submit" data-ui="apply-button">Apply</button></form>';assert.equal(speedySubmissionControl(page.document.querySelector('button')).kind,'submit');assert.equal(applicationControl(page.document.querySelector('button')).kind,'submit');
});

for(const [name,a,b]of [
  ['Greenhouse','https://job-boards.greenhouse.io/embed/job_app?for=example&token=123','https://job-boards.greenhouse.io/example/jobs/123/confirmation'],
  ['Lever','https://jobs.lever.co/example/abc','https://jobs.lever.co/example/abc/apply'],
  ['Workday','https://example.myworkdayjobs.com/en-US/Careers/job/US/Engineer_R123','https://example.myworkdayjobs.com/en-US/Careers/job/US/Engineer_R123/apply/review'],
  ['iCIMS','https://careers.icims.com/jobs/123/engineer/job','https://careers.icims.com/jobs/123/engineer/questions'],
  ['ADP','https://jobs.adp.com/app?cid=example&jobId=123&step=1','https://jobs.adp.com/app?cid=example&jobId=123&step=2']
])test(name+' keeps its identity across application routes',()=>assert.equal(sameApplicationUrl(a,b),true));

test('explicit transitions preserve unknown wizard steps and reject a different requisition',()=>{
  assert.equal(sameApplicationUrl('https://employer.test/application?id=123','https://employer.test/application?id=456'),false);
  const url='https://employer.test/jobs/123',session={listingUrl:url,targetUrl:url,visitedUrls:[url],navigationIntent:{kind:'next',fromUrl:url,targetUrl:'https://employer.test/application/step2',at:1000}};
  assert.equal(isApplicationTransition(session,'https://employer.test/application/step2',1001),true);
  assert.equal(isApplicationTransition(session,'https://employer.test/jobs/456',1001),false);
  assert.equal(isApplicationTransition(session,'https://unrelated.test/application/step2',1001),false);
  assert.equal(isApplicationTransition(session,'https://employer.test/application/step2',200000),false);
});

test('Open application reuses the bound wizard tab in its window instead of opening the listing again',async()=>{
  const listing='https://employer.test/jobs/123',step=listing+'/apply/step2',calls=[];
  const session={jobId:'one',tabId:7,phase:'questions',listingUrl:listing,visitedUrls:[listing,step]};
  const browser={tabs:{query:async query=>{assert.deepEqual(query,{windowId:41});return[{id:7,windowId:41,url:step},{id:8,windowId:41,url:listing,active:true}];},update:async(id,options)=>{calls.push(id);return{id,windowId:41,url:step};},create:async()=>{throw Error('Do not restart an application wizard.');}},windows:{update:async()=>{}}};
  const opened=await openApplicationTabs({jobUrl:listing,jobId:'one',session,windowId:41,browser});assert.equal(opened.jobTab.id,7);assert.deepEqual(calls,[7]);
});

test('an explicit Apply handoff can pass through an ATS login while preserving the destination requisition',()=>{
  const session={listingUrl:'https://employer.test/jobs/123',targetUrl:'https://employer.test/jobs/123',navigationIntent:{kind:'apply',fromUrl:'https://employer.test/jobs/123',targetUrl:'https://jobs.lever.co/example/abc/apply',at:1000}};
  assert.equal(isApplicationTransition(session,'https://jobs.lever.co/login?redirect=application',1001),true);
  assert.equal(isApplicationTransition(session,'https://jobs.lever.co/example/different/apply',1001),false);
});

test('sign-in form submission is a continuation, including a generically labeled Submit button',t=>{
  const page=new Window({url:'https://employer.test/login'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form id="signInForm"><input type="password"><button>Submit</button></form>';
  const button=page.document.querySelector('button');assert.equal(applicationControl(button).kind,'next');assert.equal(applicationFormSubmission(button.form,button).kind,'next');
});

test('controls recognize Apply to this job, icon Next, Workday and form Submit without treating Back as forward',t=>{
  const page=new Window({url:'https://employer.test/jobs/123'});t.after(()=>page.happyDOM.abort());
  page.document.body.innerHTML='<a href="/jobs/123/apply">Apply to this job</a><button aria-label="Next"><svg></svg></button><button data-automation-id="pageFooterNextButton">Submit</button><button aria-label="Previous step">Back</button>';
  assert.deepEqual([...page.document.querySelectorAll('a,button')].map(applicationControl).map(value=>value?.kind||null),['apply','next','submit',null]);
});

test('passive lifecycle observes navigation and receipts without filling or clicking',async t=>{
  const page=new Window({url:'https://employer.test/jobs/123/apply'});t.after(()=>page.happyDOM.abort());
  page.document.body.innerHTML='<form><label>Name<input required></label><button type="button" aria-label="Next"><svg></svg></button></form>';
  const form=createApplyForm(page.document),events=[],tracker=createApplyLifecycle(page.document,{scan:form.scan,emit:event=>events.push(event),isTrusted:()=>true});t.after(()=>tracker.dispose());
  tracker.watch({runId:'run:0',token:'token'});page.document.querySelector('svg').dispatchEvent(new page.MouseEvent('click',{bubbles:true,composed:true,button:0}));
  assert.equal(events[0].kind,'intent');assert.equal(events[0].action,'next');assert.equal(page.document.querySelector('input').value,'');
  page.history.pushState({},'','/jobs/123/apply/step2');page.document.body.innerHTML='<h1>Thank you for applying</h1>';await delay(240);
  assert.ok(events.some(event=>event.kind==='state'&&event.url.endsWith('/step2')&&event.receipt));
});

async function tracked(t){
  const app=await applyFixture(t),job=await app.ready(await app.create('jobs/one')),page=app.employer('<form><label>Name<input required></label><button type="button" aria-label="Next">→</button></form>',job.url);
  await app.request('DOCK_APPLY_TRACK',{jobId:job.id,tabId:7});
  const saved=()=>(app.storage.get('dock-apply-run:v1:41')).then(value=>value['dock-apply-run:v1:41']);
  const event=async(value,{url=page.page.location.href,documentId='document-7',tabId=7,frameId=0,openerTabId}={})=>{
    const run=await saved();return app.pageEvent({runId:`${run.id}:${run.epoch||0}`,token:run.trackingToken,url,...value},{id:app.browser.runtime.id,url,documentId,frameId,tab:{id:tabId,windowId:41,url,openerTabId}});
  };
  return {...app,employerPage:page,job,saved,event};
}

test('Apply intent survives Chrome reporting the destination URL before the source click arrives',async t=>{
 const app=await tracked(t),run=await app.saved(),destination='https://example.test/application/start';
 const result=await app.pageEvent({kind:'intent',action:'apply',url:app.job.url,targetUrl:destination,runId:`${run.id}:${run.epoch||0}`,token:run.trackingToken},{id:app.browser.runtime.id,url:app.job.url,documentId:'document-7',frameId:0,tab:{id:7,windowId:41,url:destination}});
 assert.equal(result.watch,true);assert.equal((await app.saved()).navigationIntent.targetUrl,destination);
 app.employer('<form><label>Street address<input></label></form>',destination);await app.event({kind:'ready'},{url:destination});assert.notEqual((await app.saved()).phase,'paused');assert.ok((await app.saved()).fields.some(field=>field.label==='Street address'));
});

test('passive tracking survives Next and reload, keeps fields empty, and records one confirmed submission',async t=>{
  const app=await tracked(t);assert.equal(app.employerPage.page.document.querySelector('input').value,'');assert.equal(app.rendered.length,0);
  await app.event({kind:'intent',action:'next',targetUrl:'https://example.test/jobs/one/apply/step2'});
  const page=app.employer('<form><label>Answer<textarea required></textarea></label><button>Submit application</button></form>','https://example.test/jobs/one/apply/step2');
  app.restart();await app.event({kind:'ready'},{url:page.page.location.href});
  const run=await app.saved();assert.equal(run.jobId,app.job.id);assert.ok(run.fields.some(field=>field.label==='Answer'));assert.equal(page.page.document.querySelector('textarea').value,'');
  await app.event({kind:'intent',action:'submit'},{url:page.page.location.href});assert.equal((await app.saved()).phase,'submission-pending');assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).applications.length,1);
  page.page.document.body.innerHTML='<main><h1>Thank you for applying</h1></main>';
  await app.event({kind:'state',scan:page.form.scan(),receipt:{kind:'receipt',text:'Thank you for applying'}},{url:page.page.location.href});
  assert.equal((await app.saved()).phase,'submitted');assert.ok((await app.saved()).applicationId);
  const count=(await app.recordsRequest('DOCK_RECORDS_STATE')).applications.length;
  await app.event({kind:'state',scan:page.form.scan(),receipt:{kind:'receipt',text:'Thank you for applying'}},{url:page.page.location.href});
  assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).applications.length,count);
});

test('validation errors cancel submission intent and unrelated jobs pause the binding',async t=>{
  const app=await tracked(t);await app.event({kind:'intent',action:'submit'});await app.event({kind:'invalid',errors:'Name is required.'});
  assert.equal((await app.saved()).phase,'questions');assert.equal((await app.saved()).pendingSubmission,null);
  await app.event({kind:'intent',action:'next',targetUrl:'https://example.test/jobs/two'});
  assert.deepEqual(await app.event({kind:'ready'},{url:'https://example.test/jobs/two'}),{watch:false});assert.equal((await app.saved()).phase,'paused');
});

test('events from the wrong tab, document or token cannot record an application',async t=>{
  const app=await tracked(t);assert.deepEqual(await app.event({kind:'intent',action:'submit',token:'wrong'}),{watch:false});
  assert.deepEqual(await app.event({kind:'intent',action:'submit'},{tabId:8}),{watch:false});
  assert.deepEqual(await app.event({kind:'intent',action:'submit'},{documentId:'obsolete'}),{watch:false});assert.equal((await app.saved()).pendingSubmission,undefined);
});

test('manual autofill refuses a known different requisition on the same ATS',async t=>{
  const app=await tracked(t);await app.action(await app.saved(),'cancel');app.employer('<form><input name="firstName"></form>','https://example.test/jobs/two');
  await assert.rejects(app.request('DOCK_APPLY_START',{jobId:app.job.id,tabId:7}),/another job/);
});

test('moving to another prepared job switches passive observation without filling either page',async t=>{
  const app=await tracked(t),next=await app.ready(await app.create('jobs/two')),page=app.employer('<form><label>Email<input name="email"></label></form>',next.url,8);
  const state=await app.request('DOCK_APPLY_TRACK',{jobId:next.id,tabId:8});assert.equal(state.run.jobId,next.id);assert.equal(state.run.tabId,8);assert.equal(page.page.document.querySelector('input').value,'');assert.equal(app.employerPage.page.document.querySelector('input').value,'');
});

test('switching Autofill preserves the previous pending submission across worker restarts and records its receipt once',async t=>{
 const app=await tracked(t);await app.event({kind:'intent',action:'submit'});const previous=await app.saved();
 const nextJob=await app.create('jobs/next');app.employer('<form><label>First name<input name="firstName"></label></form>',nextJob.url,8);
 await app.request('DOCK_APPLY_START',{jobId:nextJob.id,tabId:8,replaceRunId:previous.id});const next=await app.settled();assert.equal(next.tabId,8);assert.equal((await app.request('DOCK_APPLY_STATE')).pendingSubmissions.length,1);
 app.restart();assert.equal((await app.request('DOCK_APPLY_STATE')).run.id,next.id);assert.equal((await app.request('DOCK_APPLY_STATE')).pendingSubmissions[0].id,previous.id);
 app.employerPage.page.document.body.innerHTML='<h1>Thank you for applying</h1>';
 const event={kind:'state',url:previous.targetUrl,runId:`${previous.id}:${previous.epoch||0}`,token:previous.trackingToken,scan:app.employerPage.form.scan(),receipt:{kind:'receipt',text:'Thank you for applying'}};
 const sender={id:app.browser.runtime.id,url:previous.targetUrl,documentId:'document-7',frameId:0,tab:{id:7,windowId:41,url:previous.targetUrl}};
 await app.pageEvent(event,sender);const state=await app.request('DOCK_APPLY_STATE');assert.equal(state.run.id,next.id);assert.equal(state.pendingSubmissions.length,0);assert.equal(app.browser.storage.local.values.appliedList.length,2);
 await app.pageEvent(event,sender);assert.equal(app.browser.storage.local.values.appliedList.length,2);assert.ok((await app.recordsRequest('DOCK_RECORDS_STATE')).jobs.some(job=>job.id===nextJob.id));
});

test('single-page events use Chrome tab URL while retaining the original document identity',async t=>{
  const app=await tracked(t),url=app.job.url+'/apply/step2',run=await app.saved();
  const reply=await app.pageEvent({kind:'state',url,runId:`${run.id}:0`,token:run.trackingToken,scan:{url,fields:[],nextAvailable:false,submitAvailable:true}},{id:app.browser.runtime.id,url:app.job.url,documentId:'document-7',frameId:0,tab:{id:7,windowId:41,url}});
  assert.equal(reply.watch,true);assert.equal((await app.saved()).targetUrl,url);assert.equal((await app.saved()).jobId,app.job.id);
});
