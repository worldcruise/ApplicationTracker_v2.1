import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createPromptSettings } from '../extension/studio/prompt-settings.js';
import { studioStorage } from '../extension/studio/storage.js';

function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree);
  if (Array.isArray(tree)) return tree.map(text).filter(Boolean).join(' ');
  return tree && typeof tree === 'object' ? text(tree.props?.children) : '';
}

test('imported prompt UI loads, saves new templates and retains unsaved text after a conflict', async t => {
  const previousChrome = globalThis.chrome;
  const requests = [];
  const library = { revision: 0, selectedId: 'first', templates: [{ id: 'first', title: 'Factual', text: '{{candidate_profile}}\n{{job_description}}' }] };
  const candidate = { revision: 1, document: { schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'one', name: 'Candidate' }, companies: [], professionalProfile: {}, applicationPreferences: {} } };
  globalThis.chrome = { runtime: { id: 'test', sendMessage: async request => {
    requests.push(request);
    let result;
    if (request.operation === 'PROMPT_SETTINGS') result = structuredClone({ library, candidate });
    if (request.operation === 'PROMPT_SAVE') {
      if (request.payload.expectedRevision !== library.revision) return { version: 1, requestId: request.requestId, ok: false, error: { code: 'PROMPT_CONFLICT', message: 'Saved prompts changed. Your edits are retained.' } };
      library.revision++;
      const index = library.templates.findIndex(item => item.id === request.payload.template.id);
      if (index < 0) library.templates.push(structuredClone(request.payload.template)); else library.templates[index] = structuredClone(request.payload.template);
      result = structuredClone(library);
    }
    return { version: 1, requestId: request.requestId, ok: true, result };
  } } };
  const slots = [], effects = [];
  let cursor = 0, changed = false;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: children.length ? { ...props, children } : props || {} }),
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; changed = true; } }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || !deps || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const Settings = createPromptSettings(React);
  function render() {
    let result;
    for (let attempt = 0; attempt < 20; attempt++) {
      cursor = 0; changed = false; result = Settings();
      while (effects.length) effects.shift()();
      if (!changed) return result;
    }
    throw new Error('Prompt UI did not settle.');
  }
  t.after(async () => { for (const slot of slots) slot?.cleanup?.(); globalThis.chrome = previousChrome; await studioStorage.close(); });
  render(); await setImmediate();
  let tree = render();
  assert.ok(text(tree).includes('Prompt settings'));
  let panel = nodes(tree).find(node => node.type?.name === 'ResumePrompt');
  assert.equal(panel.props.editor.base.document.candidate.id, 'one');
  nodes(panel.props.toolbar).find(node => node.type === 'button' && text(node) === 'New prompt').props.onClick();
  panel = nodes(render()).find(node => node.type?.name === 'ResumePrompt');
  panel.props.onEdit({ title: 'My template', text: 'Facts: {{candidate_profile}}\nJob: {{job_description}}' });
  panel = nodes(render()).find(node => node.type?.name === 'ResumePrompt');
  panel.props.onSave(); await setImmediate();
  assert.equal(library.templates.at(-1).title, 'My template');
  assert.equal(requests.find(request => request.operation === 'PROMPT_SAVE').payload.expectedRevision, 0);
  panel = nodes(render()).find(node => node.type?.name === 'ResumePrompt');
  assert.equal(panel.props.editing, null);
  panel.props.onEdit({ text: 'Retain this edit: {{candidate_profile}} / {{job_description}}' });
  render(); library.revision++;
  panel = nodes(render()).find(node => node.type?.name === 'ResumePrompt');
  panel.props.onSave(); await setImmediate();
  tree = render();
  panel = nodes(tree).find(node => node.type?.name === 'ResumePrompt');
  assert.ok(panel.props.editing.text.startsWith('Retain this edit'));
  const status = nodes(tree).find(node => node.type?.name === 'StatusBar');
  assert.ok(status.props.messages.some(message => message.level === 'error' && message.message.includes('edits are retained')));
});
