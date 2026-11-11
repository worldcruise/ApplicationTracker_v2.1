import assert from 'node:assert/strict';
import test from 'node:test';
import {IDBFactory} from 'fake-indexeddb';
import {createProfileRepository} from '../extension/studio/profile-repository.js';
import {createStudioStorage} from '../extension/studio/storage.js';
import {createSingleProfileService,isProfileSettingsSender} from '../extension/studio/single-profile-service.js';
import {emptyProfile} from '../extension/studio/profile-model.js';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

test('resume uploads create then update one canonical profile, preserving identity, preferences and backups',async t=>{
  const changes=event(),browser={storage:{local:memoryStorage({},changes,'local'),onChanged:changes}},storage=createStudioStorage({indexedDB:new IDBFactory(),BroadcastChannel:null});
  let pending=Promise.resolve();const queue=fn=>{const task=pending.then(fn);pending=task.catch(()=>{});return task;};
  const profiles=createProfileRepository({browser,storage,queue,parseLegacy:JSON.parse,validateLegacy:value=>value});
  t.after(async()=>{profiles.close();await pending;await storage.close();});
  let parsed={...emptyProfile(),nameData:{firstName:'First',lastName:'Person',preferredName:false},skillsData:['JavaScript']};
  const service=createSingleProfileService({profiles,parseResume:async()=>parsed});
  const upload={base64:'cGRm',fileName:'resume.pdf',expectedRevision:null,mutationId:crypto.randomUUID()};
  const first=(await service.handle('PROFILE_RESUME_UPLOAD',upload)).candidate;assert.equal(first.profile.nameData.firstName,'First');
  const edited=structuredClone(first.document);edited.applicationPreferences={assignedPromptTemplateId:'saved-prompt'};
  const selected=await profiles.save({candidateId:first.id,expectedRevision:first.revision,document:edited,mutationId:crypto.randomUUID()});
  parsed={nameData:{firstName:'Updated',lastName:'Person',preferredName:false},skillsData:['TypeScript'],jobData:[{jobTitle:'Engineer',company:'Example',location:'Remote',startDate:'2020-01',currentlyWorkHere:true,description:'Build software'}],educationData:[]};
  const next=(await service.handle('PROFILE_RESUME_UPLOAD',{...upload,fileName:'replacement.docx',expectedRevision:selected.revision,mutationId:crypto.randomUUID()})).candidate;
  assert.equal(next.id,first.id);assert.equal(next.profile.nameData.firstName,'Updated');assert.deepEqual(next.profile.skillsData,['TypeScript']);assert.equal(next.profile.resumeData.fileName,'replacement.docx');assert.equal(next.document.applicationPreferences.assignedPromptTemplateId,'saved-prompt');assert.equal((await profiles.list()).length,1);
  assert.equal((await browser.storage.local.get('profile')).profile.nameData.firstName,'Updated');
  assert.ok((await storage.get(`profile-backup:replacement:${first.id}:${selected.revision}`))[`profile-backup:replacement:${first.id}:${selected.revision}`]);
  await assert.rejects(service.handle('PROFILE_RESUME_UPLOAD',{...upload,expectedRevision:first.revision,mutationId:crypto.randomUUID()}),/profile changed/i);
  await assert.rejects(profiles.select('another-profile'),error=>error.code==='SINGLE_PROFILE');
  await assert.rejects(service.handle('PROFILE_RESUME_UPLOAD',{...upload,fileName:'script.js',expectedRevision:next.revision}),/PDF or DOCX/);
  const replaced=structuredClone(next.profile);replaced.resumeData={...replaced.resumeData,resumeBase64:'bmV3',fileName:'editor-replacement.pdf'};parsed={nameData:{firstName:'Replacement',lastName:'Person',preferredName:false},skillsData:['New resume facts'],jobData:[],educationData:[]};
  const throughEditor=(await service.handle('PROFILE_SAVE',{profile:replaced,expectedProfile:next.profile,mutationId:crypto.randomUUID()})).candidate;
  assert.equal(throughEditor.id,next.id);assert.equal(throughEditor.profile.nameData.firstName,'Replacement');assert.deepEqual(throughEditor.profile.skillsData,['New resume facts']);assert.equal(throughEditor.profile.resumeData.fileName,'editor-replacement.pdf');
});

test('profile upload requests are limited to the extension Profile page',()=>{
  const browser={runtime:{id:'test',getURL:path=>`chrome-extension://test/${path}`}},sender={id:'test',frameId:0,url:'chrome-extension://test/options.html#/settings/profile'};
  assert.equal(isProfileSettingsSender(sender,browser),true);
  for(const patch of [{id:'other'},{frameId:1},{url:'https://example.test/options.html#/settings/profile'},{url:'chrome-extension://test/options.html#/settings/prompts'}])assert.equal(isProfileSettingsSender({...sender,...patch},browser),false);
});
