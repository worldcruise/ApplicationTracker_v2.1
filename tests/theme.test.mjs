import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

function event() { const listeners = new Set(); return { addListener: fn => listeners.add(fn), emit: (...args) => { for (const fn of listeners) fn(...args); } }; }
async function page(browser) {
  const classes = new Set(), values = new Map();
  const root = { dataset: {}, style: {}, classList: { toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) } };
  const context = vm.createContext({ chrome: browser, document: { documentElement: root }, localStorage: { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) } });
  const source = (await readFile('extension/studio/theme.js', 'utf8')).replaceAll('export ', '');
  vm.runInContext(source, context); context.installTheme();
  return { context, root, classes };
}
test('the exact theme preference restores and synchronizes dock, web page, and embedded editor', async () => {
  const changed = event(), saved = { 'ui-theme:v1': 'dark', unrelated: 'keep' };
  const browser = { storage: { onChanged: changed, local: { get: async () => structuredClone(saved), set: async next => { Object.assign(saved, next); changed.emit({ 'ui-theme:v1': { newValue: saved['ui-theme:v1'] } }, 'local'); } } } };
  const pages = await Promise.all([page(browser), page(browser), page(browser)]);
  await setImmediate();
  for (const page of pages) { assert.equal(page.root.dataset.theme, 'dark'); assert.equal(page.root.style.colorScheme, 'dark'); assert.ok(page.classes.has('dark')); }
  await pages[0].context.saveTheme('light');
  for (const page of pages) { assert.equal(page.root.dataset.theme, 'light'); assert.ok(!page.classes.has('dark')); assert.ok(page.classes.has('light')); }
  await Promise.all([pages[1].context.saveTheme('dark'), pages[1].context.saveTheme('light'), pages[1].context.saveTheme('dark')]);
  assert.equal(saved['ui-theme:v1'], 'dark'); assert.equal(saved.unrelated, 'keep');
  for (const page of pages) assert.equal(page.root.dataset.theme, 'dark');
});
test('failed theme persistence retains the selected appearance and supports retry', async () => {
  let fail = true, saved = 'light';
  const browser = { storage: { onChanged: event(), local: { get: async () => ({ 'ui-theme:v1': saved }), set: async next => { if (fail) throw Error('Unavailable'); saved = next['ui-theme:v1']; } } } };
  const app = await page(browser); await setImmediate();
  await app.context.saveTheme('dark'); assert.equal(app.root.dataset.theme, 'dark');
  assert.match(vm.runInContext('error', app.context), /could not be saved/);
  fail = false; await app.context.saveTheme('dark'); assert.equal(saved, 'dark'); assert.equal(vm.runInContext('error', app.context), '');
});
