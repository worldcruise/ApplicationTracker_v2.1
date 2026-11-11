export function openStudioDock(windowId, browser = globalThis.chrome) {
  return requestStudioPreview(windowId, browser);
}

export async function openDashboard(route = '/', browser = globalThis.chrome) {
  if (!['/', '/profile', '/profile/new', '/settings', '/settings/profile', '/settings/profile/new', '/settings/prompts', '/settings/other', '/resume-studio', '/dashboard', '/meetings'].includes(route)) {
    throw new Error(`Unknown ${APP_NAME} page.`);
  }
  const base = browser.runtime.getURL('options.html');
  const current = globalThis.location?.href?.split(/[?#]/)[0];
  const preview = browser.runtime.getURL('preview.html');
  if (current === base || current === preview) {
    if (route === '/resume-studio') return openStudioPreview((await browser.windows.getCurrent()).id, browser);
    if (current === preview) {
      const tab = await browser.tabs.getCurrent();
      if (!Number.isSafeInteger(tab?.id)) throw new Error('Reload Resume Studio before switching pages.');
      await flushStudioTab(tab.id, browser);
      globalThis.location.assign(`${base}#${route}`);
    } else {
      globalThis.location.hash = route;
      // These shortcuts live outside React Router's Link component. Notify its
      // history listener immediately so the content changes with the URL.
      globalThis.window.dispatchEvent(new Event('popstate'));
    }
    return;
  }
  const window = await browser.windows.getCurrent();
  const tabs = await browser.tabs.query({ windowId: window.id });
  const existing = tabs.find(tab => (tab.url || '').split('#')[0] === base);
  const url = `${base}#${route}`;
  if (existing?.id !== undefined) return browser.tabs.update(existing.id, { url, active: true });
  return browser.tabs.create({ url, windowId: window.id, active: true });
}

export async function requestStudioPreview(windowId, browser = globalThis.chrome, tabId) {
  if (!Number.isSafeInteger(windowId) || windowId < 0) throw new Error('The current browser window is not ready. Please try again.');
  const reply = await browser.runtime.sendMessage({
    version: 1, operation: 'OPEN_STUDIO_PREVIEW', requestId: crypto.randomUUID(),
    payload: { windowId, ...(tabId === undefined ? {} : { tabId }) },
  });
  if (!reply?.ok) throw new Error(reply?.error?.message || 'Resume Studio could not open. Please try again.');
  return reply.result;
}

export async function openStudioPreview(windowId, browser = globalThis.chrome) {
  const current = globalThis.location?.href?.split(/[?#]/)[0];
  if (current && current === browser.runtime.getURL?.('preview.html')) return;
  if (current && current === browser.runtime.getURL?.('options.html')) {
    const tab = await browser.tabs.getCurrent();
    if (!Number.isSafeInteger(tab?.id) || tab.windowId !== windowId) throw new Error('Reload this page to find its Chrome tab.');
    return requestStudioPreview(windowId, browser, tab.id);
  }
  return requestStudioPreview(windowId, browser);
}
import { APP_NAME } from './branding.js';
import { flushStudioTab } from './navigation-flush.js';

