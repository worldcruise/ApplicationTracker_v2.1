(() => {
  if (globalThis.AiAgentGenerationDOM?.revision === 'result-capture-2') return;
  const visible = node => Boolean(node?.isConnected && node.getClientRects().length && getComputedStyle(node).visibility !== 'hidden' && getComputedStyle(node).display !== 'none');
  const text = node => node?.matches('textarea,input') ? node.value : node?.innerText || node?.textContent || '';
  // A rich editor's empty paragraph can expose three newlines through innerText.
  // Compare paragraph boundaries consistently without discarding words or single line breaks.
  const normal = value => String(value || '').replace(/\r\n?/g, '\n').replace(/[\u200b\ufeff]/g, '').replace(/\u00a0/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const writable = node => node?.matches('textarea:not([disabled]):not([readonly]), [contenteditable="true"], [contenteditable="plaintext-only"]') && visible(node) && !node.closest('[inert]') && node.getAttribute('aria-disabled') !== 'true';
  function editor(selectors) {
    for (const selector of selectors) {
      const found = [...document.querySelectorAll(selector)].flatMap(node => node.matches('textarea,[contenteditable="true"],[contenteditable="plaintext-only"]') ? [node] : [...node.querySelectorAll('textarea,[contenteditable="true"],[contenteditable="plaintext-only"]')]).filter(writable).filter(node => !node.closest('[data-message-author-role], [data-testid^="conversation-turn"]'));
      const unique = [...new Set(found)]; if (unique.length === 1) return unique[0];
    }
    return null;
  }
  const firstVisible = selectors => selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
  const disabled = node => node.disabled || node.getAttribute('aria-disabled') === 'true' || node.getAttribute('data-disabled') === 'true';
  function sendControl(editor, selectors) {
    for (const selector of selectors) {
      const nodes = [...document.querySelectorAll(selector)].filter(visible);
      const form = editor?.closest('form');
      const scoped = form ? nodes.filter(node => form.contains(node)) : nodes;
      if (scoped.length === 1) return scoped[0];
    }
    const submits = [...(editor?.closest('form')?.querySelectorAll('button[type="submit"]') || [])].filter(visible);
    return submits.length === 1 ? submits[0] : null;
  }
  function hasAttachment(editor) {
    return Boolean(editor?.closest('form')?.querySelector('[data-testid="file-thumbnail"], [data-testid="attachment-preview"], [data-file-id]'));
  }
  function fill(editor, prompt) {
    if (!writable(editor) || normal(text(editor)) || hasAttachment(editor)) throw new Error('The message box contains a draft or attachment. It was preserved.');
    editor.focus({ preventScroll: true });
    if (editor.matches('textarea')) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(editor, prompt);
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      const selection = window.getSelection(), range = document.createRange();
      range.selectNodeContents(editor); selection.removeAllRanges(); selection.addRange(range);
      // Browser editing keeps the rich editor's input/undo path intact. Never replace its innerHTML.
      if (!document.execCommand('insertText', false, prompt)) throw new Error('This editor did not accept text insertion. The prompt was not submitted.');
    }
  }
  const userNodes = () => [...document.querySelectorAll('[data-message-author-role="user"], [data-role="user"], [data-testid="user-message"], .user-message')];
  function userTurn(marker, answerSelector) {
    const explicit = userNodes().filter(node => normal(text(node)).includes(marker));
    if (explicit.length) return explicit.at(-1);
    // DeepSeek also renders unlabelled user bubbles. Locate the unique run marker in a text leaf,
    // excluding editors, answers, and reasoning so an echoed marker cannot become a user turn.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode, parent = node.parentElement;
      if (node.textContent.includes(marker) && parent && !parent.closest(`textarea,input,[contenteditable],script,style,pre,code,${answerSelector}`)) return parent;
    }
    return null;
  }
  function after(node, earlier) { return Boolean(earlier && !node.contains(earlier) && !earlier.contains(node) && (earlier.compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING)); }
  function answerText(node) {
    const blocks = [...node.querySelectorAll('pre code')].map(code => code.textContent.trim()).filter(value => value.startsWith('{'));
    return blocks.length === 1 ? blocks[0] : text(node).trim();
  }
  function completedJSON(raw, run) {
    try {
      const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1'));
      if(run.outputFormat==='combined-json'&&run.documentContractVersion>=4)return !!value&&typeof value==='object'&&!Array.isArray(value);
      if(run.outputFormat==='combined-json')return !!(value&&typeof value==='object'&&!Array.isArray(value)&&(value.resume&&typeof value.resume==='object'||value.requestId===run.jobId&&(value.job&&typeof value.job==='object'||typeof value.coverLetter==='string')||typeof value.company==='string'&&Array.isArray(value.experience))&&(value.requestId===undefined||value.requestId===run.jobId)&&(value.runId===undefined||value.runId===run.id));
      const matched = value?.requestId === run.jobId && value?.runId === run.id;
      return matched && (run.kind === 'application-answers' ? Array.isArray(value.answers) : run.kind === 'job-cleanup' ? value.kind === 'job-cleanup' && value.job && typeof value.job.description === 'string' : value.resume && typeof value.coverLetter === 'string');
    } catch { return false; }
  }
  function matchesUserPrompt(raw,run){
    if(run.outputFormat!=='combined-json')return String(raw||'').split(/\s+/).includes(`DOCUMENT_RUN:${run.id}`);
    // Rendered paragraphs can join at punctuation or omit a line break. Match
    // the entire non-whitespace text, never a prefix or a JSON sample in history.
    return normal(raw).replace(/\s+/g,'')===normal(run.prompt).replace(/\s+/g,'');
  }
  function completedAnswerObjects(raw,run){
    if(typeof raw!=='string'||raw.length>500000||!run.questions?.length)return false;
    const objects=[];let start=-1,depth=0,quoted=false,escaped=false;
    for(let index=0;index<raw.length;index++){const char=raw[index];if(start<0){if(char==='{'){start=index;depth=1;}continue;}if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}else if(char==='"')quoted=true;else if(char==='{')depth++;else if(char==='}'&&--depth===0){try{objects.push(JSON.parse(raw.slice(start,index+1)));}catch{return false;}start=-1;}}
    if(start!==-1||objects.length!==run.questions.length)return false;
    const remaining=run.questions.map(field=>normal(field.question));
    for(const object of objects){if(typeof object.question!=='string'||typeof object.answer!=='string')return false;const index=remaining.indexOf(normal(object.question));if(index<0)return false;remaining.splice(index,1);}return true;
  }
  globalThis.AiAgentGenerationDOM = { revision:'result-capture-2',visible, text, normal, editor, firstVisible, disabled, sendControl, hasAttachment, fill, userNodes, userTurn, after, answerText, completedJSON,completedAnswerObjects,matchesUserPrompt };
})();
