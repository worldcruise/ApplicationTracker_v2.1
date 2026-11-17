import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {SPEEDY_SUBMISSION_RULES,speedyRuleForDocument} from '../extension/studio/speedy-submission-rules.js';
import {speedyApplicationMetadata,speedySubmissionSnapshot,speedySubmissionControl} from '../extension/studio/speedy-submission-adapters.js';
import {createSpeedySubmissionTracker} from '../extension/studio/speedy-submission-tracker.js';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';
import {referenceDashboardData} from '../extension/studio/reference-dashboard-data.js';
import {AUTOFILL_SETTINGS_KEY} from '../extension/studio/autofill-settings.js';
import {submissionAttemptId} from '../extension/studio/apply-navigation.js';

const receipts=[
 ['lever','https://jobs.lever.co/acme/123/thanks','<div class="thanks">Thanks!</div>'],
 ['successfactors','https://acme.successfactors.com/careers','<div id="applyConfirmMsg">Complete</div>'],
 ['icims','https://careers-acme.icims.com/jobs/123/engineer/job','<div class="iCIMS_SuccessMessage">Thank you</div>'],
 ['workable','https://apply.workable.com/acme/j/ABC/apply/','<div data-ui="successful-submit"></div>'],
 ['rippling','https://ats.rippling.com/acme/jobs/123?step=confirmation',''],
 ['ashby','https://jobs.ashbyhq.com/acme/123','<h2>Success!</h2>'],
 ['smartrecruiters','https://jobs.smartrecruiters.com/oneclick-ui/company/acme/job/123','<oc-success-page-content></oc-success-page-content>'],
 ['paylocity','https://recruiting.paylocity.com/Recruiting/Jobs/Apply/123','<div id="appSubmitResponseDiv"></div>'],
 ['freshteam','https://acme.freshteam.com/jobs/123/engineer','<div id="applicant-success"></div>'],
 ['dover','https://app.dover.com/apply/acme/abcd-123','<div>Thanks for applying!</div>'],
 ['pinpoint','https://acme.pinpointhq.com/en/postings/abcd-123/applications/thanks','<p>Your application was received successfully.</p>'],
 ['comeet','https://www.comeet.co/jobs/acme/123/apply','<p>Your application has been submitted</p>'],
 ['gusto','https://jobs.gusto.com/postings/acme-123/applicants','<ul><li></li><li></li><li><span>Thank you</span></li></ul>'],
 ['polymer','https://jobs.polymer.co/acme/123','<h2>Your application has been sent!</h2>'],
 ['adp','https://workforcenow.adp.com/mascsr/recruitment?cid=acme&jobId=123','<div id="vdlContainerFluid"><div class="success-message-container"></div></div>'],
 ['jobvite','https://jobs.jobvite.com/acme/job/123/applyConfirmation','<div class="jv-page-applyconfirm"></div>'],
 ['ultipro','https://acme.ultipro.com/JobBoard/123','<div id="ApplicationSubmitted"></div>'],
 ['tesla','https://www.tesla.com/careers/search/job/apply/123','<div class="Confirmation_done"></div>'],
 ['tiktok','https://careers.tiktok.com/resume/applied',''],
 ['eightfold','https://acme.eightfold.ai/careers?pid=123','<div data-test-id="success-form"></div>'],
 ['seek','https://www.seek.com.au/job/123/apply','<div id="applicationSent"></div>'],
 ['bamboohr','https://acme.bamboohr.com/careers/123','<a>See all job openings</a>'],
 ['dayforce','https://acme.dayforcehcm.com/jobs/123','<div test-id="success-dayforce-jobs"></div>'],
 ['indeed','https://smartapply.indeed.com/post-apply',''],
 ['linkedin','https://www.linkedin.com/jobs/view/123/','<div aria-labelledby="post-apply-modal"></div>']
];
for(const [provider,url,html]of receipts)test(`SpeedyApply ${provider} success marker is recognized without depending on generic English receipt text`,t=>{
 const page=new Window({url});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML=html;const snapshot=speedySubmissionSnapshot(page.document);assert.equal(snapshot.provider,provider);assert.equal(snapshot.receipt.provider,provider);
});

test('every restored platform references its original SpeedyApply adapter and no full legacy runtime is loaded',async()=>{
 const original=await readFile('Baseline/SpeedyApply/content-scripts/content.js','utf8');
 assert.equal(SPEEDY_SUBMISSION_RULES.length,31);assert.equal(new Set(SPEEDY_SUBMISSION_RULES.map(rule=>rule.id)).size,31);
 for(const rule of SPEEDY_SUBMISSION_RULES)for(const symbol of rule.source.split(' / '))assert.ok(original.includes('function '+symbol+'(')||original.includes('function '+symbol+'{'),rule.id+': '+symbol);
 const manifest=JSON.parse(await readFile('extension/manifest.json','utf8'));assert.ok(manifest.content_scripts.every(script=>!script.js.includes('content-scripts/content.js')));
});

test('original metadata preserves the Greenhouse embedded requisition, company and role',t=>{
 const page=new Window({url:'https://job-boards.greenhouse.io/embed/job_app?for=acme&token=8938360002&jr_id=tracking'});t.after(()=>page.happyDOM.abort());page.document.title='Job Application for Engineer at Acme';page.document.body.innerHTML='<div class="job__title"><h1>Engineer</h1></div><a class="logo" href="https://acme.test/"></a>';
 assert.deepEqual(speedyApplicationMetadata(page.document),{jobTitle:'Engineer',companyName:'Acme',jobLink:'https://job-boards.greenhouse.io/acme/jobs/8938360002',companyLink:'https://acme.test'});
});

test('Comeet uses the original nested POSITION_DATA object rather than unrelated names',t=>{
 const page=new Window({url:'https://www.comeet.co/jobs/acme/123/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<script>var POSITION_DATA = {"name":"Unrelated","position":{"position_uid":"123","name":"Engineer","company_name":"Acme","careers_page_url":"https://www.comeet.co/jobs/acme/123"}};</script>';
 const result=speedyApplicationMetadata(page.document);assert.equal(result.jobTitle,'Engineer');assert.equal(result.companyName,'Acme');assert.equal(result.jobLink,'https://www.comeet.co/jobs/acme/123');
});

test('Workday review controls and progress follow the original page dispatcher, while non-career Tesla pages are ignored',t=>{
 const page=new Window({url:'https://acme.wd1.myworkdayjobs.com/en-US/External/job/NY/Engineer_R123/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<div data-automation-id="applyFlowReviewPage"><h3>Engineer</h3><button data-automation-id="pageFooterNextButton"><svg></svg></button></div>';
 assert.equal(speedySubmissionSnapshot(page.document).stage,'Review application');assert.equal(speedySubmissionControl(page.document.querySelector('button')).kind,'submit');
 const shop=new Window({url:'https://www.tesla.com/shop/checkout'});t.after(()=>shop.happyDOM.abort());shop.document.body.innerHTML='<div class="Confirmation_order"></div>';assert.equal(speedyRuleForDocument(shop.document),null);
});

test('the original submit/departure fallback observes clicks without filling, rejects invalid forms and honors its timeout',async t=>{
 const page=new Window({url:'https://job-boards.greenhouse.io/acme/jobs/123'});t.after(()=>page.happyDOM.abort());page.document.title='Job Application for Engineer at Acme';page.document.body.innerHTML='<form><input id="name"><div class="application--submit"><button type="submit">Send</button></div></form>';page.document.querySelector('form').addEventListener('submit',event=>event.preventDefault());
 const events=[];let clock=10000;const tracker=createSpeedySubmissionTracker(page.document,{emit:async event=>{events.push(event);return{ok:true};},isTrusted:()=>true,now:()=>clock});t.after(()=>tracker.dispose());await tracker.refresh();
 const click=()=>page.document.querySelector('button').dispatchEvent(new page.MouseEvent('click',{bubbles:true,composed:true,button:0}));
 click();await delay(0);assert.equal(page.document.querySelector('input').value,'');assert.ok(events.some(event=>event.kind==='speedy-intent'&&event.action==='submit'));
 page.document.querySelector('input').dispatchEvent(new page.Event('invalid',{bubbles:true}));page.dispatchEvent(new page.Event('beforeunload'));assert.equal(events.filter(event=>event.kind==='speedy-confirmed').length,0);
 clock+=2000;click();clock+=5001;page.dispatchEvent(new page.Event('beforeunload'));assert.equal(events.filter(event=>event.kind==='speedy-confirmed').length,0);
 clock+=2000;click();page.dispatchEvent(new page.Event('beforeunload'));assert.equal(events.filter(event=>event.kind==='speedy-confirmed').length,1);assert.equal(events.at(-1).proof.kind,'speedy-departure');
});

function source(app,url='https://job-boards.greenhouse.io/acme/jobs/123',provider='greenhouse'){
 const rule=SPEEDY_SUBMISSION_RULES.find(rule=>rule.id===provider),metadata={jobTitle:'Engineer',companyName:'Acme',jobLink:url,companyLink:'https://acme.test/'};
 const sender={id:app.browser.runtime.id,url,documentId:'source-document',frameId:0,tab:{id:7,windowId:41,url}};
 const send=(kind,extra={})=>app.pageEvent({kind,provider,url,metadata,...extra},sender);
 return {send,metadata,sender,rule,proof:{kind:'speedy-receipt',provider,rule:rule.source,text:'Application submitted'}};
}

test('original tracking records a real submission without a queue or dock run and increments applications exactly once',async t=>{
 const app=await applyFixture(t),s=source(app);app.openTabs.set(7,{...s.sender.tab,active:true});
 await s.send('speedy-context',{stage:'Application form'});await s.send('speedy-intent',{action:'submit',attemptId:'attempt',at:Date.now()});assert.equal((await app.request('DOCK_APPLY_STATE')).submission.phase,'submitting');
 const before=app.browser.storage.local.values.appliedList.length;
 await s.send('speedy-confirmed',{proof:s.proof});let state=await app.request('DOCK_APPLY_STATE');assert.equal(state.submission.phase,'submitted');assert.ok(state.submission.applicationId);assert.equal(app.browser.storage.local.values.appliedList.length,before+1);
 app.restart();await s.send('speedy-confirmed',{proof:s.proof});assert.equal(app.browser.storage.local.values.appliedList.length,before+1);assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).jobs.length,0);
 const row=app.browser.storage.local.values.appliedList[0];assert.equal(row.jobTitle,'Engineer');assert.equal(row.companyName,'Acme');assert.ok(row.createdAt);assert.equal(referenceDashboardData({appliedList:[row]}, {},new Date(row.createdAt)).applications,1);
});

test('platform and current-run observers share the same queue conversion and never double count',async t=>{
 const app=await applyFixture(t),s=source(app),created=await app.mutate('create',null,{company:'Acme',role:'Engineer',url:s.metadata.jobLink,description:'Build software.'}),job=created.jobs.find(job=>job.id===created.selectedId);app.employer('<form><button type="button">Submit</button></form>',job.url);
 await app.request('DOCK_APPLY_TRACK',{jobId:job.id,tabId:7});const initial=(await app.storage.get('dock-apply-run:v1:41'))['dock-apply-run:v1:41'];
 const before=app.browser.storage.local.values.appliedList.length;await s.send('speedy-confirmed',{proof:s.proof});const state=await app.request('DOCK_APPLY_STATE');assert.equal(state.run.phase,'submitted');assert.equal(state.run.applicationId,state.submission.applicationId);assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).jobs.length,0);
 await app.pageEvent({kind:'state',url:job.url,runId:`${initial.id}:0`,token:initial.trackingToken,scan:{url:job.url,fields:[]},receipt:{text:'Thank you for applying'}},{...s.sender,documentId:'document-7'});await s.send('speedy-confirmed',{proof:s.proof});assert.equal(app.browser.storage.local.values.appliedList.length,before+1);
});

test('recording preference, foreign senders and expired departure proofs cannot increment applications',async t=>{
 const app=await applyFixture(t),s=source(app),before=app.browser.storage.local.values.appliedList.length;
 await app.browser.storage.local.set({[AUTOFILL_SETTINGS_KEY]:{record:false}});await s.send('speedy-confirmed',{proof:s.proof});assert.equal(app.browser.storage.local.values.appliedList.length,before);
 await assert.rejects(()=>app.pageEvent({kind:'speedy-confirmed',provider:'greenhouse',url:s.sender.url,metadata:s.metadata,proof:s.proof},{...s.sender,id:'other-extension'}),/Invalid submission observer/);
 await assert.rejects(()=>s.send('speedy-confirmed',{proof:{kind:'speedy-departure',provider:'greenhouse',rule:s.rule.source}}),/no longer current/);assert.equal(app.browser.storage.local.values.appliedList.length,before);
});

test('Workday retains the successful-finalize guard when restoring its original review-page submit selector',async t=>{
 const app=await applyFixture(t),s=source(app,'https://acme.wd1.myworkdayjobs.com/en-US/External/job/NY/Engineer_R123/apply','workday'),before=app.browser.storage.local.values.appliedList.length,at=Date.now();
 await s.send('speedy-intent',{action:'submit',attemptId:'workday-submit',at});
 const proof={kind:'speedy-workday',provider:'workday',rule:s.rule.source,attemptId:'workday-submit',pageUrl:s.sender.url,requestPath:'/wday/cxs/acme/jobapplication/application123/finalize',applicationId:'application123',startedAt:Date.now(),status:400,success:false};
 await s.send('speedy-confirmed',{proof});assert.equal(app.browser.storage.local.values.appliedList.length,before);
 await s.send('speedy-confirmed',{proof:{...proof,status:200,success:true}});assert.equal(app.browser.storage.local.values.appliedList.length,before+1);
});

test('submission attempt binding also works on HTTP employer pages without randomUUID',()=>{
 assert.match(submissionAttemptId({getRandomValues:bytes=>bytes.fill(37)}),/^[a-f0-9]{32}$/);assert.equal(submissionAttemptId({randomUUID:()=> 'native-id'}),'native-id');
});
