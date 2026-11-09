export const NAVIGATION_FLUSH = 'flush-studio-navigation:v1';

export async function flushStudioTab(tabId, browser = globalThis.chrome) {
  const response = await browser.runtime.sendMessage({ target: NAVIGATION_FLUSH, previewTabId: tabId });
  if (!response?.ok) throw new Error(response?.error || 'Your Resume Studio edits could not be saved. Try again before switching pages.');
}

export function createNavigationFlushHook(React) {
  return function useNavigationFlush(flush) {
    const current = React.useRef(flush);
    current.current = flush;
    React.useEffect(() => {
      if (!globalThis.chrome?.runtime?.onMessage) return;
      let active = true, remove = () => {};
      // Extension documents communicate through runtime messaging. Resolve this
      // iframe's tab before listening so other Studio tabs never claim a reply.
      chrome.tabs.getCurrent().then(tab => {
        if (!active || !Number.isSafeInteger(tab?.id)) return;
        const listener = (message, sender, respond) => {
          if (message?.target !== NAVIGATION_FLUSH || message.previewTabId !== tab.id || sender.id !== chrome.runtime.id || sender.tab && sender.tab.id !== tab.id) return false;
          const worker = !sender.tab && (!sender.url || sender.url === chrome.runtime.getURL('service-worker.js'));
          const preview = sender.url?.split('?')[0] === chrome.runtime.getURL('preview.html');
          if (!worker && !preview) return false;
          (async () => {
            await current.current();
            return { ok: true };
          })().then(respond, error => respond({ ok: false, error: error.message }));
          return true;
        };
        chrome.runtime.onMessage.addListener(listener);
        remove = () => chrome.runtime.onMessage.removeListener(listener);
      }).catch(() => {});
      return () => { active = false; remove(); };
    }, []);
  };
}
