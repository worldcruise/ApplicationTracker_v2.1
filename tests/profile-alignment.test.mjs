import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { IDBFactory } from 'fake-indexeddb';
import { createStudioStorage } from '../extension/studio/storage.js';
import { emptyProfile, normalizeProfile, profileToStudio, studioToProfile } from '../extension/studio/profile-model.js';
import { createProfileRepository } from '../extension/studio/profile-repository.js';
import { openStudioPreview } from '../extension/studio/dock.js';
import { openWebStudioPreview } from '../extension/studio/web-preview.js';

function profile() {
  return { ...emptyProfile(), profileName: 'Engineering',
    nameData: { firstName: 'Jane', middleName: 'M', lastName: 'Doe', preferredName: false },
    contactData: { email: 'jane@example.test', phoneDeviceType: 'Mobile', phoneCountryCode: '+1', phoneNumber: '5551234567' },
    addressData: { line1: '1 Example St', line2: 'Unit 2', city: 'Boston', state: 'MA', postalCode: '02110', country: 'United States of America' },
    websiteData: { websites: ['https://example.test'], github: 'https://github.com/example', linkedin: 'https://example.test/linkedin', personal: 'https://example.test' },
    jobData: [{ jobTitle: 'Engineer', company: 'Example', location: 'Boston', startDate: '01/2022', currentlyWorkHere: true, description: 'Built reliable software.' }],
    educationData: [{ school: 'Example University', degree: "Bachelor's", fieldOfStudy: 'Computer Science', startDate: '2017-09', endDate: '2021-05', currentlyAttending: false, gpa: '3.9' }],
    skillsData: ['JavaScript', 'Testing'], languageData: [{ language: 'English', fluent: true, proficiency: 'Native' }],
    resumeData: { resumeBase64: 'cHJlc2VydmVk', fileName: 'resume.pdf', fileSize: 9, dateUploaded: '2026-11-01' },
    employmentData: { gender: 'I choose not to disclose', ethnicity: 'I choose not to disclose', eligibilityUS: true, sponsorship: false, disability: 'undisclosed', veteran: 'undisclosed', age: 'undisclosed', hispanicOrLatino: 'undisclosed' },
  };
}

test('SpeedyApply profiles round-trip through the Studio view without changing Autofill fields', () => {
  const source = profile(), document = profileToStudio(source, 'one');
  assert.equal(document.candidate.name, 'Jane M Doe');
  assert.equal(document.personalDetails.email, source.contactData.email);
  assert.equal(document.companies[0].startDate, '2022-01');
  assert.equal(document.companies[0].current, true);
  assert.equal(document.professionalProfile.education[0].degree, "Bachelor's in Computer Science");
  assert.deepEqual(studioToProfile(document, source), source);
  assert.ok(!JSON.stringify(document).includes('sponsorship'));
  assert.ok(!JSON.stringify(document).includes('resumeBase64'));
  assert.throws(() => normalizeProfile({ ...source, employmentData: { gender: 'invalid', ethnicity: '' } }), /employment answers/);
  assert.throws(() => normalizeProfile({ ...source, languageData: [{ language: 'English', fluent: 'yes', proficiency: 'Native' }] }), /language answers/);
});

function event() {
  const listeners = new Set();
  return { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn), emit: (...args) => { for (const fn of listeners) fn(...args); } };
}
async function repository(t, initial = {}, privateValues = {}) {
  const changes = event(), values = structuredClone(initial);
  const browser = { storage: { onChanged: changes, local: {
    async get(keys) { return typeof keys === 'string' ? { [keys]: structuredClone(values[keys]) } : structuredClone(values); },
    async set(items) {
      Object.assign(values, structuredClone(items));
      changes.emit(Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { newValue }])), 'local');
    },
    async remove(key) { delete values[key]; changes.emit({ [key]: {} }, 'local'); },
  } } };
  const storage = createStudioStorage({ indexedDB: new IDBFactory(), BroadcastChannel: null });
  await storage.set(privateValues);
  let pending = Promise.resolve();
  const queue = fn => { const running = pending.then(fn); pending = running.catch(() => {}); return running; };
  const repo = createProfileRepository({ browser, storage, queue, parseLegacy: JSON.parse, validateLegacy: document => document });
  t.after(async () => { repo.close(); await pending; await storage.close(); });
  return { repo, storage, values, browser };
}

test('the existing SpeedyApply profile is canonical and its page edits refresh Studio with revision checks', async t => {
  const original = profile();
  const { repo, storage, browser, values } = await repository(t, { profile: original, appliedList: [{ jobTitle: 'Keep this' }] });
  const loaded = await repo.bootstrap();
  assert.deepEqual(loaded.profile, original);
  assert.equal((await repo.list())[0].name,'Jane M Doe');
  assert.equal((await repo.list({includeProfileName:true}))[0].profileName,'Engineering');
  const canonical = (await storage.get(`autofill-profile:${loaded.id}`))[`autofill-profile:${loaded.id}`];
  assert.equal(canonical.document, undefined);
  assert.deepEqual(canonical.profile, original);
  const edit = structuredClone(original);
  edit.jobData[0].jobTitle = 'Senior Engineer';
  await browser.storage.local.set({ profile: edit });
  await setImmediate();
  const refreshed = await repo.bootstrap();
  assert.equal(refreshed.revision, 2);
  assert.equal(refreshed.document.companies[0].title, 'Senior Engineer');
  await assert.rejects(repo.save({ candidateId: loaded.id, expectedRevision: 1, document: loaded.document, mutationId: crypto.randomUUID() }), error => error.code === 'CONFLICT');
  const saved = await repo.save({ candidateId: loaded.id, expectedRevision: 2, document: { ...refreshed.document, applicationPreferences: { preferredDocumentTemplateId: 'harvard' } }, mutationId: crypto.randomUUID() });
  assert.equal(saved.document.applicationPreferences.preferredDocumentTemplateId, 'harvard');
  assert.deepEqual(values.profile, edit);
  assert.deepEqual(values.appliedList, [{ jobTitle: 'Keep this' }]);
});

test('reviewed dock resume updates retain canonical fields, backups and revision checks',async t=>{
  const original=profile(),{repo,storage,values}=await repository(t,{profile:original});const current=await repo.bootstrap();
  const updated={...structuredClone(original),skillsData:['New skill']};
  const next=await repo.updateCanonical({candidateId:current.id,expectedRevision:current.revision,profile:updated,mutationId:crypto.randomUUID()});
  assert.equal(next.revision,current.revision+1);assert.deepEqual(values.profile.skillsData,['New skill']);assert.deepEqual(values.profile.employmentData,original.employmentData);assert.deepEqual(values.profile.contactData,original.contactData);
  assert.deepEqual((await storage.get(`profile-backup:resume-import:${current.id}:${current.revision}`))[`profile-backup:resume-import:${current.id}:${current.revision}`].profile,original);
  await assert.rejects(repo.updateCanonical({candidateId:current.id,expectedRevision:current.revision,profile:updated,mutationId:crypto.randomUUID()}),error=>error.code==='CONFLICT');
  await storage.set({'dock-apply-run:v1:41':{candidateId:current.id,phase:'questions'}});await assert.rejects(repo.select('another-candidate'),error=>error.code==='RUN_ACTIVE');
  assert.equal((await repo.select(current.id)).id,current.id);
});

test('legacy candidates migrate with backups without replacing an existing SpeedyApply profile', async t => {
  const legacy = { document: { schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'legacy', name: 'Legacy Candidate' },
    personalDetails: { email: 'legacy@example.test', phone: '' }, companies: [], professionalProfile: { summary: 'Legacy summary.', certifications: [{ id: 'cert-1', name: 'Certificate' }] } },
    revision: 3, originalFilename: 'candidate.json', importedAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', lastMutationId: 'old' };
  const source = profile();
  const { repo, storage, values } = await repository(t, { profile: source }, { 'candidate:legacy': legacy, 'active-candidate:v1': 'legacy' });
  const current = await repo.bootstrap();
  assert.notEqual(current.id, 'legacy');
  assert.deepEqual(values.profile, source);
  const records = await storage.get(null);
  assert.deepEqual(records['candidate-backup:profile-alignment:legacy'], legacy);
  assert.equal(records['candidate:legacy'], undefined);
  assert.equal(records['autofill-profile:legacy'].document, undefined);
  assert.equal((await repo.list()).length, 2);
  const selected = await repo.select('legacy');
  assert.equal(selected.document.professionalProfile.summary, 'Legacy summary.');
  assert.equal(selected.document.professionalProfile.certifications[0].name, 'Certificate');
  assert.equal(values.profile.contactData.email, 'legacy@example.test');
});

test('SpeedyApply JSON import, duplicate replacement, and deletion preserve backups and other data', async t => {
  const { repo, values, storage } = await repository(t, { unrelated: 'retained' });
  const source = profile();
  const input = { raw: JSON.stringify(source), filename: 'profile.json', mutationId: crypto.randomUUID() };
  const imported = await repo.import(input);
  assert.deepEqual(values.profile, source);
  assert.equal((await repo.import(input)).revision, 1);
  const changed = { ...source, contactData: { ...source.contactData, email: 'new@example.test' } };
  const replacement = { raw: JSON.stringify(changed), filename: 'profile.json', mutationId: crypto.randomUUID() };
  await assert.rejects(repo.import(replacement), error => error.code === 'REPLACEMENT_REQUIRED');
  assert.equal(values.profile.contactData.email, source.contactData.email);
  const updated = await repo.import({ ...replacement, replaceRevision: 1 });
  assert.equal(updated.revision, 2);
  await repo.delete({ candidateId: imported.id, expectedRevision: 2 });
  assert.equal(await repo.bootstrap(), null);
  assert.equal(values.profile, undefined);
  assert.equal(values.unrelated, 'retained');
  assert.equal((await storage.get(`profile-backup:deleted:${imported.id}`))[`profile-backup:deleted:${imported.id}`].profile.contactData.email, 'new@example.test');
});

test('web Resume Studio opens without a side panel owner and preserves the candidate draft', async () => {
 const calls=[];const browser={runtime:{sendMessage:async request=>{calls.push(request);return{ok:true,result:{tabId:7}}}}};
 assert.deepEqual(await openStudioPreview(41,browser),{tabId:7});
 assert.equal(calls.length,1);assert.equal(calls[0].operation,'OPEN_STUDIO_PREVIEW');
 const input={browser:{windows:{get:async()=>({type:'normal'})}},windowId:41,sender:{tab:{windowId:41}},
 candidates:{bootstrap:async()=>({document:{candidate:{id:'one'}}})},drafts:{read:async()=>({draft:{id:'draft-1'}})},
 preview:{get:async()=>({draftId:null}),invalidate:async(id,state)=>{assert.equal(state.candidateId,'one');assert.equal(state.draftId,'draft-1')},open:async id=>({tabId:7,workspaceId:id})}};
 assert.deepEqual(await openWebStudioPreview(input),{tabId:7,workspaceId:'41'});
 await assert.rejects(openWebStudioPreview({...input,windowId:42}),/same Chrome window/);
});
