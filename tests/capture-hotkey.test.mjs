import assert from 'node:assert/strict';
import test from 'node:test';
import { handleCaptureHotkey } from '../extension/studio/capture-hotkey.js';

test('capture hotkey ignores the Resume Studio web page but continues to capture actual job pages', async () => {
  const calls = [], browser = { runtime: { getURL: file => `chrome-extension://tracker/${file}` }, tabs: { query: async () => [{ id: 4, url: 'chrome-extension://tracker/preview.html?owner=one' }] } };
  const options = { browser, capture: async tab => { calls.push(tab.id); return 'captured'; } };
  for (const url of ['chrome-extension://tracker/preview.html?owner=one', 'chrome-extension://tracker/workspace.html']) assert.equal(await handleCaptureHotkey('capture-job', { id: 4, url }, options), null);
  assert.equal(await handleCaptureHotkey('capture-job', undefined, options), null);
  assert.equal(await handleCaptureHotkey('unrelated', { id: 4, url: 'https://example.test/job' }, options), null);
  assert.equal(await handleCaptureHotkey('capture-job', { id: 7, url: 'https://example.test/preview.html' }, options), 'captured');
  assert.deepEqual(calls, [7]);
});
