import assert from 'node:assert/strict';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { createStudioStorage } from '../extension/studio/storage.js';

test('Studio records persist across contexts and support Chrome-style key selection', async t => {
  const indexedDB = new IDBFactory();
  const first = createStudioStorage({ indexedDB, BroadcastChannel: null });
  const second = createStudioStorage({ indexedDB, BroadcastChannel: null });
  t.after(async () => { await first.close(); await second.close(); });
  const candidate = { document: { candidate: { id: 'candidate-1', name: 'Test Candidate' } }, revision: 1 };
  await first.set({ 'candidate:candidate-1': candidate, 'active-candidate:v1': 'candidate-1' });
  candidate.revision = 99;
  assert.equal((await second.get('candidate:candidate-1'))['candidate:candidate-1'].revision, 1);
  assert.deepEqual(await second.get(['active-candidate:v1', 'missing']), { 'active-candidate:v1': 'candidate-1' });
  assert.deepEqual(await second.get({ missing: 'default' }), { missing: 'default' });
  assert.equal(Object.keys(await second.get(null)).length, 2);
  const read = await second.get('candidate:candidate-1');
  read['candidate:candidate-1'].revision = 50;
  assert.equal((await first.get('candidate:candidate-1'))['candidate:candidate-1'].revision, 1);
  await second.remove(['active-candidate:v1', 'candidate:candidate-1']);
  assert.deepEqual(await first.get(null), {});
});

test('writes notify local and other page listeners after the new values are committed', async t => {
  const indexedDB = new IDBFactory();
  const databaseName = `studio-notifications-${crypto.randomUUID()}`;
  const first = createStudioStorage({ indexedDB, databaseName });
  const second = createStudioStorage({ indexedDB, databaseName });
  t.after(async () => { await first.close(); await second.close(); });
  const local = [];
  first.onChanged.addListener((changes, area) => local.push({ changes, area }));
  const remote = new Promise(resolve => {
    second.onChanged.addListener(async (changes, area) => {
      resolve({ changes, area, saved: await second.get('ui-theme:v1') });
    });
  });
  await first.set({ 'ui-theme:v1': 'dark' });
  assert.deepEqual(local, [{ changes: { 'ui-theme:v1': { newValue: 'dark' } }, area: 'local' }]);
  assert.deepEqual(await remote, {
    changes: { 'ui-theme:v1': { newValue: 'dark' } }, area: 'local', saved: { 'ui-theme:v1': 'dark' },
  });
  await first.set({ 'ui-theme:v1': 'dark' });
  assert.equal(local.length, 1);
  await first.remove('ui-theme:v1');
  assert.deepEqual(local.at(-1).changes, { 'ui-theme:v1': { oldValue: 'dark' } });
});

test('independent writes preserve other records and private access never changes chrome.storage', async t => {
  const storage = createStudioStorage({ indexedDB: new IDBFactory(), BroadcastChannel: null });
  t.after(() => storage.close());
  await storage.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
  await assert.rejects(storage.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' }));
  await Promise.all(Array.from({ length: 12 }, (_, index) => storage.set({ [`candidate:${index}`]: { index } })));
  assert.equal(Object.keys(await storage.get(null)).length, 12);
  const listener = () => {};
  storage.onChanged.addListener(listener);
  assert.equal(storage.onChanged.hasListener(listener), true);
  storage.onChanged.removeListener(listener);
  assert.equal(storage.onChanged.hasListener(listener), false);
});
