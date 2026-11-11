import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';
import {mountApplyDock} from '../extension/studio/apply-dock-view.js';
import {profileFromQueueResume} from '../extension/studio/queue-resume-import.js';

async function until(check){for(let index=0;index<80;index++){if(await check())return;await delay(10);}throw Error('Expected queue view did not arrive.');}

test('five sample jobs seed once per candidate, remain removable and cannot become real applications',async t=>{
  const app=await applyFixture(t),real=await app.create(),candidate=await app.deps.profiles.bootstrap(),before=structuredClone(app.browser.storage.local.values.appliedList);
  const seeded=await app.recordsRequest('DOCK_RECORDS_SEED_SAMPLES'),samples=seeded.jobs.filter(job=>job.isMock);
  assert.equal(samples.length,5);assert.ok(seeded.jobs.some(job=>job.id===real.id));assert.equal(new Set(samples.map(job=>job.company)).size,5);
  assert.ok(samples.every(job=>job.status==='Ready'&&job.resume.snapshot.candidate.id===candidate.id));
  await app.recordsRequest('DOCK_RECORDS_SEED_SAMPLES');assert.equal((await app.request('DOCK_APPLY_STATE')).jobs.length,5);
  await assert.rejects(app.start(samples[0]),/Preview jobs cannot be used for applications/);
  await assert.rejects(app.mutate('apply',samples[0]),/Preview jobs cannot be used for applications/);
  await assert.rejects(app.recordsRequest('DOCK_RECORDS_STUDIO',{id:samples[0].id,expectedRevision:1,windowId:41}),/Preview jobs cannot be used for applications/);
  const imported=await app.request('DOCK_APPLY_IMPORT',{action:'queue-json',jobId:samples[0].id});assert.equal(imported.previewOnly,true);assert.equal(imported.token,undefined);
  await assert.rejects(app.request('DOCK_APPLY_IMPORT',{action:'apply',jobId:samples[0].id,token:'sample'}),/profile or job changed/);
  assert.deepEqual(await app.deps.profiles.bootstrap(),candidate);assert.deepEqual(app.browser.storage.local.values.appliedList,before);assert.equal(app.tabs.length,0);
  await app.mutate('delete',samples[0]);await app.recordsRequest('DOCK_RECORDS_SEED_SAMPLES');assert.equal((await app.request('DOCK_APPLY_STATE')).jobs.filter(job=>job.isMock).length,4);
  await app.request('DOCK_APPLY_SELECT',{candidateId:'candidate-2'});const second=await app.recordsRequest('DOCK_RECORDS_SEED_SAMPLES');assert.equal(second.jobs.length,5);assert.ok(second.jobs.every(job=>job.candidateId==='candidate-2'));
});

test('queue JSON imports tailored text by stable work binding without reparsing the PDF or changing factual profile fields',async t=>{
  const app=await applyFixture(t),candidate=app.profiles.get('candidate-1');
  const work=(company,jobTitle)=>({company,jobTitle,location:'Boston',startDate:'2020-01',endDate:'2022-01',currentlyWorkHere:false,description:'Original description'});
  candidate.profile.jobData=[work('First Employer','Engineer'),work('Second Employer','Developer')];candidate.document.companies=[{id:'first-work'},{id:'second-work'}];
  const before=structuredClone(candidate.profile),job=await app.ready(await app.create(),{cv:{company:'Example',title:'Engineer',summary:'Tailored summary',skills:[{Technical:['React','SQL','React']}],experience:[{company:'Second Employer',sentences:['Delivered accessible interfaces.','Improved build performance.']}],education:[]},bindings:{experience:['second-work'],education:[]}});
  app.serviceDeps.parseResume=()=>{throw Error('Queue JSON must not call the file parser.');};app.restart();
  const review=await app.request('DOCK_APPLY_IMPORT',{action:'queue-json',jobId:job.id});assert.ok(review.token);assert.ok(review.changes.work[1].includes('Delivered accessible interfaces.'));assert.deepEqual(review.changes.skills,['React','SQL']);
  assert.deepEqual((await app.deps.profiles.bootstrap()).profile,before,'Review does not commit profile changes');assert.equal(app.rendered.length,1);
  await app.request('DOCK_APPLY_IMPORT',{action:'apply',jobId:job.id,token:review.token});const updated=(await app.deps.profiles.bootstrap()).profile;
  assert.deepEqual(updated.nameData,before.nameData);assert.deepEqual(updated.contactData,before.contactData);assert.deepEqual(updated.educationData,before.educationData);assert.equal(updated.profileName,before.profileName);
  assert.deepEqual(updated.jobData[0],before.jobData[0]);assert.deepEqual(updated.jobData[1],{...before.jobData[1],description:'Delivered accessible interfaces.\nImproved build performance.'});assert.deepEqual(updated.skillsData,['React','SQL']);assert.ok(updated.resumeData.resumeBase64);
  const next=await app.request('DOCK_APPLY_IMPORT',{action:'queue-json',jobId:job.id});app.bumpProfile();await assert.rejects(app.request('DOCK_APPLY_IMPORT',{action:'apply',jobId:job.id,token:next.token}),/profile or job changed/);
  const stale=structuredClone(job);stale.resume.snapshot.bindings.experience=['removed-work'];assert.throws(()=>profileFromQueueResume(candidate,stale),/no longer matches/);
});

test('Apply cards page through all five samples and connect each card to its URL, details and JSON source',async t=>{
  const app=await applyFixture(t),seeded=await app.recordsRequest('DOCK_RECORDS_SEED_SAMPLES'),page=new Window(),host=page.document.createElement('div');page.document.body.append(host);const details=[];
  app.browser.runtime.sendMessage=async message=>{try{return{ok:true,result:await app.request(message.operation,message.payload)};}catch(error){return{ok:false,error:{message:error.message}};}};
  const view=mountApplyDock(host,{browser:app.browser,privateStorage:app.storage,onQueue:id=>details.push(id)});t.after(()=>{view.close();return page.happyDOM.abort();});await view.ready;
  const $=selector=>host.querySelector(selector),action=name=>$(`[data-action="${name}"]`),click=async name=>{action(name).click();await until(()=>view.root.getAttribute('aria-busy')==='false');};
  assert.equal($('.aj-navigation h2').textContent,'Apply to Job');assert.equal($('.aj-header'),null);assert.equal($('#aj-upload-target'),null);assert.equal($('.aj-upload-box'),null);
  assert.equal($('#aj-job-position').textContent,'1/5');assert.equal(action('job-first').disabled,true);assert.equal(action('job-prev').disabled,true);assert.equal($('#aj-start').disabled,true);
  assert.deepEqual([...$('.aj-import-sources').children].map(button=>button.dataset.action),['import-queue-file','manual-upload']);assert.equal($('.aj-import-sources').querySelectorAll('button>svg').length,2);
  for(let index=1;index<5;index++){await click('job-next');assert.equal($('#aj-job-position').textContent,`${index+1}/5`);assert.equal($('#aj-prepared-company').textContent,seeded.jobs[index].company);}
  assert.equal(action('job-next').disabled,true);assert.equal(action('job-last').disabled,true);await click('job-prev');assert.equal($('#aj-job-position').textContent,'4/5');await click('job-first');assert.equal($('#aj-job-position').textContent,'1/5');await click('job-last');
  await click('job-url');assert.equal(app.tabs.at(-1).url,seeded.jobs[4].url);assert.equal($('#aj-target-tab').value,'101');await click('job-details');assert.deepEqual(details,[seeded.jobs[4].id]);
  await click('import-queue-file');assert.equal($('#aj-import-review').hidden,false);assert.equal($('#aj-import-source').textContent,'Preview only');assert.equal($('#aj-update-profile').disabled,true);
  await click('job-first');assert.equal($('#aj-import-review').hidden,true);assert.equal($('#aj-upload-name').hidden,true);
  let filePicker=0;$('#aj-file').addEventListener('click',()=>filePicker++);await click('manual-upload');assert.equal(filePicker,1);assert.equal($('#aj-file').hidden,true);
  const queued=await app.create('unprepared');await view.show(queued.id);assert.equal($('#aj-prepared-status').textContent,'Ready');assert.equal($('#aj-job-position').textContent,'1/5');assert.equal($('#aj-prepared-company').textContent,seeded.jobs[0].company);assert.equal((await app.request('DOCK_APPLY_STATE')).jobs.some(job=>job.id===queued.id),false);
});
