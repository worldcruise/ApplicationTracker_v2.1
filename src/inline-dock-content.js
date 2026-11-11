import {mountDockDashboard} from '../extension/studio/dock-dashboard-view.js';
import {createInlineDockClient} from '../extension/studio/inline-dock-client.js';
import {reserveDockSpace} from '../extension/studio/inline-dock-layout.js';
import theme from '../extension/studio/theme.css';
import dashboard from '../extension/dashboard.css';
import records from '../extension/job-records.css';
import apply from '../extension/apply-dock.css';

const SLOT='__applicationTrackerInlineDock';
const DISPOSE='application-tracker:dispose-dock';
async function start(){
  if(window.top!==window.self)return;
  if(globalThis[SLOT]){
    const current=globalThis[SLOT],config=globalThis.__applicationTrackerInlineConfig;
    if(current.windowId!==undefined&&current.windowId!==config?.windowId)current.close();
    else {current.show(!config?.collapsed);return;}
  }
  // Own the slot throughout startup; cleanup from an older dock cannot clear it.
  let ready,closed=false;const cleanup=[];
  const instance={windowId:globalThis.__applicationTrackerInlineConfig?.windowId,
    show:open=>{void ready.then(api=>{if(!closed)api.show(open);}).catch(()=>{});},
    close(){
      if(closed)return;closed=true;
      for(const dispose of cleanup.splice(0).reverse()){try{dispose();}catch{ /* A reloaded extension may have invalidated Chrome listeners. */ }}
      if(globalThis[SLOT]===instance)delete globalThis[SLOT];
    }};
  globalThis[SLOT]=instance;
  ready=(async()=>{
    const client=await createInlineDockClient();
    if(closed){client.close();return;}
    cleanup.push(()=>client.close());
    for(const previous of document.querySelectorAll('application-tracker-dock')){
      if(previous.dataset.extensionId&&previous.dataset.extensionId!==chrome.runtime.id)continue;
      previous.dispatchEvent(new Event(DISPOSE));
      // Versions without the disposal listener restore removed hosts. Retire them
      // in place so they cannot reappear over the new dock.
      if(previous.isConnected){previous.style.setProperty('display','none','important');previous.removeAttribute('id');}
    }
    const host=document.createElement('application-tracker-dock');host.id='application-tracker-inline-dock';
    host.dataset.extensionId=chrome.runtime.id;
    host.addEventListener(DISPOSE,instance.close,{once:true});cleanup.push(()=>host.remove());
    host.style.cssText='all:initial!important;display:block!important;position:relative!important;z-index:2147483647!important;width:0!important;height:0!important;';
    const shadow=host.attachShadow({mode:'closed'}),styles=document.createElement('style');
    const scopedCSS=[theme,dashboard,records,apply].join('\n').replace(/:root\[data-theme="([^"]+)"\]/g,':host([data-theme="$1"])').replaceAll(':root',':host').replaceAll('html[data-theme','[data-inline-theme').replaceAll('body.reference-dashboard','.inline-body').replace(/\bbody\s*\{/g,'.inline-body {');
    styles.textContent=scopedCSS+`
      :host{all:initial;font-family:Inter,system-ui,sans-serif;color-scheme:light;}
      .inline-panel{position:fixed;top:0;right:0;bottom:0;width:min(384px,100vw);padding:0;margin:0;border:0;border-radius:0;overflow:auto;overscroll-behavior:contain;background:var(--reference-dashboard-bg);box-shadow:-1px 0 0 #0001,-6px 0 24px #0001;}
      .inline-panel[hidden],.inline-launcher[hidden]{display:none!important;}
      [data-inline-theme] #at-reference-dock{--dock-gutter:13px;padding:0;min-height:100%;}
      [data-inline-theme] #at-reference-dock .rd-dock{width:100%;max-width:none;min-height:100dvh;margin:0;border:0;border-radius:0;}
      [data-inline-theme] #at-reference-dock .rd-header{flex-wrap:nowrap;gap:8px;}
      [data-inline-theme] #at-reference-dock .rd-person{margin-left:auto;}
      [data-inline-theme] #at-reference-dock .rd-logo svg{width:21px;height:21px;}
      [data-inline-theme] #at-reference-dock :is(.rd-header,.rd-main){padding-left:var(--dock-gutter);padding-right:var(--dock-gutter);}
      #at-reference-dock #job-records-design :is(.jr-header,.jr-toolbar,.jr-candidate-note){padding-left:var(--dock-gutter);padding-right:var(--dock-gutter);}
      #at-reference-dock #job-records-design :is(.jr-tabs,.jr-add-form){margin:0;}
      #at-reference-dock #apply-ready-queue-design{padding-left:0;padding-right:0;}
      #at-reference-dock #apply-ready-queue-design .aj-navigation{max-width:none;margin:0;}
      #at-reference-dock #apply-ready-queue-design .aj-window{max-width:none;border:0;border-radius:0;}
      #at-reference-dock #apply-ready-queue-design .aj-body{padding:0;}
      #at-reference-dock #apply-ready-queue-design .aj-steps{margin:0;}
      #at-reference-dock :is(.inline-collapse,.inline-settings){display:grid;place-items:center;box-sizing:border-box;width:28px;height:28px;padding:0;border:0;border-radius:6px;background:transparent;flex-shrink:0;}
      #at-reference-dock .inline-collapse svg{width:26px;height:26px;}
      #at-reference-dock .inline-settings svg{width:19px;height:19px;}
      #at-reference-dock :is(.inline-collapse,.inline-settings):hover{background:var(--rd-soft);}
      .inline-launcher{position:fixed;right:0;top:120px;display:flex;align-items:center;gap:4px;height:56px;padding:8px 6px 8px 12px;border:1px solid #dcd0ed;border-right:0;border-radius:32px 0 0 32px;background:#fff;color:#7958c8;box-shadow:0 3px 20px #0002;transform:translateX(12px);transition:transform .3s;cursor:pointer;touch-action:none;user-select:none;}
      .inline-launcher:hover,.inline-launcher:focus-visible{transform:translateX(0);}
      .inline-launcher img{width:32px;height:32px;transform:scale(1.25);pointer-events:none;}.inline-grip{font-size:20px;line-height:1;padding:4px;cursor:ns-resize;}
      .inline-launcher:focus-visible{outline:2px solid #7958c8;outline-offset:2px;}
      @media(prefers-reduced-motion:reduce){.inline-launcher{transition:none;}}
    `;
    const panel=document.createElement('aside');panel.className='inline-panel inline-body';panel.setAttribute('aria-label','Application Tracker dock');
    const content=document.createElement('div');panel.append(content);
    const launcher=document.createElement('button');launcher.type='button';launcher.className='inline-launcher';launcher.title='Open Application Tracker';launcher.setAttribute('aria-label','Open Application Tracker dock');
    const image=document.createElement('img');image.src=chrome.runtime.getURL('icons/icon-128.png');image.alt='';
    const grip=document.createElement('span');grip.className='inline-grip';grip.textContent='⋮';grip.setAttribute('aria-hidden','true');launcher.append(image,grip);
    shadow.append(styles,panel,launcher);document.documentElement.append(host);
    const layout=reserveDockSpace(document,host);
    cleanup.push(()=>layout.close());
    function show(open){panel.hidden=!open;launcher.hidden=open;layout.setOpen(open);void client.call('collapse',{collapsed:!open}).catch(console.warn);if(open)collapse.focus();else launcher.focus();}
    const dock=mountDockDashboard(content,{browser:client.browser,privateStorage:client.privateStorage,showProfileSelector:false,onResumeInput:(record,options)=>client.call('open-cv',{id:record.id,...options})});
    cleanup.push(()=>dock.close());
    const settings=document.createElement('button');settings.type='button';settings.className='inline-settings';settings.dataset.action='Settings';settings.title='Open Settings';settings.setAttribute('aria-label','Open Settings');settings.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.5 3h5l.6 2.2 1.6.9 2.2-.6 2.5 4.3-1.6 1.6v1.8l1.6 1.6-2.5 4.3-2.2-.6-1.6.9-.6 2.2h-5l-.6-2.2-1.6-.9-2.2.6-2.5-4.3 1.6-1.6v-1.8L2.6 9.8l2.5-4.3 2.2.6 1.6-.9Z"/><circle cx="12" cy="12" r="3"/></svg>';dock.root.querySelector('.rd-header').append(settings);
    const collapse=document.createElement('button');collapse.type='button';collapse.className='inline-collapse';collapse.innerHTML='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';collapse.title='Collapse dock';collapse.setAttribute('aria-label','Collapse dock');collapse.addEventListener('click',()=>show(false));dock.root.querySelector('.rd-header').append(collapse);
    let drag=null,moved=false;
    launcher.addEventListener('pointerdown',event=>{if(event.button!==0||event.target!==grip)return;drag={y:event.clientY,top:launcher.getBoundingClientRect().top};moved=false;launcher.setPointerCapture(event.pointerId);event.preventDefault();});
    launcher.addEventListener('pointermove',event=>{if(!drag)return;const delta=event.clientY-drag.y;if(Math.abs(delta)>3)moved=true;launcher.style.top=`${Math.max(0,Math.min(window.innerHeight-56,drag.top+delta))}px`;});
    launcher.addEventListener('pointerup',()=>{drag=null;});launcher.addEventListener('pointercancel',()=>{drag=null;});
    launcher.addEventListener('click',()=>{if(moved){moved=false;return;}show(true);});
    const setTheme=value=>{const next=value==='dark'?'dark':'light';host.dataset.theme=next;panel.dataset.inlineTheme=next;};
    const themeChanged=(changes,area)=>{if(area==='local'&&changes['ui-theme:v1'])setTheme(changes['ui-theme:v1'].newValue);};
    chrome.storage.onChanged.addListener(themeChanged);
    cleanup.push(()=>chrome.storage.onChanged.removeListener(themeChanged));
    try{setTheme((await chrome.storage.local.get('ui-theme:v1'))['ui-theme:v1']);}catch{setTheme('light');}
    if(closed)return;
    const restore=new MutationObserver(()=>{if(!host.isConnected)document.documentElement.append(host);});restore.observe(document.documentElement,{childList:true});
    cleanup.push(()=>restore.disconnect());
    Object.assign(instance,{show,windowId:client.context.windowId});
    show(!globalThis.__applicationTrackerInlineConfig?.collapsed);
    window.addEventListener('pagehide',instance.close,{once:true});cleanup.push(()=>window.removeEventListener('pagehide',instance.close));return instance;
  })();
  try{await ready;}catch(error){instance.close();throw error;}
}
void start().catch(error=>console.error('Application Tracker dock:',error));
