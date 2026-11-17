// Serialized into ChatGPT's top frame. Use the app's own router by clicking its
// New chat control; never edit history or remove conversation DOM ourselves.
export async function prepareChatGPTNewChat(timeoutMs = 8000) {
  if (window !== window.top || location.origin !== 'https://chatgpt.com') return { status: 'unavailable' };
  const originalPath = location.pathname;
  const visible = node => Boolean(node?.isConnected && node.getClientRects().length &&
    !node.closest('[hidden], [aria-hidden="true"], [inert]') &&
    getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
  const disabled = node => node.disabled || node.readOnly || node.getAttribute('aria-disabled') === 'true';
  const messageSelector = '[data-message-author-role], [data-role="user"], [data-role="assistant"], [data-conversation-role="user"], [data-conversation-role="assistant"], [data-testid^="conversation-turn"], [data-turn="user"], [data-turn="assistant"]';
  const state = () => {
    if (location.origin !== 'https://chatgpt.com' || !['/', originalPath].includes(location.pathname)) return 'navigated';
    if ([...document.querySelectorAll('[data-testid="stop-button"], button[aria-label*="Stop" i], button[title*="Stop" i], [data-is-streaming="true"]')]
      .some(node => visible(node) && !disabled(node))) return 'busy';
    const editor = [...document.querySelectorAll('#prompt-textarea, [data-testid="prompt-textarea"], textarea[name="prompt"], form textarea, form [contenteditable="true"], form [contenteditable="plaintext-only"]')]
      .flatMap(node => node.matches('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]') ? [node] : [...node.querySelectorAll('textarea, [contenteditable="true"], [contenteditable="plaintext-only"]')])
      .find(node => visible(node) && !disabled(node) && !node.closest(messageSelector));
    if (!editor) return 'waiting';
    const composer = editor.closest('form') || editor.parentElement;
    if (String(editor.value || editor.textContent || '').replace(/[\u200b\ufeff]/g, '').trim() ||
      composer?.querySelector('[data-testid="file-thumbnail"], [data-testid="attachment-preview"], [data-testid="attachment"], [data-testid="file-preview"], [data-file-id], [data-state="uploading"]')) return 'draft';
    const history = [...document.querySelectorAll(messageSelector)].some(visible);
    return location.pathname === '/' && !history ? 'ready' : 'waiting';
  };
  const initial = state();
  if (initial !== 'waiting') return { status: initial };
  const controls = [...document.querySelectorAll('a, button, [role="button"]')].filter(node =>
    visible(node) && !disabled(node) && !node.closest(`${messageSelector}, form, [contenteditable]`));
  const dedicated = controls.find(node => ['create-new-chat-button', 'new-chat-button', 'new-chat'].includes(node.getAttribute('data-testid')));
  const named = controls.find(node => [node.getAttribute('aria-label'), node.getAttribute('title'), node.textContent]
    .some(value => /^new (?:chat|conversation)(?:\s|$)/i.test(String(value || '').trim())));
  const control = dedicated || named;
  if (!control) return { status: 'unavailable' };
  // A lookalike link must not take the account to another origin or feature.
  if (control.matches('a[href]')) {
    let target; try { target = new URL(control.href, location.href); } catch { return { status: 'unavailable' }; }
    if (target.origin !== location.origin || target.pathname !== '/') return { status: 'unavailable' };
  }
  return new Promise(resolve => {
    let finished = false, observer, timer, poll;
    const finish = status => {
      if (finished) return;
      finished = true; observer?.disconnect(); clearTimeout(timer); clearInterval(poll);
      for (const type of ['popstate', 'input', 'change']) window.removeEventListener(type, check, true);
      resolve({ status });
    };
    const check = () => { const status = state(); if (status !== 'waiting') finish(status); };
    observer = new MutationObserver(check);
    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
    for (const type of ['popstate', 'input', 'change']) window.addEventListener(type, check, true);
    poll = setInterval(check, 100); // pushState itself does not dispatch popstate.
    timer = setTimeout(() => finish('timeout'), timeoutMs);
    try { control.click(); check(); } catch { finish('unavailable'); }
  });
}
