(() => {
  const d = globalThis.AiAgentGenerationDOM, native = globalThis.__techIntChatAdapterV2;
  if (!native) throw new Error('The bundled ChatGPT submission adapter is missing. Reload the extension.');
  const submitter = new native.ChatGPTAdapter();
  const answers = '[data-message-author-role="assistant"], [data-role="assistant"], [data-conversation-role="assistant"], [data-turn="assistant"], [data-chatgpt-search-unit-key$=":assistant"]';
  const users = '[data-message-author-role="user"], [data-role="user"], [data-conversation-role="user"], [data-turn="user"], [data-user-message-bubble], [data-chatgpt-search-unit-key$=":user"]';
  const markdown = '[data-markdown-text-style="assistant-message"]';
  const turns = '[data-turn-key], [data-testid^="conversation-turn"], [data-turn-id], article';
  const reasoning = '[data-role="reasoning"], [data-message-type="reasoning"], [data-testid="reasoning"], [data-testid="thinking"], [data-markdown-text-tone="tertiary"], [data-conversation-role="tool"]';
  const codeSelector = 'pre, [data-markdown-copy="code-block"], [data-testid="code-block"], .cm-editor, .cm-content';
  const outsideComposer = node => !node.closest('form, #prompt-textarea, [data-testid="prompt-textarea"], [contenteditable="true"], [contenteditable="plaintext-only"]');
  const rendered = node => d.visible(node)&&!node.closest('[hidden], [aria-hidden="true"], [inert]');
  const eligible = node => outsideComposer(node) && !node.closest(reasoning);
  const outermost = nodes => [...new Set(nodes)].filter(node => !nodes.some(other => other !== node && other.contains(node)));
  function postedUsers() {
    const nodes = [...document.querySelectorAll(users)].filter(node=>outsideComposer(node)&&rendered(node));
    return nodes.filter(node => !nodes.some(other => other !== node && node.contains(other)));
  }
  function userKey(node){
    const message=node?.closest('[data-message-id]')||node?.querySelector('[data-message-id]');
    if(message?.getAttribute('data-message-id'))return 'message:'+message.getAttribute('data-message-id');
    const turn=node?.closest(turns);
    for(const key of ['data-turn-id','data-turn-key','data-testid','id'])if(turn?.getAttribute(key))return key+':'+turn.getAttribute(key);
    return null;
  }
  function matchesPostedUser(node,run){
    const content=[...node.querySelectorAll('[data-message-content], [data-testid="user-message"], .whitespace-pre-wrap'),node];
    return content.some(part=>d.matchesUserPrompt(d.text(part),run)||d.matchesUserPrompt(part.textContent,run));
  }
  function replyRoots() {
    return outermost([...document.querySelectorAll(`${answers}, ${markdown}`)].filter(node =>
      eligible(node) && rendered(node) && !node.closest(users)));
  }
  function codeBlocks(root) {
    const blocks = [...(root.matches(codeSelector) ? [root] : []), ...root.querySelectorAll(codeSelector)]
      .filter(node => rendered(node)&&!node.closest(reasoning));
    return outermost(blocks).map(node => {
      const lines = [...node.querySelectorAll('.cm-content .cm-line')];
      const code = node.querySelector('code');
      // CodeMirror panels render one DOM line per source line. Preserve boundaries
      // and exclude the language header, Copy button, and line-number gutter.
      const content=node.matches('.cm-content')?node:node.querySelector('.cm-content');
      const raw = lines.length ? lines.map(line => line.textContent || '').join('\n') :
        code ? code.textContent : content?.textContent || node.textContent;
      return { node, raw: String(raw || '').trim() };
    });
  }
  function matchesRun(raw, run) {
    try { const value = JSON.parse(raw); return value?.requestId === run.jobId && value?.runId === run.id; }
    catch { return false; }
  }
  function busy(reply) {
    const stop = !reply?.nextUser&&[...document.querySelectorAll('button[data-testid="stop-button"], button[aria-label="Stop"], button[aria-label="Stop response"], button[aria-label="Stop streaming"], button[aria-label="Stop generating"]')]
      .some(node=>rendered(node)&&!d.disabled(node)&&!node.closest(`${codeSelector}, ${answers}, ${users}, ${reasoning}`));
    if(stop)return true;
    // A later question's Stop control cannot keep an earlier finished reply busy.
    // Turn-level response actions also outrank leftover streaming CSS/attributes.
    if(reply?.completionControl)return false;
    const scopes=[...(reply?.parts||[reply?.node||document]),...(reply?.turn?[reply.turn]:[])];
    const flagged=selector=>scopes.some(scope=>scope.matches?.(selector)&&rendered(scope)||[...scope.querySelectorAll(selector)].some(rendered));
    if(flagged('[data-is-streaming="true"]'))return true;
    // result-streaming is also used as presentation styling after the JSON ends.
    return !reply?.responseMatched&&flagged('.result-streaming');
  }
  function answer(run) {
    const posted = postedUsers(), anchor=run.baseline?.lastUserKey&&posted.find(node=>userKey(node)===run.baseline.lastUserKey);
    const matching=posted.filter(node=>matchesPostedUser(node,run));
    const user=matching.filter(node=>run.outputFormat!=='combined-json'||posted.indexOf(node)>=(run.baseline?.users||0)||anchor&&d.after(node,anchor)).at(-1);
    const latest=run.outputFormat==='combined-json'&&run.captureMode==='latest-json';
    const nextUser = user && posted.find(node => d.after(node, user)&&(!latest||(run.captureBoundaries||[]).some(prompt=>matchesPostedUser(node,{...run,prompt}))));
    const roots = replyRoots();
    const bounded = roots.filter(node => (!user || d.after(node, user)) && (!nextUser || d.after(nextUser, node)));
    const groups = new Map();
    for (const root of bounded) {
      const turn = root.closest(turns) || root;
      const group = groups.get(turn) || { node: root, turn, parts: [], blocks: [] };
      group.parts.push(root); group.blocks.push(...codeBlocks(root)); groups.set(turn, group);
    }
    const candidates = [...groups.values()];
    const matched = run.outputFormat==='combined-json'?[]:candidates.filter(candidate => candidate.blocks.some(block => matchesRun(block.raw, run)));
    // A missing/virtualized user bubble requires matching job/run IDs in an
    // assistant code block. Never search the whole page for a JSON result.
    const hasJSON=candidate=>candidate.blocks.length||/^\s*(?:```(?:json)?\s*)?[{[]/i.test(candidate.parts.map(d.answerText).join('\n\n'));
    let selected = matched.at(-1) || (user ? candidates.findLast(candidate => latest?hasJSON(candidate):candidate.blocks.length) || candidates.at(-1) : null);
    if (!selected && run.sendIntentAt && run.outputFormat !== 'json-code-block'&&run.outputFormat!=='combined-json') {
      selected = candidates.findLast(candidate => d.completedJSON(candidate.parts.map(d.answerText).join('\n\n'), run));
    }
    const blocks = selected?.blocks || [];
    const raw = blocks.length ? blocks.map(block => block.raw).join('\n\n') :
      selected && run.outputFormat !== 'json-code-block' ? selected.parts.map(d.answerText).join('\n\n') : '';
    const editor = native.findEditor(), send = native.findSend(editor), sendReady = native.enabled(send);
    const lastContent = blocks.at(-1)?.node || selected?.parts.at(-1);
    const completeControl = Boolean(selected && [...selected.turn.querySelectorAll(
      '[data-testid="copy-turn-action-button"], [data-testid="good-response-turn-action-button"], button[aria-label="Copy response"], button[aria-label="Copy message"], button[aria-label="Copy"]'
    )].some(button => d.visible(button) && !d.disabled(button) && !button.closest(`${codeSelector}, ${users}, ${reasoning}`) &&
      (button.matches('[data-testid="copy-turn-action-button"], [data-testid="good-response-turn-action-button"], button[aria-label="Copy response"], button[aria-label="Copy message"]')||d.after(button, lastContent))));
    const responseMatched=Boolean(selected&&d.completedJSON(raw,run));
    const capture={...selected,nextUser,completionControl:completeControl,responseMatched};
    const streaming = busy(capture);
    const complete = !streaming && (responseMatched || sendReady || completeControl);
    const diagnostics = {
      stage: 'capture', code: !user&&!selected ? 'prompt_not_found' : !selected ? 'reply_not_found' : !raw ? 'code_block_missing' : streaming ? 'waiting_for_idle' : complete ? 'reply_ready' : 'waiting_for_completion',
      version: native.version, extensionVersion: globalThis.AiAgentBuild?.version || 'unknown', buildId: globalThis.AiAgentBuild?.id || 'unknown',
      assistantCandidates: roots.length, boundedCandidates: candidates.length, codeBlocks: blocks.length, replyChars: raw.length,
      userMatched: Boolean(user), responseMatched, sendFound: Boolean(send),
      sendEnabled: sendReady, generationActive: streaming, completionControl: completeControl,
      completionBasis:responseMatched?'matching-json':completeControl?'response-controls':'none',
      captureMode:latest?'latest-json':'original-reply'
    };
    return { user, node: selected?.node || null, parts: selected?.parts, turn: selected?.turn, nextUser,completionControl:completeControl,responseMatched,raw, complete, diagnostics };
  }
  globalThis.AiAgentChatGPTGeneration = {
    editor: native.findEditor,
    login: () => Boolean(d.firstVisible(['form[data-logged-out]', '[data-testid="login-button"]', '[data-testid="sign-in-button"]', 'input[type="password"]', 'a[href*="/auth/login"]'])),
    busy,
    baseline: () => {const posted=postedUsers(),lastUserKey=userKey(posted.at(-1));return {users:posted.length,answers:replyRoots().length,...lastUserKey?{lastUserKey}:{}};},
    send: (run, { signal, beforeSubmit }) => submitter.send(run.prompt, signal, {
      requestId: run.id, source: 'panel', action: 'prepared', replaceDraft: true, beforeSubmit
    }),
    answer,
    conversation: () => /^\/(?:g\/[\w-]+\/)?c\/[\w-]+\/?$/.test(location.pathname) ? location.origin + location.pathname : null
  };
})();
