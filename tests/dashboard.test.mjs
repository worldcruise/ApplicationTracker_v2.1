import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import { createWebHeader, WEB_PAGES } from '../extension/studio/web-header.js';
import { APP_NAME, APP_ICON } from '../extension/studio/branding.js';

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

test('web navigation retains SpeedyApply pages alongside the v2 dashboard and Studio preview', async () => {
  const source = await readFile('extension/chunks/options-DnVa9wE8.js', 'utf8');
  const between = (start, end) => {
    const first = source.indexOf(start), last = source.indexOf(end, first + start.length);
    assert.ok(first >= 0 && last > first, start);
    return source.slice(first, last);
  };
  const jsx = (type, props) => ({ type, props: props || {} });
  const context = {
    K: { jsx, jsxs: jsx, Fragment: 'Fragment' }, Qu: () => ({ pathname: context.route }),
    Ti: () => ({ profile: {}, isLoading: false }), Ur: () => ({ data: { limits: { premiumAutofill: true } } }),
    Ai: () => ({ settings: {}, configList: [] }), Nf: () => ({ openFeedbackDialog: () => {} }),
    b: (...values) => values.filter(Boolean).join(' '), Qe: () => '',
    Bc: 'AutofillIcon', Sn: 'PremiumIcon', gi: 'Config', vf: 'Link', ti: 'Divider', Dd: 'Outlet',
    Vf: 'LoginDialog', zf: 'FeedbackDialog', zs: 'Wordmark', C: 'Button', Jc: 'FeedbackIcon', ip: 'Account', Mf: 'Footer',
    StudioPreviewLink: 'PreviewLink',
    AutofillWebHeader: 'WebHeader', WEB_PAGES,
    ProfileSectionIcon: 'ProfileIcon', PromptSectionIcon: 'PromptIcon',
    route: '/resume-studio',
  };
  vm.createContext(context);
  vm.runInContext([
    between('var ap=', 'function op('), between('function op(', 'var sp='),
    between('function bp(', 'function xp('), between('var ry=', 'function iy('), between('function iy(', 'function ay('),
  ].join('\n'), context);
  const headerProps = nodes(context.op()).find(node => node.type === 'WebHeader').props;
  const Header = createWebHeader({ createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), useState: initial => [initial, () => {}] });
  const webHeader = Header(headerProps);
  const navigation = nodes(webHeader).filter(node => ['Link', 'PreviewLink'].includes(node.type) && node.props.className === 'autofill-web-link');
  assert.deepEqual(navigation.map(text), ['Dashboard', 'Resume Studio', 'Applications', 'Meetings', 'Settings']);
  const brand = nodes(webHeader).find(node => node.props.className === 'autofill-web-brand');
  assert.equal(text(brand), APP_NAME);
  assert.equal(nodes(brand).find(node => node.type === 'img').props.src, APP_ICON);
  for (const active of ['/dashboard', '/resume-studio', '/settings/profile']) {
    const current = Header({ ...headerProps, active });
    const currentBrand = nodes(current).find(node => node.props.className === 'autofill-web-brand');
    assert.equal(text(currentBrand), APP_NAME);
    assert.equal(nodes(currentBrand).find(node => node.type === 'img').props.src, APP_ICON);
  }
  const manifest = JSON.parse(await readFile('extension/manifest.json', 'utf8'));
  assert.equal(manifest.name, APP_NAME); assert.equal(manifest.short_name, APP_NAME);
  assert.equal(manifest.action.default_title, `Open ${APP_NAME} dock`);
  for (const file of ['options.html', 'workspace.html', 'preview.html', 'settings.html']) assert.ok((await readFile(`extension/${file}`, 'utf8')).includes(APP_NAME));
  assert.equal(navigation.find(node => node.type === 'PreviewLink').props.to, '/resume-studio');
  for (const route of ['/', '/resume-studio', '/profile', '/settings']) {
    context.route = route;
    assert.ok(!nodes(context.bp()).some(node => node.type === 'Footer'));
  }
  context.route = '/settings/autofill';
  assert.ok(!text(context.op()).includes('Feedback'));
  assert.ok(!nodes(context.op()).some(node => node.props.className === 'autofill-dock-theme'));
  assert.deepEqual(nodes(context.iy()).filter(node => node.type === 'Link').map(text), ['Profile', 'Prompt settings', 'Autofill', 'Premium']);
  const router = between('function KL(){', 'Af.createRoot(');
  assert.ok(router.includes('path:`dashboard`'));
  assert.ok(router.includes('path:`resume-studio`'));
  assert.ok(router.includes('path:``,element:(0,K.jsx)(GL,{})'));
  assert.ok(router.includes('path:`profile`') && router.includes('path:`profile/new`') && router.includes('path:`settings`'));
  assert.ok(router.includes('path:`prompts`,element:(0,K.jsx)(AutofillPromptSettings,{})'));
  assert.ok(router.includes('to:`profile`,replace:!0'));
  const preview = await readFile('extension/preview.js', 'utf8');
  assert.ok(preview.includes('PreviewWebHeader,{active:"/resume-studio"}'));
  assert.ok(preview.includes('children:"Document preview"') && preview.includes('"Customize"'));
  assert.ok(preview.slice(preview.indexOf('function V2(')).includes('"aria-label":"Export PDF"'));
  vm.runInContext(between('function EL()', 'var FL='), Object.assign(context, { Wk: 'ApplicationList' }));
  assert.equal(context.EL().type, 'ApplicationList');
  context.ApplicationFilters = 'ApplicationFilters';
  const filterStart = source.indexOf('function Bk()'), filterEnd = source.indexOf('function ', filterStart + 15);
  vm.runInContext(source.slice(filterStart, filterEnd), context);
  const toolbar = context.Bk();
  assert.equal(toolbar.type, 'ApplicationFilters');
  assert.ok(!router.includes('path:`subscription`'));
  for (const title of ['Welcome to Autofill', 'Optimize Your Job Search', 'Pin to Your Browser']) assert.ok(!source.includes(title));
});

async function components() {
  const source = (await readFile('extension/studio/preview-components.js', 'utf8'))
    .replace(/^import[^\n]+\n/gm, '').replaceAll('export function ', 'function ');
  const slots = [];
  const effects = [];
  const cleanups = [];
  const listeners = new Set();
  const classes = new Set();
  const records = {
    'candidate:one': { document: { candidate: { id: 'one', name: 'Saved Candidate' } } },
    'active-candidate:v1': 'one', 'ui-theme:v1': 'dark',
  };
  let cursor = 0, mounted = false, opened;
  const React = {
    Fragment: 'Fragment',
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect(effect) { if (!mounted) effects.push(effect); },
  };
  const context = {
    requireReact: () => React,
    chrome: { windows: { getCurrent: async () => ({ id: 41 }) } },
    openStudioDock: async id => { opened = id; },
    openStudioPreview: async id => { opened = id; },
    document: { documentElement: { classList: {
      contains: name => classes.has(name),
      toggle: (name, enabled) => { if (enabled) classes.add(name); else classes.delete(name); },
    } } },
    localStorage: { setItem: () => {} },
    studioStorage: {
      get: async () => structuredClone(records),
      set: async items => {
        Object.assign(records, items);
        const changes = Object.fromEntries(Object.entries(items).map(([key, newValue]) => [key, { newValue }]));
        for (const listener of listeners) listener(changes, 'local');
      },
      onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    },
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return {
    context, classes, records, opened: () => opened,
    render(name) {
      cursor = 0;
      const tree = context[name]({ className: 'preview-link', children: 'Resume Studio' });
      while (effects.length) cleanups.push(effects.shift()());
      mounted = true;
      return tree;
    },
    close() { cleanups.forEach(cleanup => cleanup?.()); },
  };
}

test('Resume Studio web navigation opens its preview and embedded editor', async t => {
  const app = await components();
  t.after(() => app.close());
  assert.equal(nodes(app.render('StudioPreviewLink')).find(node => node.type === 'button').props.disabled, true);
  await setImmediate();
  const ready = app.render('StudioPreviewLink');
  const button = nodes(ready).find(node => node.type === 'button');
  assert.equal(button.props.disabled, false);
  button.props.onClick();
  await setImmediate();
  assert.equal(app.opened(), 41);
  assert.equal(nodes(app.render('StudioPreviewLink')).find(node => node.type === 'button').props.disabled, false);
});

test('Resume Studio keeps its editor mounted beside the preview without the previous dock', async () => {
 const source=await readFile('extension/workspace.js','utf8');
 const start=source.indexOf('function Py(){'),end=source.indexOf('var _d=',start);
 const noop=()=>{},jsx=(type,props)=>({type,props:props||{}});
 const candidate={document:{candidate:{id:'one',name:'Candidate'}}};let state=0;
 const context={U:{jsx,jsxs:jsx},oe:{useRef:value=>({current:value}),useEffect:noop,useState:value=>{const index=state++;return[index===0?candidate:index===1?[{id:'one',name:'Candidate'}]:index===2?false:value,noop]}},
 Jy:()=>({theme:'light',error:''}),ry:()=>41,my:()=>({error:''}),it:()=>true,zy:()=>({draft:{id:'draft'},flush:async()=>{}}),
 qy:()=>({tabId:100}),Gy:()=>({}),Yy:()=>({}),Fy:()=>({messages:[],checking:false}),Xy:noop,zd:()=>({}),Ky:()=>({}),useStudioNavigationFlush:noop,Hy:'Status',StudioSelectors:'StudioSelectors',Z:noop,Vy:'ResumeEditor',aS:'ReplacementDialog',nS:'DeleteDialog'};
 vm.createContext(context);vm.runInContext(source.slice(start,end),context);const tree=context.Py();
 assert.equal(nodes(tree).filter(node=>node.type==='ResumeEditor').length,1);
 assert.equal(nodes(tree).find(node=>node.type==='ResumeEditor').props.candidate,candidate);
 assert.equal(nodes(tree).find(node=>node.type==='StudioSelectors').props.candidate,candidate);
 assert.ok(!nodes(tree).some(node=>node.props.role==='tablist'||node.props.role==='tabpanel'));
 assert.equal(nodes(tree).find(node=>node.props.className==='resume-studio-panel').props.hidden,undefined);
 assert.ok(!nodes(tree).some(node=>node.props.className==='resume-candidate-actions'||node.props.className==='resume-editor-heading'));
});

test('Resume Studio keeps its collapsed input editor mounted while preview is still connecting', async () => {
  const source = await readFile('extension/preview.js', 'utf8');
  const first = source.indexOf('function V2('), last = source.indexOf('(0,J1.createRoot)', first);
  const jsx = (type, props) => ({ type, props: props || {} });
  const context = vm.createContext({ $t: { jsx, jsxs: jsx }, je: { useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: () => {} },
    q1: () => {}, matchMedia: () => ({ matches: true }), K1: () => ({}), PreviewWebHeader: 'WebHeader', chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` } } });
  vm.runInContext(source.slice(first, last), context);
  const tree = context.V2();
  const layout = nodes(tree).find(node => node.props.className === 'resume-web-layout');
  assert.equal(layout.props.children[0].props.className, 'resume-web-preview-area');
  assert.equal(layout.props.children[1].props.className, 'resume-web-editor-area');
  assert.equal(layout.props.children[1].props.hidden, true);
  assert.equal(nodes(layout).find(node => node.type === 'iframe').props.src, 'chrome-extension://test/workspace.html');
});

test('Resume Studio input starts collapsed and toggles independently of Customize without removing its editor', async () => {
  const source = await readFile('extension/preview.js', 'utf8');
  const first = source.indexOf('function V2('), last = source.indexOf('(0,J1.createRoot)', first);
  const jsx = (type, props) => ({ type, props: props || {} });
  const slots = []; let cursor = 0;
  const context = vm.createContext({ $t: { jsx, jsxs: jsx }, je: {
    useState(initial) {
      const index = cursor++;
      if (!Object.hasOwn(slots, index)) slots[index] = index === 1
        ? { workspaceId: '41', candidateId: 'one', draftId: 'draft', status: 'waiting' }
        : typeof initial === 'function' ? initial() : initial;
      return [slots[index], next => { slots[index] = typeof next === 'function' ? next(slots[index]) : next; }];
    },
    useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: () => {},
  }, q1: () => {}, matchMedia: () => ({ matches: true }),
    K1: () => ({ reason: '', busy: false, folder: { busy: false }, candidateRevision: 1 }),
    PreviewWebHeader: 'WebHeader', Q1: 'Folder', mS: 'Customizer', W1: 'Viewer',
    chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` } } });
  vm.runInContext(source.slice(first, last), context);
  const render = () => { cursor = 0; return context.V2(); };
  const inputButton = tree => nodes(tree).find(node => node.props['aria-controls'] === 'resume-input-panel');
  const assertPanel = (tree, open, customizeOpen) => {
    const layout = nodes(tree).find(node => node.props.className?.startsWith('resume-web-layout'));
    const editor = layout.props.children[1];
    assert.equal(layout.props.className, `resume-web-layout${open ? ' input-open' : ''}`);
    assert.equal(editor.props.id, inputButton(tree).props['aria-controls']);
    assert.equal(editor.props.hidden, !open);
    assert.equal(inputButton(tree).props['aria-expanded'], open);
    assert.equal(editor.type, 'aside');
    assert.equal(editor.props.children.type, 'iframe');
    assert.equal(editor.props.children.props.src, 'chrome-extension://test/workspace.html');
    assert.equal(nodes(tree).find(node => node.type === 'Customizer').props.open, customizeOpen);
    assert.equal(nodes(tree).filter(node => node.props['aria-label'] === 'Export PDF').length, 1);
  };
  let tree = render(); assertPanel(tree, false, true);
  inputButton(tree).props.onClick();
  tree = render(); assertPanel(tree, true, true);
  nodes(tree).find(node => node.props['aria-controls'] === 'customize-panel').props.onClick();
  tree = render(); assertPanel(tree, true, false);
  inputButton(tree).props.onClick();
  tree = render(); assertPanel(tree, false, false);
  inputButton(tree).props.onClick();
  assertPanel(render(), true, false);
});

test('ready Resume Studio exposes PDF export only in the preview top bar', async () => {
  const source = await readFile('extension/preview.js', 'utf8');
  const first = source.indexOf('function V2('), last = source.indexOf('(0,J1.createRoot)', first);
  const jsx = (type, props) => ({ type, props: props || {} }); let state = 0, started = 0;
  const context = vm.createContext({ $t: { jsx, jsxs: jsx }, je: { useState: initial => [state++ === 1 ? { workspaceId: '41', candidateId: 'one', draftId: 'draft', status: 'waiting' } : typeof initial === 'function' ? initial() : initial, () => {}], useRef: value => ({ current: value }), useCallback: fn => fn, useEffect: () => {} },
    q1: () => {}, matchMedia: () => ({ matches: true }), K1: () => ({ reason: '', busy: false, folder: { busy: false }, candidateRevision: 1, start: () => started++ }), PreviewWebHeader: 'WebHeader', Q1: 'Folder', mS: 'Customizer', W1: 'Viewer', chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` } } });
  vm.runInContext(source.slice(first, last), context);
  const tree = context.V2(), toolbar = nodes(tree).find(node => node.props.className === 'preview-export-controls');
  const buttons = nodes(toolbar).filter(node => node.props['aria-label'] === 'Export PDF');
  assert.equal(buttons.length, 1); buttons[0].props.onClick(); assert.equal(started, 1);
  const editor = await readFile('extension/workspace.js', 'utf8');
  const editorView = editor.slice(editor.indexOf('function Vy('), editor.indexOf('function qy('));
  assert.ok(!editorView.includes('(ky,'));
});
