import { normalizeProfile, profileName, profileToStudio, studioExtras, studioToProfile } from './profile-model.js';
import {defaultExportRoot,DEFAULT_EXPORT_ROOT_KEY} from './default-export-root.js';

const prefix = 'autofill-profile:';
const activeKey = 'active-candidate:v1';
const marker = 'speedy-profile-registry:v1';
const keyFor = id => prefix + id;
const stable = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const equal = (a, b) => stable(a) === stable(b);

export function createProfileRepository({ browser, storage, queue, parseLegacy, validateLegacy, ErrorClass = Error }) {
  let initialized;
  function fail(code, message, revision) {
    const error = new ErrorClass(code, message, undefined, revision);
    if (ErrorClass === Error) { error.message = message; error.code = code; error.currentRevision = revision; }
    throw error;
  }
  function mutation(value) { if (typeof value !== 'string' || !value.trim() || value.length > 128) fail('INVALID_REQUEST', 'A mutation ID is required.'); }
  function check(record, revision) { if (!record || record.revision !== revision) fail('CONFLICT', 'The saved profile changed. Reload it before saving your edits.', record?.revision); }
  const read = async id => (await storage.get(keyFor(id)))[keyFor(id)] || null;
  const records = async () => Object.entries(await storage.get(null)).filter(([key]) => key.startsWith(prefix)).map(([, record]) => record);
  const project = async record => {
    if(!record)return null;
    const result={...structuredClone(record),document:profileToStudio(record.profile,record.id,record.studio)};
    if(!result.document.applicationPreferences?.exportDirectory){const root=await defaultExportRoot(record.id,storage);if(root)result.document.applicationPreferences={...result.document.applicationPreferences,exportDirectory:root.preference};}
    return result;
  };

  async function write(id, profile, studio, previous, filename, mutationId) {
    const now = new Date().toISOString();
    const record = { id, profile: normalizeProfile(profile), studio, revision: (previous?.revision || 0) + 1,
      originalFilename: filename || previous?.originalFilename || 'autofill-profile.json', importedAt: previous?.importedAt || now,
      createdAt: previous?.createdAt || previous?.importedAt || now, updatedAt: now, lastMutationId: mutationId };
    await storage.set({ [keyFor(id)]: record });
    return record;
  }
  async function activate(record) {
    const previous = (await storage.get(activeKey))[activeKey];
    await storage.set({ [activeKey]: record.id });
    try { await browser.storage.local.set({ profile: structuredClone(record.profile) }); }
    catch (error) {
      if (previous) await storage.set({ [activeKey]: previous }); else await storage.remove(activeKey);
      throw error;
    }
  }
  async function initialize() {
    return initialized ??= (async () => {
      const saved = await storage.get(null);
      if (saved[marker]) return;
      for (const [key, record] of Object.entries(saved).filter(([key]) => key.startsWith('candidate:'))) {
        if (!Number.isSafeInteger(record.revision) || record.revision < 1) fail('CORRUPT_STORAGE', 'The saved candidate revision is invalid. Keep its JSON backup before retrying.');
        const document = parseLegacy(JSON.stringify(record.document));
        const profile = studioToProfile(document);
        profile.profileName = document.candidate.name.slice(0, 20) || 'Default';
        const id = document.candidate.id;
        await storage.set({ [`candidate-backup:profile-alignment:${id}`]: record });
        await write(id, profile, studioExtras(document, profile), { ...record, revision: record.revision - 1 }, record.originalFilename, 'speedy-profile-migration');
        await storage.remove(key);
      }
      const raw = (await browser.storage.local.get('profile')).profile;
      if (raw) {
        let profile;
        try { profile = normalizeProfile(raw); } catch { /* Keep malformed user data untouched; normal reads report it. */ }
        if (profile) {
          const matching = (await records()).find(record => equal(record.profile, profile));
          const record = matching || await write(crypto.randomUUID(), profile, {}, null, 'autofill-profile.json', 'speedy-profile-existing');
          await storage.set({ [activeKey]: record.id });
        }
      } else {
        const active = saved[activeKey] ? await read(saved[activeKey]) : null;
        if (active) await activate(active);
      }
      await storage.set({ [marker]: 1 });
    })().catch(error => { initialized = undefined; throw error; });
  }
  async function syncCurrent() {
    await initialize();
    const raw = (await browser.storage.local.get('profile')).profile;
    if (!raw) return null;
    let profile;
    try { profile = normalizeProfile(raw); } catch (error) { fail('INVALID_PROFILE', error.message); }
    const id = (await storage.get(activeKey))[activeKey];
    let record = id ? await read(id) : null;
    if (!record) {
      record = await write(crypto.randomUUID(), profile, {}, null, 'autofill-profile.json', 'speedy-profile-existing');
      await storage.set({ [activeKey]: record.id });
    } else if (!equal(record.profile, profile)) {
      record = await write(record.id, profile, record.studio, record, null, `speedy-profile-edit:${crypto.randomUUID()}`);
    }
    return record;
  }
  const api = {
    bootstrap: () => queue(async () => project(await syncCurrent())),
    list: (options={}) => queue(async () => { const record=await syncCurrent();return record?[{id:record.id,name:profileName(record.profile),...options.includeProfileName?{profileName:record.profile.profileName}:{}}]:[]; }),
    get: id => queue(async () => { await syncCurrent(); return project(await read(id)); }),
    select: id => queue(async () => {
      const active=await syncCurrent();if(active?.id!==id)fail('SINGLE_PROFILE','This account uses one profile. Replace its resume or update Profile in Settings.');
      const applyRuns=Object.entries(await storage.get(null)).filter(([key])=>key.startsWith('dock-apply-run:v1:')).map(([,run])=>run);
      if(applyRuns.some(run=>run?.candidateId!==id&&!['cancelled','submitted'].includes(run?.phase)))fail('RUN_ACTIVE','Finish or cancel the dock’s application run before changing profiles.');
      const record = await read(id);
      if (!record) fail('NOT_FOUND', 'The selected profile is no longer available.');
      await activate(record);
      return project(record);
    }),
    import: input => queue(async () => {
      await initialize(); mutation(input.mutationId);
      try { await syncCurrent(); } catch (error) { if (error.code !== 'INVALID_PROFILE') throw error; }
      if (typeof input.raw !== 'string' || new TextEncoder().encode(input.raw).length > 2 * 1024 * 1024 || typeof input.filename !== 'string' || !input.filename || input.filename.length > 255) fail('INVALID_REQUEST', 'Choose a profile JSON file up to 2 MiB.');
      let value;
      try { value = JSON.parse(input.raw); } catch { fail('INVALID_PROFILE', 'The profile file is not valid JSON.'); }
      const active=await syncCurrent();
      let id, profile, studio;
      try {
        if (value?.kind === 'application-tracker-candidate') {
          const document = parseLegacy(input.raw);
          id = document.candidate.id; profile = studioToProfile(document);
          profile.profileName = document.candidate.name.slice(0, 20) || 'Default';
          studio = studioExtras(document, profile);
        } else {
          profile = normalizeProfile(value?.profile || value);
          const existing = (await records()).find(record => equal(record.profile, profile)) || (await records()).find(record => record.profile.profileName === profile.profileName);
          id = existing?.id || crypto.randomUUID(); studio = existing?.studio || {};
        }
      } catch (error) { fail('INVALID_PROFILE', error.message); }
      if(active){id=active.id;studio={...active.studio,...studio};}
      const previous = await read(id), same = previous && equal(previous.profile, profile) && equal(previous.studio, studio);
      if (previous?.lastMutationId === input.mutationId && !same) fail('MUTATION_CONFLICT', 'This operation ID was already used for different profile content.');
      if (previous && !same) {
        if (input.replaceRevision === undefined) fail('REPLACEMENT_REQUIRED', 'A different profile with this identity is saved. Review it before replacement.', previous.revision);
        check(previous, input.replaceRevision);
        await storage.set({[`profile-backup:replacement:${previous.id}:${previous.revision}`]:previous});
      }
      const record = same ? previous : await write(id, profile, studio, previous, input.filename, input.mutationId);
      await activate(record);
      return project(record);
    }),
    save: input => queue(async () => {
      await syncCurrent(); mutation(input.mutationId);
      const document = structuredClone(validateLegacy(input.document));
      if (document.candidate.id !== input.candidateId) fail('IDENTITY_CHANGED', 'The profile ID cannot change during editing.');
      const previous = await read(input.candidateId);
      if (!previous) fail('NOT_FOUND', 'The profile is no longer available.');
      // Saving other profile edits must not turn an inherited root into an override.
      if(!previous.studio?.applicationPreferences?.exportDirectory){const root=(await storage.get(DEFAULT_EXPORT_ROOT_KEY))[DEFAULT_EXPORT_ROOT_KEY];if(root?.name&&document.applicationPreferences?.exportDirectory===root.name)delete document.applicationPreferences.exportDirectory;}
      const profile = studioToProfile(document, previous.profile, previous.studio), studio = studioExtras(document, profile);
      if (previous.lastMutationId === input.mutationId) {
        if (!equal(previous.profile, profile) || !equal(previous.studio, studio)) fail('MUTATION_CONFLICT', 'This operation ID was already used for different profile content.');
        return project(previous);
      }
      check(previous, input.expectedRevision);
      const record = await write(previous.id, profile, studio, previous, null, input.mutationId);
      if ((await storage.get(activeKey))[activeKey] === record.id) await activate(record);
      return project(record);
    }),
    updateCanonical: input => queue(async () => {
      await syncCurrent(); mutation(input.mutationId);
      const previous=await read(input.candidateId);check(previous,input.expectedRevision);
      const profile=normalizeProfile(input.profile);
      if(profile.profileName!==previous.profile.profileName)fail('IDENTITY_CHANGED','The profile name cannot change during a resume update.');
      await storage.set({[`profile-backup:resume-import:${previous.id}:${previous.revision}`]:previous});
      const record=await write(previous.id,profile,previous.studio,previous,null,input.mutationId);
      if((await storage.get(activeKey))[activeKey]===record.id)await activate(record);
      return project(record);
    }),
    replaceProfile:input=>queue(async()=>{
      const previous=await syncCurrent();mutation(input.mutationId);
      if(previous)check(previous,input.expectedRevision);else if(input.expectedRevision!==null)fail('CONFLICT','The profile changed. Reload Profile and try again.');
      const profile=normalizeProfile(input.profile),id=previous?.id||crypto.randomUUID();
      if(previous)await storage.set({[`profile-backup:replacement:${id}:${previous.revision}`]:previous});
      const record=await write(id,profile,previous?.studio||{},previous,input.filename,input.mutationId);await activate(record);return project(record);
    }),
    delete: input => queue(async () => {
      await syncCurrent();
      const previous = await read(input.candidateId); check(previous, input.expectedRevision);
      await storage.set({ [`profile-backup:deleted:${previous.id}`]: previous });
      await storage.remove(keyFor(previous.id));
      if ((await storage.get(activeKey))[activeKey] === previous.id) {
        await storage.remove(activeKey); await browser.storage.local.remove('profile'); return null;
      }
      const active = (await storage.get(activeKey))[activeKey];
      return project(active ? await read(active) : null);
    }),
  };
  const changed = (changes, area) => {
    if (area === 'local' && changes.profile) queue(syncCurrent).catch(error => console.error('Autofill profile could not refresh in Resume Studio.', error.message));
  };
  browser.storage.onChanged?.addListener(changed);
  api.close = () => browser.storage.onChanged?.removeListener(changed);
  return api;
}
