export function isResumeStudioTab(tab, browser = globalThis.chrome) {
  try {
    const url = new URL(tab.pendingUrl || tab.url), base = new URL(browser.runtime.getURL('preview.html'));
    return url.protocol === base.protocol && url.host === base.host && ['/preview.html', '/workspace.html'].includes(url.pathname);
  } catch { return false; }
}
export async function handleCaptureHotkey(command, tab, { browser = globalThis.chrome, capture }) {
  if (command !== 'capture-job') return null;
  const source = tab || (await browser.tabs.query({ active: true, currentWindow: true }))[0];
  if (!source || isResumeStudioTab(source, browser)) return null;
  return capture(source);
}
