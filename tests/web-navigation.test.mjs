import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { openDashboard, openStudioDock, openStudioPreview } from '../extension/studio/dock.js';
import { createNavigationFlushHook, NAVIGATION_FLUSH } from '../extension/studio/navigation-flush.js';
import { openWebStudioPreview } from '../extension/studio/web-preview.js';

function global(t, name, value) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, { configurable: true, value, writable: true });
  t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
}
const getURL = path => `chrome-extension://navigation-test/${path}`;

test('web Resume Studio requests its current tab while native dock launches retain their behavior', async t => {
  const requests = [];
  global(t, 'location', { href: `${getURL('options.html')}#/dashboard` });
  const browser = {
    runtime: { getURL, sendMessage: async request => { requests.push(request); return { ok: true, result: { tabId: request.payload.tabId ?? 200 } }; } },
    tabs: { getCurrent: async () => ({ id: 100, windowId: 41 }) },
  };
  assert.deepEqual(await openStudioPreview(41, browser), { tabId: 100 });
  assert.deepEqual(requests[0].payload, { windowId: 41, tabId: 100 });
  await openStudioDock(41, browser);
  assert.deepEqual(requests[1].payload, { windowId: 41 });
});

test('leaving Resume Studio saves pending edits before navigating and stays put if saving fails', async t => {
  const events = [];
  const location = { href: `${getURL('preview.html')}?owner=route`, assign: url => events.push(['navigate', url]) };
  global(t, 'location', location);
  let fail = false;
  const browser = { runtime: { getURL, sendMessage: async message => { events.push(['flush', message.previewTabId, message.target]); return fail ? { ok: false, error: 'Pending edits could not be saved.' } : { ok: true }; } }, tabs: {
    getCurrent: async () => ({ id: 100 }),
  } };
  await openDashboard('/meetings', browser);
  assert.deepEqual(events, [['flush',100,NAVIGATION_FLUSH],['navigate',`${getURL('options.html')}#/meetings`]]);
  events.length = 0; fail = true;
  await assert.rejects(openDashboard('/settings', browser), /Pending edits/);
  assert.equal(events.length, 1);
  assert.equal(location.href, `${getURL('preview.html')}?owner=route`);
});

test('opening Studio in place validates the destination and flushes a previous Studio before handoff', async () => {
  const events = [];
  const input = {
    browser: { runtime: { getURL, sendMessage: async message => { events.push(['flush', message.previewTabId]); return { ok: true }; } }, windows: { get: async () => ({ type: 'normal' }) }, tabs: {
      get: async id => ({ id, windowId: 41, url: `${getURL('options.html')}#/dashboard` }),
    } }, windowId: 41, sender: { tab: { id: 100, windowId: 41 } }, tabId: 100,
    candidates: { bootstrap: async () => ({ document: { candidate: { id: 'one' } } }) },
    drafts: { read: async () => ({ draft: { id: 'draft' } }) },
    preview: { get: async () => ({ tabId: 200, draftId: 'draft', candidateId: 'one' }),
      open: async (workspace, tab) => { events.push(['open',workspace,tab]); return { tabId: tab }; } },
  };
  assert.deepEqual(await openWebStudioPreview(input), { tabId: 100 });
  assert.deepEqual(events, [['flush',200],['open','41',100]]);
  await assert.rejects(openWebStudioPreview({ ...input, tabId: 999 }), /current extension tab/);
  const unsafe = { ...input, browser: { ...input.browser, tabs: { ...input.browser.tabs, get: async () => ({ windowId: 41, url: 'https://example.test/job' }) } } };
  await assert.rejects(openWebStudioPreview(unsafe), /current extension web page/);
  input.browser.runtime.sendMessage = async () => ({ ok: false, error: 'Keep unsaved edits.' });
  await assert.rejects(openWebStudioPreview(input), /Keep unsaved edits/);
  assert.equal(events.filter(([name]) => name === 'open').length, 1);
});

test('navigation flush only accepts the owning preview or extension worker and reports save failures', async t => {
  let listener, cleanup, count = 0, failure = false;
  global(t, 'chrome', {
    runtime: { id: 'navigation-test', getURL, onMessage: { addListener: fn => { listener = fn; }, removeListener: fn => { assert.equal(fn, listener); listener = null; } } },
    tabs: { getCurrent: async () => ({ id: 100 }) },
  });
  const useFlush = createNavigationFlushHook({ useRef: value => ({ current: value }), useEffect: effect => { cleanup = effect(); } });
  useFlush(async () => { if (failure) throw Error('Save failed.'); count++; });
  await setImmediate();
  const message = { target: NAVIGATION_FLUSH, previewTabId: 100 };
  const sender = { id: 'navigation-test', url: `${getURL('preview.html')}?owner=route`, tab: { id: 100 } };
  let result;
  assert.equal(listener(message, sender, value => { result = value; }), true);
  await setImmediate(); assert.deepEqual(result, { ok: true }); assert.equal(count, 1);
  for (const invalid of [{ ...sender, id: 'another-extension' }, { ...sender, url: 'https://example.test' }, { ...sender, tab: { id: 200 } }]) assert.equal(listener(message, invalid, () => {}), false);
  assert.equal(listener({ ...message, previewTabId: 200 }, { id: 'navigation-test' }, () => {}), false);
  failure = true;
  assert.equal(listener(message, { id: 'navigation-test', url: getURL('service-worker.js') }, value => { result = value; }), true);
  await setImmediate(); assert.deepEqual(result, { ok: false, error: 'Save failed.' });
  cleanup(); assert.equal(listener, null);
});
