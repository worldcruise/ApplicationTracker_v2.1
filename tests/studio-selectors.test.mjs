import assert from 'node:assert/strict';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { createStudioSelectors } from '../extension/studio/studio-selectors.js';

const candidate = (id, prompt = 'first') => ({ revision: 1, document: { candidate: { id, name: id }, applicationPreferences: { assignedPromptTemplateId: prompt } } });
const library = { revision: 2, selectedId: 'first', templates: [{ id: 'first', title: 'Factual' }, { id: 'second', title: 'Concise' }] };
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function nodes(tree) { return Array.isArray(tree) ? tree.flatMap(nodes) : !tree || typeof tree !== 'object' ? [] : [tree, ...nodes(tree.props?.children)]; }
function harness(t, overrides = {}) {
  const slots = [], effects = [], requests = [], operations = [], listeners = new Set();
  let cursor = 0, dirty = false;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useRef: initial => slots[cursor++] ??= { current: initial },
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { const next = typeof value === 'function' ? value(slots[index]) : value; if (!Object.is(next, slots[index])) { slots[index] = next; dirty = true; } }];
    },
    useEffect(effect, deps) {
      const index = cursor++, previous = slots[index];
      if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
        slots[index] = { deps, cleanup: previous?.cleanup };
        effects.push(() => { previous?.cleanup?.(); slots[index].cleanup = effect(); });
      }
    },
  };
  const props = {
    candidate: candidate('one'), candidates: [{ id: 'one', name: 'One' }, { id: 'two', name: 'Two' }], disabled: false,
    flush: async () => { operations.push('flush'); }, onCandidateChange: id => { operations.push(`candidate:${id}`); },
    onBusyChange: busy => { operations.push(`busy:${busy}`); props.disabled = busy; },
    onSaved: result => { props.candidate = result.candidate; },
    request: async (operation, payload) => {
      requests.push({ operation, payload }); operations.push(operation);
      return operation === 'PROMPT_SETTINGS' ? { library: structuredClone(library) } : { library: structuredClone(library), candidate: { ...candidate(payload.candidateId, payload.templateId), revision: 2 } };
    }, ...overrides,
  };
  const Component = createStudioSelectors(React, { onChanged: { addListener: listener => listeners.add(listener), removeListener: listener => listeners.delete(listener) } });
  function render() {
    for (let attempt = 0; attempt < 20; attempt++) {
      cursor = 0; dirty = false;
      const tree = Component(props);
      while (effects.length) effects.shift()();
      if (!dirty) return tree;
    }
    throw Error('Selector UI did not settle.');
  }
  t.after(() => { for (const slot of slots) slot?.cleanup?.(); assert.equal(listeners.size, 0); });
  const find = id => nodes(render()).find(node => node.props.id === id);
  return { props, requests, operations, render, find, async settle() { for (let i = 0; i < 3; i++) { render(); await setImmediate(); } return render(); } };
}

test('Studio selectors load assignments and flush edits before saving a new prompt', async t => {
  const app = harness(t);
  await app.settle();
  assert.equal(app.find('studio-prompt').props.value, 'first');
  assert.equal(app.find('studio-candidate'),undefined);
  const flush = deferred(); app.props.flush = () => { app.operations.push('flush'); return flush.promise; };
  const select = app.find('studio-prompt').props.onChange;
  select({ target: { value: 'second' } });
  select({ target: { value: 'second' } });
  assert.equal(app.find('studio-prompt').props.disabled, true);
  assert.ok(!app.requests.some(request => request.operation === 'PROMPT_SELECT'));
  flush.resolve(); await app.settle();
  const saves = app.requests.filter(request => request.operation === 'PROMPT_SELECT');
  assert.equal(saves.length, 1);
  assert.equal(saves[0].payload.expectedCandidateRevision, 1);
  assert.ok(app.operations.indexOf('flush') < app.operations.indexOf('PROMPT_SELECT'));
  assert.equal(app.find('studio-prompt').props.value, 'second');
  assert.equal(app.find('studio-prompt').props.disabled, false);
});

test('Studio prompt save failures retain the previous selection and offer a reload', async t => {
  const app = harness(t);
  await app.settle();
  const request = app.props.request;
  app.props.request = (operation, payload) => operation === 'PROMPT_SELECT' ? Promise.reject(Error('Saved profile changed. Reload prompts.')) : request(operation, payload);
  await app.settle();
  app.find('studio-prompt').props.onChange({ target: { value: 'second' } });
  const tree = await app.settle();
  assert.equal(app.find('studio-prompt').props.value, 'first');
  assert.equal(app.find('studio-prompt').props.disabled, false);
  const error = nodes(tree).find(node => node.props.role === 'alert');
  assert.match(error.props.children[0], /Saved profile changed/);
  nodes(error).find(node => node.type === 'button').props.onClick();
  await app.settle();
  assert.equal(app.find('studio-selector-error'), undefined);
});

test('Studio ignores obsolete prompt loads and does not assign to a changed candidate after flushing', async t => {
  const delayed = deferred();
  const app = harness(t, { request: (operation, payload) => payload.candidateId === 'one' ? delayed.promise : Promise.resolve({ library: { ...library, selectedId: 'second' } }) });
  app.render();
  app.props.candidate = candidate('two', 'second');
  await app.settle();
  delayed.resolve({ library }); await app.settle();
  assert.equal(app.find('studio-prompt').props.value, 'second');
  const flush = deferred(), requests = [];
  app.props.flush = () => flush.promise;
  app.props.request = async (operation, payload) => { requests.push(operation); return { library }; };
  await app.settle();
  app.find('studio-prompt').props.onChange({ target: { value: 'first' } });
  app.props.candidate = candidate('one'); app.render();
  flush.resolve(); await app.settle();
  assert.ok(!requests.includes('PROMPT_SELECT'));
  assert.equal(app.props.candidate.document.applicationPreferences.assignedPromptTemplateId, 'first');
});
