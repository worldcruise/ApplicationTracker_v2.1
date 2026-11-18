import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {setTimeout as delay} from 'node:timers/promises';
import {emptyProfile,profileToStudio} from '../extension/studio/profile-model.js';
import {withProfileResumeJSON} from '../extension/studio/profile-resume-json.js';
import {createProfileResumeRenderer} from '../extension/studio/profile-resume-renderer.js';
import {createSingleProfileService} from '../extension/studio/single-profile-service.js';
import {profileStudioResumePreview} from '../extension/ai-apply/src/resume-profile-upload.mjs';
import {mountAutofillProfile} from '../extension/ai-apply/src/profile-editor.mjs';

function source(){const profile=emptyProfile();profile.nameData.firstName='Jordan';profile.nameData.lastName='Taylor';profile.contactData.email='jordan@example.test';profile.jobData=[{company:'Example',jobTitle:'Engineer',location:'Boston',startDate:'2020-01',endDate:'',currentlyWorkHere:true,description:'• Built reliable systems.\n- Reviewed designs.'}];profile.educationData=[{school:'Example University',degree:"Bachelor's",fieldOfStudy:'Engineering',startDate:'2014-09',endDate:'2018-05',currentlyAttending:false}];profile.skillsData=['JavaScript'];profile.resumeData={resumeBase64:btoa('%PDF-1.7 original upload'),fileName:'Original.pdf',fileSize:25,dateUploaded:'2026-11-01'};return profile;}

test('a saved resume has the six-field Studio JSON object while original upload bytes and profile facts stay intact',()=>{
  const input=source(),original=structuredClone(input),profile=withProfileResumeJSON(input);
  assert.deepEqual(Object.keys(profile.resumeData.cv),['company','title','summary','skills','experience','education']);assert.deepEqual(JSON.parse(profile.resumeData.cvJsonRaw),profile.resumeData.cv);
  assert.equal(profile.resumeData.cv.title,'Engineer');assert.equal(profile.resumeData.cv.company,'Unknown');assert.deepEqual(profile.resumeData.cv.experience[0].sentences,['Built reliable systems.','Reviewed designs.']);
  assert.equal(profile.resumeData.resumeBase64,input.resumeData.resumeBase64);assert.deepEqual(profile.jobData,input.jobData);assert.deepEqual(input,original);assert.equal(profile.resumeData.cv.experience[0].location,undefined);
});

test('rendering uses the saved default Studio template without creating or changing an editor draft',async()=>{
  const profile=withProfileResumeJSON(source()),document=profileToStudio(profile,'candidate'),calls=[];document.applicationPreferences={defaultDocumentStyle:{documentTemplate:{id:'harvard',version:1},formattingOverrides:{headerAlignment:'right'}}};
  const candidate={id:'candidate',revision:3,profile,document},before=structuredClone(candidate);
  const render=createProfileResumeRenderer({makeSnapshot:(record,draft)=>{calls.push({record,draft});return {snapshot:{candidate:record.document.candidate,resume:JSON.parse(draft.cvJsonRaw),documentTemplate:draft.documentTemplate,formattingOverrides:draft.formattingOverrides}};},renderRecordPDF:async(record,kind)=>{assert.equal(kind,'resume');assert.equal(record.resume.snapshot.documentTemplate.id,'harvard');return {base64:btoa('%PDF-1.7 styled')};}});
  const result=await render({profile},candidate);assert.ok(atob(result.base64).startsWith('%PDF-'));assert.deepEqual(calls[0].draft.formattingOverrides,{headerAlignment:'right'});assert.equal(calls[0].record.document.personalDetails.email,profile.contactData.email);assert.deepEqual(candidate,before);
});

test('the preview service checks the profile revision and never reparses or saves the uploaded file',async()=>{
  const profile=withProfileResumeJSON(source()),candidate={id:'candidate',revision:2,profile};let renders=0;
  const service=createSingleProfileService({profiles:{bootstrap:async()=>candidate,replaceProfile:()=>{throw Error('Do not save a preview');}},parseResume:()=>{throw Error('Do not reparse a preview');},renderResume:async()=>{renders++;return {base64:btoa('%PDF-1.7 styled')};}});
  await assert.rejects(()=>service.handle('PROFILE_RESUME_RENDER',{profile,expectedRevision:1}),/profile changed/);assert.equal(renders,0);
  const rendered=await service.handle('PROFILE_RESUME_RENDER',{profile,expectedRevision:2});assert.ok(rendered.base64);assert.equal(renders,1);
});

test('the styled preview stores the generated PDF rather than the original upload',async()=>{
  const profile=source(),files=[];let input;
  const url=await profileStudioResumePreview(profile,{expectedRevision:4,key:'preview/current.pdf',browser:{runtime:{getURL:file=>'chrome-extension://test/'+file}},store:{put:async file=>files.push(file)},render:async payload=>{input=payload;return {base64:btoa('%PDF-1.7 Studio output'),filename:'Jordan Taylor.pdf'};}});
  assert.equal(input.expectedRevision,4);assert.equal(input.profile.resumeData.resumeBase64,profile.resumeData.resumeBase64);assert.equal(new TextDecoder().decode(files[0].bytes),'%PDF-1.7 Studio output');assert.equal(files[0].filename,'Jordan Taylor.pdf');assert.equal(new URL(url).searchParams.get('aiFile'),'preview/current.pdf');
});

test('Profile displays the styled current resume automatically and ignores a stale preview after navigating away',async t=>{
  const win=new Window({settings:{disableIframePageLoading:true}});t.after(()=>win.happyDOM.abort());const root=win.document.createElement('div');win.document.body.append(root);let resolve;const profile=withProfileResumeJSON(source());
  const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:{profile,id:'candidate',revision:2}}),save:async()=>{},styledPreview:()=>new Promise(r=>resolve=r)});t.after(()=>editor.dispose());await editor.ready;
  assert.match(root.querySelector('.af-styled-resume').textContent,/default Resume Studio style/);assert.equal(root.querySelector('.af-cv-json').value,profile.resumeData.cvJsonRaw);
  resolve('chrome-extension://test/preview.html?styled=1');await delay(0);assert.match(root.querySelector('iframe').title,/Resume Studio style/);
  root.querySelector('[data-section=personal]').click();assert.equal(root.querySelector('iframe'),null);
});

test('the first Resume preview survives its host being attached after rendering completes',async t=>{
  const win=new Window({settings:{disableIframePageLoading:true}});t.after(()=>win.happyDOM.abort());
  const root=win.document.createElement('div'),profile=withProfileResumeJSON(source());
  const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:{profile,revision:2}}),save:async()=>{},styledPreview:async()=>'chrome-extension://test/preview.html?first=1'});
  t.after(()=>editor.dispose());await editor.ready;await delay(0);
  win.document.body.append(root);
  assert.equal(root.querySelector('.af-styled-resume iframe')?.getAttribute('src'),'chrome-extension://test/preview.html?first=1');
  assert.equal(root.querySelector('.af-styled-resume [role=status]'),null);
});

test('a completed old Resume preview cannot replace the active section or a newer preview',async t=>{
  const win=new Window({settings:{disableIframePageLoading:true}});t.after(()=>win.happyDOM.abort());
  const root=win.document.createElement('div');win.document.body.append(root);const pending=[];
  const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:{profile:withProfileResumeJSON(source()),revision:2}}),save:async()=>{},styledPreview:()=>new Promise(resolve=>pending.push(resolve))});
  t.after(()=>editor.dispose());await editor.ready;
  root.querySelector('[data-section=personal]').click();pending[0]('chrome-extension://test/preview.html?old=1');await delay(0);
  assert.equal(root.querySelector('iframe'),null);assert.equal(root.querySelector('h2').textContent,'Personal information');
  root.querySelector('[data-section=resume]').click();pending[1]('chrome-extension://test/preview.html?current=1');await delay(0);
  assert.match(root.querySelector('iframe').src,/current=1/);
});
