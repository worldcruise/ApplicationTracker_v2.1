import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {IDBFactory} from 'fake-indexeddb';
import {mountAutofillProfile} from '../extension/ai-apply/src/profile-editor.mjs';
import {resumeUploadPayload,profileResumePreview,changedProfileSections} from '../extension/ai-apply/src/resume-profile-upload.mjs';
import {createSingleProfileService} from '../extension/studio/single-profile-service.js';
import {emptyProfile} from '../extension/studio/profile-model.js';
import {createDocumentFileStore} from '../extension/ai-apply/src/document-file-store.mjs';

const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function serviceFixture(initial=null){
 let current=initial?{id:'same-profile',revision:4,profile:structuredClone(initial)}:null,parsed=0,saved=0;
 const profiles={bootstrap:async()=>structuredClone(current),replaceProfile:async value=>{saved++;current={id:current?.id||'same-profile',revision:(current?.revision||0)+1,profile:structuredClone(value.profile)};return structuredClone(current);}};
 const service=createSingleProfileService({profiles,parseResume:async()=>{parsed++;return {profile:{nameData:{firstName:'Extracted',lastName:'Person',preferredName:false},skillsData:['TypeScript'],jobData:[{jobTitle:'Engineer',company:'New Employer',location:'Remote',startDate:'2023',endDate:'',currentlyWorkHere:true,description:'Built products.'}]},source:{pageCount:2},warnings:['Review the extracted details.']};}});
 return {service,get current(){return current;},get parsed(){return parsed;},get saved(){return saved;}};
}

test('upload prepares a new profile without saving; reviewed fields create it once without reparsing',async()=>{
 const fixture=serviceFixture(),upload={base64:btoa('%PDF-1.7 source'),fileName:'resume.pdf',expectedRevision:null};
 const prepared=await fixture.service.handle('PROFILE_RESUME_PREVIEW',upload);assert.equal(fixture.saved,0);assert.equal(fixture.current,null);assert.equal(prepared.source.pageCount,2);assert.equal(prepared.profile.nameData.firstName,'Extracted');
 prepared.profile.nameData.firstName='Reviewed';const result=await fixture.service.handle('PROFILE_RESUME_IMPORT',{profile:prepared.profile,expectedProfile:prepared.expectedProfile,mutationId:crypto.randomUUID()});
 assert.equal(result.candidate.profile.nameData.firstName,'Reviewed');assert.equal(fixture.parsed,1);assert.equal(fixture.saved,1);assert.equal(result.candidate.profile.resumeData.fileName,'resume.pdf');
});

test('replacement retains one identity, preferences and missing personal fields, and protects against stale edits',async()=>{
 const original=emptyProfile();original.nameData.firstName='Before';original.addressData.city='Boston';original.employmentData.sponsorship=false;original.employmentData.expectedSalary='$130,000';
 const fixture=serviceFixture(original),upload={base64:btoa('%PDF-1.7 replacement'),fileName:'replacement.pdf',expectedRevision:4};
 const prepared=await fixture.service.handle('PROFILE_RESUME_PREVIEW',upload);assert.equal(fixture.current.profile.nameData.firstName,'Before');assert.equal(prepared.profile.nameData.firstName,'Extracted');assert.equal(prepared.profile.employmentData.expectedSalary,'$130,000');assert.equal(prepared.profile.employmentData.sponsorship,false);assert.equal(prepared.profile.addressData.city,'Boston');assert.ok(changedProfileSections(original,prepared.profile).includes('experience'));
 await fixture.service.handle('PROFILE_RESUME_IMPORT',{profile:prepared.profile,expectedProfile:prepared.expectedProfile,mutationId:crypto.randomUUID()});assert.equal(fixture.current.id,'same-profile');
 await assert.rejects(fixture.service.handle('PROFILE_RESUME_PREVIEW',upload),/profile changed/);await assert.rejects(fixture.service.handle('PROFILE_RESUME_IMPORT',{profile:prepared.profile,expectedProfile:original}),/profile changed/);
});

test('resume upload is a guided form review with preview, discard, and explicit save',async t=>{
 const win=new Window();t.after(()=>win.happyDOM.abort());const root=win.document.createElement('main');win.document.body.append(root);const original=emptyProfile();original.nameData.firstName='Original';const fixture=serviceFixture(original);
 const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:fixture.current}),preview:payload=>fixture.service.handle('PROFILE_RESUME_PREVIEW',payload),save:payload=>fixture.service.handle(payload.importResume?'PROFILE_RESUME_IMPORT':'PROFILE_SAVE',payload),previewPDF:async()=> 'chrome-extension://test/preview.html?aiFile=uploaded&embedded=1'});await editor.ready;
 const file=new win.File(['%PDF-1.7 source'],'updated.pdf',{type:'application/pdf'});await editor.upload(file);
 assert.equal(fixture.saved,0);assert.equal(root.querySelector('.af-review-banner').hidden,false);assert.equal(root.querySelectorAll('.af-changed-dot').length,3);assert.match(root.querySelector('.af-resume-file').textContent,/updated.pdf/);assert.equal(root.querySelector('textarea[aria-label="Parsed profile JSON"]'),null);
 [...root.querySelectorAll('button')].find(button=>button.textContent==='Preview PDF').click();await flush();assert.match(root.querySelector('iframe').src,/preview.html\?aiFile=/);
 root.querySelector('.af-review-banner button').click();assert.equal(fixture.saved,0);assert.equal(root.querySelector('.af-review-banner').hidden,true);root.querySelector('[data-section=personal]').click();assert.equal(root.querySelector('[name=firstName]').value,'Original');
 await editor.upload(file);root.querySelector('[data-section=personal]').click();const name=root.querySelector('[name=firstName]');name.value='My corrected name';name.dispatchEvent(new win.Event('change'));root.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));await flush();
 assert.equal(fixture.saved,1);assert.equal(fixture.current.profile.nameData.firstName,'My corrected name');assert.equal(fixture.current.profile.resumeData.fileName,'updated.pdf');assert.equal(root.querySelector('.af-review-banner').hidden,true);assert.equal(root.querySelectorAll('.af-changed-dot').length,0);assert.equal(root.querySelector('.af-close'),null);editor.dispose();
});

test('invalid or failed uploads preserve the current draft and cannot save a broken resume',async t=>{
 const win=new Window();t.after(()=>win.happyDOM.abort());await assert.rejects(resumeUploadPayload(new win.File(['not pdf'],'resume.pdf')),/valid PDF/);await assert.rejects(resumeUploadPayload(new win.File(['%PDF-1.7'],'resume.exe')),/PDF or DOCX/);
 const root=win.document.createElement('main'),original=emptyProfile();original.nameData.firstName='Kept';win.document.body.append(root);let saved=0;
 const editor=mountAutofillProfile(root,{read:async()=>({candidate:{profile:original,revision:1}}),preview:async()=>{throw Error('This PDF is password-protected.');},save:async()=>saved++});await editor.ready;await editor.upload(new win.File(['%PDF-1.7 locked'],'locked.pdf'));
 assert.equal(saved,0);assert.match(root.querySelector('[role=status]').textContent,/password-protected/);assert.equal(root.querySelector('[name=firstName]').value,'Kept');assert.equal(root.querySelector('.af-review-banner').hidden,true);
});

test('uploaded PDF preview uses Resume Studio and preserves the original file bytes',async()=>{
 const store=createDocumentFileStore({indexedDB:new IDBFactory()}),profile=emptyProfile();profile.resumeData={resumeBase64:btoa('%PDF original file'),fileName:'original.pdf'};
 const url=await profileResumePreview(profile,{browser:{runtime:{getURL:path=>'chrome-extension://test/'+path}},store,key:'preview/test-profile.pdf'});assert.match(url,/preview.html\?aiFile=preview%2Ftest-profile.pdf&embedded=1/);const file=await store.get('preview/test-profile.pdf');assert.equal(new TextDecoder().decode(file.bytes),'%PDF original file');assert.equal(file.filename,'original.pdf');
});

test('resume replacement status follows file reading, parser response, review and explicit saving',async t=>{
 const win=new Window();t.after(()=>win.happyDOM.abort());const root=win.document.createElement('main');win.document.body.append(root);
 const original=emptyProfile();original.nameData.firstName='Before';let releaseRead,releaseParse,releaseSave,parseCalls=0,saveCalls=0,reviewed;
 const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:{profile:original,revision:1}}),preview:async payload=>{
   parseCalls++;await new Promise(resolve=>releaseParse=resolve);reviewed={...structuredClone(original),nameData:{...original.nameData,firstName:'Parsed'},resumeData:{resumeBase64:payload.base64,fileName:payload.fileName,fileSize:20,dateUploaded:'2026-11-13'}};
   return {profile:reviewed,expectedProfile:original,revision:1};
 },save:async payload=>{saveCalls++;await new Promise(resolve=>releaseSave=resolve);return {candidate:{profile:payload.profile,revision:2}};}});t.after(()=>editor.dispose());await editor.ready;
 const bytes=new TextEncoder().encode('%PDF-1.7 resume'),file={name:'replacement.pdf',size:bytes.length,arrayBuffer:()=>new Promise(resolve=>releaseRead=()=>resolve(bytes.buffer))};
 const upload=editor.upload(file),button=root.querySelector('.af-footer .af-primary'),status=root.querySelector('.af-message');
 const uploadButton=root.querySelector('.af-upload-drop');assert.equal(uploadButton.querySelector('strong').textContent,'Reading resume…');assert.match(uploadButton.querySelector('.af-upload-description').textContent,/Reading and checking/);assert.equal(uploadButton.disabled,true);
 assert.equal(button.textContent,'Reading resume…');assert.match(status.textContent,/Reading and checking/);assert.equal(parseCalls,0);assert.equal(button.disabled,true);
 releaseRead();await flush();assert.equal(parseCalls,1);assert.equal(button.textContent,'Processing resume…');assert.match(status.textContent,/Waiting for the parsing result/);assert.equal(saveCalls,0);
 assert.equal(uploadButton.querySelector('strong').textContent,'Processing resume…');assert.match(uploadButton.querySelector('.af-upload-description').textContent,/Waiting for the parsing result/);
 releaseParse();await upload;assert.match(status.textContent,/ready to review/);assert.equal(button.textContent,'Save profile');assert.equal(button.disabled,false);assert.equal(original.nameData.firstName,'Before');
 root.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));assert.equal(button.textContent,'Saving profile…');assert.match(status.textContent,/Saving your reviewed/);assert.equal(saveCalls,1);
 releaseSave();await flush();assert.match(status.textContent,/Profile saved/);assert.equal(button.textContent,'Save profile');assert.equal(button.disabled,false);assert.equal(parseCalls,1);
 assert.equal(root.querySelector('.af-upload-drop strong').textContent,'Drop a new resume to replace it');assert.equal(root.querySelector('.af-upload-drop').disabled,false);
});
