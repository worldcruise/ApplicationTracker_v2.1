// The editor is privileged only inside the top-level Resume Studio preview tab.
// A workspace iframe embedded by another page cannot claim a window or edit data.
export async function requireEmbeddedEditor(sender, envelope, browser, preview) {
  const workspace = browser.runtime.getURL('workspace.html'), base = new URL(browser.runtime.getURL('preview.html'));
  if (sender.id !== browser.runtime.id || sender.url !== workspace || !Number.isSafeInteger(sender.frameId) || sender.frameId <= 0 || !Number.isSafeInteger(sender.tab?.id) || !sender.documentId) throw new Error('Use the Resume Studio editor on its web page.');
  const tab = await browser.tabs.get(sender.tab.id);
  const url = new URL(tab.pendingUrl || tab.url);
  if (url.protocol !== base.protocol || url.host !== base.host || url.pathname !== base.pathname || [...url.searchParams.keys()].some(key => key !== 'owner') || tab.windowId !== Number(envelope.workspaceId)) throw new Error('The editor must belong to its Resume Studio page and browser window.');
  const contexts = await browser.runtime.getContexts({ contextTypes: ['TAB'], documentIds: [sender.documentId] });
  if (!contexts.some(context => context.documentId === sender.documentId && context.tabId === tab.id && context.windowId === tab.windowId && context.frameId === sender.frameId && context.documentUrl === workspace)) throw new Error('The Resume Studio editor document changed. Reload the page.');
  const state = await preview.get(String(tab.windowId));
  if (state.tabId !== null && state.tabId !== tab.id || url.searchParams.has('owner') && (url.searchParams.getAll('owner').length !== 1 || url.searchParams.get('owner') !== state.routeId)) throw new Error('Resume Studio already belongs to another tab. Open its current web page.');
  return tab;
}
