import assert from 'node:assert/strict';
import test from 'node:test';
import { requireEmbeddedEditor } from '../extension/studio/editor-access.js';

test('only the current editor iframe inside its owned Resume Studio page can claim the window', async () => {
  const sender = { id: 'test', url: 'chrome-extension://test/workspace.html', frameId: 3, documentId: 'editor', tab: { id: 7, windowId: 41 } };
  const tab = { id: 7, windowId: 41, url: 'chrome-extension://test/preview.html?owner=route' };
  const context = { documentId: 'editor', documentUrl: sender.url, frameId: 3, tabId: 7, windowId: 41 };
  const browser = { runtime: { id: 'test', getURL: path => `chrome-extension://test/${path}`, getContexts: async () => [context] }, tabs: { get: async () => tab } };
  const preview = { get: async () => ({ tabId: 7, routeId: 'route' }) };
  const check = (next = sender, identity = { workspaceId: '41' }) => requireEmbeddedEditor(next, identity, browser, preview);
  assert.equal(await check(), tab);
  await assert.rejects(check({ ...sender, frameId: 0 }), /web page/);
  await assert.rejects(check({ ...sender, documentId: 'stale' }), /document changed/);
  await assert.rejects(check(sender, { workspaceId: '42' }), /browser window/);
  tab.url = 'chrome-extension://test/options.html'; await assert.rejects(check(), /web page|browser window/);
  tab.url = 'https://example.test/preview.html'; await assert.rejects(check(), /browser window/);
  tab.url = 'chrome-extension://test/preview.html?owner=stale'; await assert.rejects(check(), /another tab/);
  tab.url = 'chrome-extension://test/preview.html?owner=route&owner=route'; await assert.rejects(check(), /another tab/);
});
