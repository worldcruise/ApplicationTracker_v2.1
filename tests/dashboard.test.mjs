import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';
import test from 'node:test';
import { createWebHeader, WEB_PAGES } from '../extension/studio/web-header.js';
import { APP_NAME, APP_ICON } from '../extension/studio/branding.js';
import {createSettingsNavigation} from '../extension/studio/prompt-settings.js';

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
 assert.equal(nodes(tree).find(node=>node.type==='StudioSelectors'),undefined);
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
    PreviewWebHeader: 'WebHeader', Q1: 'Folder', mS: 'Customizer', W1: 'Viewer', CurrentResumePreview:'CurrentResume', StudioHeaderControls:'HeaderPreferences',
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
    q1: () => {}, matchMedia: () => ({ matches: true }), K1: () => ({ reason: '', busy: false, folder: { busy: false }, candidateRevision: 1, start: () => started++ }), PreviewWebHeader: 'WebHeader', Q1: 'Folder', mS: 'Customizer', W1: 'Viewer', CurrentResumePreview:'CurrentResume', StudioHeaderControls:'HeaderPreferences', chrome: { runtime: { getURL: file => `chrome-extension://test/${file}` } } });
  vm.runInContext(source.slice(first, last), context);
  const tree = context.V2(), toolbar = nodes(tree).find(node => node.props.className === 'preview-export-controls');
  const buttons = nodes(toolbar).filter(node => node.props['aria-label'] === 'Export PDF');
  assert.equal(buttons.length, 1); buttons[0].props.onClick(); assert.equal(started, 1);
  const editor = await readFile('extension/workspace.js', 'utf8');
  const editorView = editor.slice(editor.indexOf('function Vy('), editor.indexOf('function qy('));
  assert.ok(!editorView.includes('(ky,'));
});
