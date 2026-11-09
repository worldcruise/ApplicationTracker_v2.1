export async function openWebStudioPreview({ browser, candidates, drafts, preview, windowId, sender, tabId }) {
  if (!Number.isSafeInteger(windowId) || windowId < 0 || sender.tab && sender.tab.windowId !== windowId) {
    throw new Error('Open the preview in the same Chrome window as Resume Studio.');
  }
  if ((await browser.windows.get(windowId)).type !== 'normal') throw new Error('Open Resume Studio in a regular Chrome window.');
  if (tabId !== undefined) {
    if (!Number.isSafeInteger(tabId) || tabId < 0 || sender.tab && sender.tab.id !== tabId) throw new Error('Open Resume Studio from its current extension tab.');
    const tab = await browser.tabs.get(tabId);
    if (tab.windowId !== windowId || (tab.pendingUrl || tab.url || '').split('#')[0] !== browser.runtime.getURL('options.html')) throw new Error('Open Resume Studio from the current extension web page.');
  }
  const identity = String(windowId);
  const candidate = await candidates.bootstrap();
  const candidateId = candidate?.document.candidate.id ?? null;
  const saved = await drafts.read(candidateId);
  const state = await preview.get(identity);
  // Flush outside the preview repository's serialized queue: flushing may itself
  // update the preview's customization settings.
  if (tabId !== undefined && state.tabId != null && state.tabId !== tabId) await flushStudioTab(state.tabId, browser);
  if (state.draftId !== saved.draft.id || state.candidateId !== candidateId) {
    await preview.invalidate(identity, { generation: crypto.randomUUID(), draftId: saved.draft.id, candidateId });
  }
  return preview.open(identity, tabId);
}
import { flushStudioTab } from './navigation-flush.js';
