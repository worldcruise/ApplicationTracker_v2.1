// Execute the actual packaged options bundle in an isolated DOM for runtime regressions.
// This is a Node test environment, not a browser or a replacement for Chrome visual review.
import { Window } from 'happy-dom';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { emptyProfile } from '../extension/studio/profile-model.js';

const route = process.argv[2] || '/dashboard';
const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
const page = new Window({ url: `chrome-extension://web-runtime/options.html#${route}` });
page.document.body.innerHTML = '<div id="root"></div>';
const errors = [];
page.addEventListener('error', event => { errors.push(event.error?.stack || event.message); event.preventDefault(); });
process.on('unhandledRejection', error => errors.push(error?.stack || String(error)));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(args.map(arg => arg?.stack || String(arg)).join(' ')); };
for (const name of ['window','document','navigator','location','history','localStorage','sessionStorage','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','Node','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','DOMException','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia']) {
  const value = name === 'window' ? page : page[name];
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: typeof value === 'function' && ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia'].includes(name) ? value.bind(page) : value });
}
function event() { const callbacks = new Set(); return { addListener: fn => callbacks.add(fn), removeListener: fn => callbacks.delete(fn), emit: (...args) => callbacks.forEach(fn => fn(...args)) }; }
const changed = event();
const profile = { ...emptyProfile(), profileName: 'Default', nameData: { firstName: 'Runtime', middleName:'M', lastName: 'Candidate', preferredName: false } };
const saved = { profile, appliedList: [{ jobTitle: 'Runtime Engineer', companyName: 'Example', jobLink: 'https://example.test/job', companyLink: 'https://example.test/', date: new Date().toString(), status: 'applied', profileName: 'Default' }], dailyGoal: 10, 'ui-theme:v1': 'dark' };
const legacyMeetingsKey='application-tracker:meetings:v1';
saved[legacyMeetingsKey] = { schemaVersion: 1, revision: 1, meetings: [{ id: 'runtime-meeting', title: 'Technical interview', company: 'Example', startsAt: new Date().toISOString(), stage: 'scheduled', url: '', notes: '', revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
function storage(area) { return {
  get: (keys, callback) => { const result = keys == null ? structuredClone(saved) : Object.fromEntries((typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)).filter(key => key in saved).map(key => [key, structuredClone(saved[key])])); callback?.(result); return Promise.resolve(result); },
  set: async value => { Object.assign(saved, value); changed.emit(Object.fromEntries(Object.entries(value).map(([key, newValue]) => [key, { newValue }])), area); }, remove: async () => {},
}; }
const tabActions = [];
const chrome = {
  runtime: { id: 'web-runtime', getURL: path => `chrome-extension://web-runtime/${path.replace(/^\//,'')}`, getManifest: () => manifest, onMessage: event(), onConnect: event(),
    sendMessage: async message => {
      return message.type === 'getSelectedProfile' ? profile : undefined;
    }, openOptionsPage: async () => {}, connect: () => ({ onMessage: event(), onDisconnect: event(), postMessage() {}, disconnect() {} }) },
  storage: { local: storage('local'), session: storage('session'), onChanged: changed },
  windows: { getCurrent: async () => ({ id: 41, type: 'normal' }) },
  tabs: { getCurrent: async () => ({ id: 100, windowId: 41, url: page.location.href }), query: async () => [{ id: 7, url: 'https://example.test/job', title: 'Runtime Engineer', active: false }], onActivated: event(), onUpdated: event(), onRemoved: event(), create: async input => { tabActions.push({ type: 'create', ...input }); return {}; }, update: async (id, input) => { tabActions.push({ type: 'update', id, ...input }); return {}; } },
  cookies: { getAll: async () => [], get: async () => null, onChanged: event() },
};
globalThis.chrome = page.chrome = chrome;
const previousMeetings = JSON.stringify(saved[legacyMeetingsKey]);
for (const stage of ["screen","interview","offer","rejected","archived"]) saved.appliedList.push({...saved.appliedList[0],jobTitle:`${stage} application`,jobLink:`https://example.test/${stage}`,status:stage});
globalThis.fetch = page.fetch = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
try {
  await import('../extension/chunks/options-DnVa9wE8.js');
  await delay(400);
  const scenario = process.argv[3];
  function enter(node, value) {
    if (!node) throw new Error('Missing test form control.');
    const prototype = node.localName === 'select' ? page.HTMLSelectElement.prototype : node.localName === 'textarea' ? page.HTMLTextAreaElement.prototype : page.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new page.Event(node.localName === 'select' ? 'change' : 'input', { bubbles: true }));
  }
  const button = (label, root = page.document) => [...root.querySelectorAll('button')].find(node => node.textContent === label);
  // Exercise the icon-only toggle through the actual web header runtime.
  const appearance = page.document.querySelector('button.web-theme-toggle');
  if (appearance?.getAttribute('aria-pressed') !== 'true') throw new Error('Theme toggle did not restore the saved appearance.');
  if (appearance.textContent.trim() || !appearance.querySelector('svg') || page.document.querySelector('.web-theme-control select')) throw new Error('Theme control must be an icon-only button.');
  let previousIcon = appearance.querySelector('path').getAttribute('d');
  for (const theme of ['light', 'dark']) {
    appearance.click(); await delay(30);
    if (page.document.documentElement.dataset.theme !== theme || saved['ui-theme:v1'] !== theme || appearance.getAttribute('aria-pressed') !== String(theme === 'dark')) throw new Error('Theme toggle and saved appearance diverged.');
    const icon = appearance.querySelector('path').getAttribute('d');
    if (icon === previousIcon || appearance.getAttribute('aria-label') !== `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`) throw new Error('Theme toggle did not update its icon and accessible label.');
    previousIcon = icon;
  }
  if (scenario === 'filters') {
    enter(page.document.querySelector('[aria-label="Application status"]'), 'interview'); await delay(30);
    if (page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Status filter did not update the application list.');
    enter(page.document.querySelector('[data-test="applications-table-filter-input"]'), 'Runtime'); await delay(30);
    if (page.document.querySelector('[aria-label="Application status"]').value !== 'interview') throw new Error('Search reset the selected status.');
    button('Clear filters').click(); await delay(30);
    if (!page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Clear filters did not restore the application.');
    enter(page.document.querySelector('[aria-label="Applied from"]'), '2030-01-01'); await delay(30);
    if (page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Date filter did not update the application list.');
    button('Clear filters').click(); await delay(30);
  }
  if (scenario === 'meetings') {
    if(page.document.querySelector('[data-test="applications-board-column-applied"]')) throw new Error('Applied column must be absent from Meetings.');
    if(page.document.querySelector('.application-progress')||page.document.querySelector('[data-testid="applications-sankey"]'))throw new Error('Meetings must not contain a progress chart.');
    enter(page.document.querySelector('[aria-label="Application status"]'),'interview');await delay(30);
    const board=page.document.querySelector('[data-test="applications-board"]');
    if(!board.textContent.includes('interview application')||board.textContent.includes('screen application'))throw new Error('Meetings status filter does not match its cards.');
    button('Clear filters').click();await delay(30);
    if(JSON.stringify(saved[legacyMeetingsKey])!==previousMeetings)throw new Error('The retired local meeting records were changed.');
  }
  if(scenario==='progress'){
    if(page.document.querySelector('[data-test="applications-board"]'))throw new Error('Dashboard must not contain the board.');
    if(!page.document.querySelector('.web-dashboard-chart-card')?.nextElementSibling?.classList.contains('application-progress'))throw new Error('Progress must be directly under activity.');
    enter(page.document.querySelector('[aria-label="Progress period"]'),'total');await delay(30);
    if(!page.document.querySelector('.application-progress-svg')?.getAttribute('aria-label')?.includes('Total applied: 6'))throw new Error('Progress did not use application totals.');
  }
  if (scenario === 'navigation') {
    for (const [path, heading] of [['/meetings','Meetings'], ['/','Applications'], ['/settings','Settings'], ['/dashboard','Dashboard']]) {
      const link = [...page.document.querySelectorAll('.autofill-web-nav a')].find(node => node.getAttribute('href')?.endsWith(`#${path}`));
      if (!link) throw new Error(`Missing navigation link to ${path}.`);
      link.click(); await delay(80);
      if (![...page.document.querySelectorAll('h1')].some(node => node.textContent === heading)) throw new Error(`Clicking ${path} did not render ${heading}.`);
    }
    button('View all').click(); await delay(80);
    if (!page.document.querySelector('h1')?.textContent.includes('Applications')) throw new Error('View all did not navigate in the current page.');
    const dashboard = [...page.document.querySelectorAll('.autofill-web-nav a')].find(node => node.getAttribute('href')?.endsWith('#/dashboard'));
    dashboard.click(); await delay(80);
    button('Edit profile').click(); await delay(80);
    if (!page.location.hash.includes('/settings/profile') || !page.document.querySelector('h1')?.textContent.includes('Settings')) throw new Error('Edit profile did not stay in the current page.');
    if (tabActions.length) throw new Error('Internal navigation opened or updated a different Chrome tab.');
  }
  const text = page.document.body.textContent;
  const result = { route, headings: [...page.document.querySelectorAll('h1,h2')].map(node => node.textContent), text: text.slice(0, 5000), applicationBoard: Boolean(page.document.querySelector('[data-test="applications-board"]')), progress: Boolean(page.document.querySelector('.application-progress')), dbButton: Boolean(page.document.querySelector('.web-header-actions button[aria-label="Connect to DB"]:disabled')), searchPlaceholder: page.document.querySelector('[data-test="applications-table-filter-input"]')?.getAttribute('placeholder'), errors };
  originalConsoleError(JSON.stringify(result));
  await page.happyDOM.abort();
  process.exit(errors.length || !page.document.getElementById('root')?.childElementCount ? 1 : 0);
} catch (error) { originalConsoleError(error); process.exit(1); }
