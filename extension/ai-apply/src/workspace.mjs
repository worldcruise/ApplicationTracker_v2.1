import { connectTrackerWorkspace } from './tracker-workspace.mjs';
import { createJobQueue } from './job-queue.mjs';
import { createGenerationClient } from './generation-client.mjs';
import { openApplicationTabs } from './apply-tabs.mjs';
import { createChatSidebar } from './sidebar.mjs';
import { createStudio } from './studio.mjs';
import { renderIcons } from './icons.mjs';
import { createBrowserTabs } from './browser-tabs.mjs';
import { connectKeywordPreferences } from './keyword-preferences.mjs';
import { createPageHighlights } from './page-highlights.mjs';
import { createWorkspaceShortcuts } from './workspace-shortcuts.mjs';
import { createChatProviders } from './chat-providers.mjs';
import { createDeepseekToolbar } from './deepseek-toolbar.mjs';
import { createWorkspaceDock } from './workspace-dock.mjs';
import { chatProviderForUrl, requestChatUrl } from './saved-chat.mjs';
import {createDockState} from '../../studio/dock-state.js';

const q = selector => document.querySelector(selector);
renderIcons();
const remembered=createDockState({browser:chrome,scope:'apply',windowId:Number(new URL(location.href).searchParams.get('windowId'))||undefined});
let restoringWorkspace=true,explicitNavigation=false;
document.addEventListener('click',event=>{if(restoringWorkspace&&event.target.closest('#apply-tab,#results-tab,#job-tab,#chat-dock-toggle,#studio-dock-toggle'))explicitNavigation=true;},true);
function rememberWorkspace(patch={}){if(restoringWorkspace)return;void remembered.patch({...studio.viewState(),panel:studioPanel,positions:{...studioPositions,[studioPanel]:studioScroll.scrollTop},chatOpen:!q('#chat-view').hidden,...patch}).catch(()=>{});}

// Each panel remains mounted. Switching views never reloads the ChatGPT frame.
function bindTabs(entries, onSelect, onBeforeSelect) {
  function select(id) {
    onBeforeSelect?.(id);
    const known = entries.some(entry => entry.id === id);
    for (const entry of entries) {
      const selected = entry.id === id;
      entry.tab.setAttribute('aria-selected', String(selected));
      entry.tab.tabIndex = selected || (!known && entry === entries[0]) ? 0 : -1;
      entry.panel.hidden = !selected;
    }
    onSelect?.(id);
  }
  entries.forEach((entry, index) => {
    entry.tab.addEventListener('click', () => select(entry.id));
    entry.tab.addEventListener('keydown', event => {
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      const offset = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      let target;
      if (offset) target = entries[(index + offset + entries.length) % entries.length];
      if (event.key === 'Home') target = entries[0];
      if (event.key === 'End') target = entries.at(-1);
      if (!target) return;
      event.preventDefault();
      select(target.id);
      target.tab.focus();
    });
  });
  return select;
}

let chat;
let deepseekChat;
let chatProviders;
let workspaceShortcuts;
const { select: selectView } = createWorkspaceDock({
  onOpen: () => requestAnimationFrame(() => {
    if(pendingSidebarUrl){const url=pendingSidebarUrl;pendingSidebarUrl=null;void syncSidebarChat(url).catch(error=>studio.chatError(error.message));}
    else { chatProviders?.ensureCurrent();if(chatProviders?.current()==='chatgpt')void chat?.ensureLoaded(); }
    chat?.probe();
    deepseekChat?.probe();
  }),
  onClose: () => {
    chat?.probe();
    deepseekChat?.probe();
    chat?.hideControls();
  },
  onStudioChange: expanded=>{setStudioExpanded(expanded);rememberWorkspace({chatOpen:!expanded});}
});

const studioScroll = q('#studio-scroll');
const studioPositions = { job: 0, results: 0, apply: 0 };
let studioPanel = 'apply';
function setStudioExpanded(expanded) {
  const content = q('#studio-content'), toggle = q('#studio-dock-toggle');
  if (expanded === !content.hidden) return;
  if (!expanded) studioPositions[studioPanel] = studioScroll.scrollTop;
  content.hidden = !expanded;
  q('#studio-view').dataset.collapsed = String(!expanded);
  document.body.classList.toggle('studio-dock-collapsed', !expanded);
  toggle.setAttribute('aria-expanded', String(expanded));
  toggle.title = `${expanded ? 'Collapse' : 'Expand'} job workspace`;
  toggle.setAttribute('aria-label', toggle.title);
  if (expanded) studioScroll.scrollTop = studioPositions[studioPanel];
  else if (content.contains(document.activeElement)) toggle.focus();
}
q('#studio-dock-toggle').addEventListener('click', () => selectView(q('#studio-content').hidden ? 'studio' : 'chat'));
q('.studio-navigation').addEventListener('click', event => {
  if (event.target.closest('button')) return;
  q('#studio-dock-toggle').click();
  q('#studio-dock-toggle').focus();
});
const selectStudioTab = bindTabs([
  { id: 'apply', tab: q('#apply-tab'), panel: q('#apply-panel') },
  { id: 'results', tab: q('#results-tab'), panel: q('#results-panel') },
  { id: 'job', tab: q('#job-tab'), panel: q('#job-panel') }
], id => {
  selectView('studio');
  studioScroll.scrollTop = studioPositions[id];
  q('#job-actions').hidden = id !== 'job';
  q('#results-actions').hidden = id !== 'results';
  q('#apply-actions').hidden = id !== 'apply';
  rememberWorkspace({panel:id});
}, id => {
  if (!q('#studio-content').hidden) studioPositions[studioPanel] = studioScroll.scrollTop;
  studioPanel = id;
});

const dialogFocus = new WeakMap();
function openDialog(id) {
  const dialog = document.getElementById(id);
  dialogFocus.set(dialog, document.activeElement);
  dialog.showModal();
}
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right ||
        event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => dialogFocus.get(dialog)?.focus({ preventScroll: true }));
}
for (const button of document.querySelectorAll('[data-close-dialog]')) {
  button.addEventListener('click', () => button.closest('dialog').close());
}

let browserTabs;
let browserWindowId;
const queue = createJobQueue();
const generations = createGenerationClient();
let silentChatRevision = 0, silentChatWork = Promise.resolve(), pendingSidebarUrl = null;
function syncSidebarChat(url, { preload = false } = {}) {
  const revision = ++silentChatRevision;
  pendingSidebarUrl=url || null;
  if (!url) return preload ? chatProviders.ready.then(() => {
    if(revision!==silentChatRevision)return;
    chatProviders.ensureCurrent();
    if(chatProviders.current()==='chatgpt')return chat.ensureLoaded();
  }) : Promise.resolve();
  const isCurrent = () => revision === silentChatRevision;
  const task = async () => {
    await chatProviders.ready;
    if (!isCurrent()) return;
    const provider = chatProviderForUrl(url);
    await chatProviders.showProvider(provider);
    if(q('#chat-view').hidden&&!preload){pendingSidebarUrl=url;return;}
    pendingSidebarUrl=null;
    chatProviders.ensureCurrent();
    if (!isCurrent()) return;
    await (provider === 'deepseek' ? deepseekChat : chat).openConversation(url, { reveal: false, isCurrent });
  };
  silentChatWork = silentChatWork.catch(() => {}).then(task);
  return silentChatWork;
}
const studio = createStudio({
  queue,
  generations,
  onApplySelection:request=>rememberWorkspace({jobId:request?.id||null}),
  getChatProvider: () => chatProviders?.current() || 'chatgpt',
  openApplication: async request => {
    const windowId=browserWindowId||(await chrome.windows.getCurrent()).id;
    const state=await chrome.runtime.sendMessage({type:'ai-apply.autofill',operation:'DOCK_APPLY_STATE',payload:{windowId}});
    const result=await openApplicationTabs({jobUrl:request.input.job.url,jobId:request.id,session:state?.value?.run,windowId});
    if(request.state==='ready'&&request.resume){const reply=await chrome.runtime.sendMessage({type:'ai-apply.autofill',operation:'DOCK_APPLY_TRACK',payload:{jobId:request.id,tabId:result.jobTab.id,windowId:result.jobTab.windowId}});if(!reply?.ok)throw Error(reply?.error||'Application tracking could not start.');}
    return result;
  },
  openDialog,
  syncChat: syncSidebarChat,
  showStudio: panel => { selectView('studio'); selectStudioTab(panel); },
  showChat: url => {
    pendingSidebarUrl=null;
    silentChatRevision++;
    if (!url) { selectView('chat'); return; }
    void (async () => {
      const provider = chatProviderForUrl(url);
      await chatProviders.showProvider(provider); selectView('chat');
      await (provider === 'deepseek' ? deepseekChat : chat).openConversation(url);
    })().catch(error => studio.chatError(error.message));
  },
  getCurrentChat: () => chatProviders?.current() === 'deepseek' ? deepseekChat?.getCurrentChat() : chat?.getCurrentChat(),
  moveTab: direction => browserTabs?.move(direction)
});
const pageHighlights = createPageHighlights();
connectKeywordPreferences({ onChange: pageHighlights.update });
browserTabs = createBrowserTabs({
  onChange: value => { browserWindowId = value.windowId; studio.updateTabs(value); pageHighlights.setTarget(value); },
  onError: studio.tabError
});
async function readFromShortcut() {
  await browserTabs.ready;
  if (!Number.isInteger(browserWindowId)) return;
  try {
    // A development tab showing index.html must not consume the dock's command.
    if (window===window.top && await chrome.tabs.getCurrent()) return;
    const response = await chrome.runtime.sendMessage({ type: 'job.read-command.take', windowId: browserWindowId });
    if (!response?.request) return;
    explicitNavigation=true;
    await browserTabs.refresh();
    selectView('studio');
    selectStudioTab('job');
    // Retain the shortcut's source tab if the user switches while opening.
    await studio.readPage(response.request.tabId);
  } catch (error) { studio.tabError(error.message || 'Could not read this job page.'); }
}
function onReadRequested(message, sender) {
  if (sender.id === chrome.runtime.id && message?.type === 'job.read-requested' &&
      message.windowId === browserWindowId) void readFromShortcut();
}
chrome.runtime.onMessage.addListener(onReadRequested);
void readFromShortcut();
window.addEventListener('pagehide', () => {
  browserTabs.dispose();
  chrome.runtime.onMessage.removeListener(onReadRequested);
  workspaceShortcuts?.dispose();
});

chat = createChatSidebar({
  lazy:true,
  onOpenChat: () => { silentChatRevision++; selectView('chat'); },
  onShortcut: action => workspaceShortcuts?.run(action),
});
deepseekChat = createDeepseekToolbar();
chatProviders = createChatProviders({ lazy:true, onSelect: (_provider, source) => { pendingSidebarUrl=null;silentChatRevision++; selectView('chat'); } });
workspaceShortcuts = createWorkspaceShortcuts({ selectView, selectJob: () => selectStudioTab('job') });
window.addEventListener('pagehide', () => { queue.dispose(); generations.dispose(); }, { once: true });

const restoredWorkspace=Promise.all([studio.ready,browserTabs.ready,remembered.ready]).then(([, ,saved])=>{
  if(!explicitNavigation){studio.restoreViewState(saved);for(const panel of ['job','results','apply'])if(Number.isFinite(saved.positions?.[panel]))studioPositions[panel]=Math.max(0,saved.positions[panel]);selectStudioTab(['job','results','apply'].includes(saved.panel)?saved.panel:'apply');if(saved.chatOpen)selectView('chat');}
  restoringWorkspace=false;rememberWorkspace();
});
for(const id of ['queue-search','queue-filter'])q('#'+id).addEventListener(id==='queue-search'?'input':'change',()=>rememberWorkspace());
let scrollSave;
studioScroll.addEventListener('scroll',()=>{clearTimeout(scrollSave);scrollSave=setTimeout(()=>rememberWorkspace(),120);},{passive:true});
window.addEventListener('pagehide',()=>{clearTimeout(scrollSave);rememberWorkspace();},{once:true});
connectTrackerWorkspace({studio,queue,selectView,selectStudioTab,restoreState:()=>restoredWorkspace});
