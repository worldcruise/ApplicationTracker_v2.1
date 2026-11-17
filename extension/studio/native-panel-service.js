import {DASHBOARD_OPERATIONS} from './reference-dashboard-access.js';
import {createNativePanelVisibility} from './native-panel-visibility.js';

export function configureNativePanel({browser,dispatch,operations=DASHBOARD_OPERATIONS}){
  const visibility=createNativePanelVisibility(browser);
  const path='sidepanel.html',base=browser.runtime.getURL(path),pending=new Map(),opening=new Map(),owners=new Map();
  const configure=()=>Promise.all([browser.sidePanel.setOptions({path,enabled:true}),browser.sidePanel.setPanelBehavior({openPanelOnActionClick:false})]).then(()=>visibility.initialize());
  void configure().catch(console.error);
  browser.runtime.onInstalled.addListener(()=>{void configure().catch(console.error);});
  browser.runtime.onStartup.addListener(()=>{void configure().catch(console.error);});
  function launch(tab,{view}={}){
    const windowId=tab?.windowId;
    if(!Number.isSafeInteger(windowId)||windowId<0)return Promise.reject(Error('Open Application Tracker in a browser window.'));
    if(visibility.owns(tab))return visibility.sync({...tab,active:true}).then(()=>openDashboard(tab));
    if(view)pending.set(windowId,view);
    // Invoke immediately inside the click/shortcut gesture, before any await.
    let task=opening.get(windowId);
    if(!task){try{task=browser.sidePanel.open({windowId});}catch(error){task=Promise.reject(error);}task=Promise.resolve(task).finally(()=>opening.delete(windowId));opening.set(windowId,task);}
    return task.then(()=>{
      void browser.runtime.sendMessage({type:'native-panel:show',windowId}).catch(()=>{});
    });
  }
  browser.action.onClicked.addListener(tab=>{void launch(tab).catch(error=>{console.warn('Side panel could not open:',error.message);void openDashboard(tab).catch(console.error);});});
  async function openDashboard(tab){
    const root=browser.runtime.getURL('options.html'),url=root+'#/dashboard',tabs=await browser.tabs.query({windowId:tab.windowId}),existing=tabs.find(item=>(item.url||'').split('#')[0]===root);
    return existing?browser.tabs.update(existing.id,{url,active:true}):browser.tabs.create({windowId:tab.windowId,url,active:true});
  }
  async function context(sender,requestedWindowId){
    if(sender.id!==browser.runtime.id||(sender.url||'').split(/[?#]/)[0]!==base||sender.tab||sender.frameId>0)throw Error('Invalid native side panel.');
    // Browser-hosted pages omit documentId/frameId in MessageSender. The page
    // is packaged, is not web accessible, and must have a live SIDE_PANEL context.
    const contexts=await browser.runtime.getContexts({contextTypes:['SIDE_PANEL'],...(sender.documentId?{documentIds:[sender.documentId]}:{documentUrls:[sender.url]})});
    const owner=contexts.find(item=>item.contextType==='SIDE_PANEL'&&(sender.documentId?item.documentId===sender.documentId:item.documentUrl===sender.url));
    if(!owner)throw Error('Open the extension from Chrome’s toolbar to connect the side panel.');
    // Chrome currently reports windowId -1 for SIDE_PANEL contexts. Its own
    // windows.getCurrent() supplies the associated window to this trusted UI.
    const windowId=owner.windowId>=0?owner.windowId:(sender.documentId?owners.get(sender.documentId):undefined)??requestedWindowId;
    if(!Number.isSafeInteger(windowId)||windowId<0)throw Error('The side panel window is unavailable. Reopen the panel.');
    const window=await browser.windows.get(windowId);if(window.type!=='normal')throw Error('Open the side panel in a normal browser window.');
    if(sender.documentId)owners.set(sender.documentId,windowId);if(owners.size>128)owners.delete(owners.keys().next().value);
    return {windowId};
  }
  async function handle(message,sender){
    const owner=await context(sender,message.windowId);
    if(message.action==='context')return owner;
    if(message.action==='take-view'){const view=pending.get(owner.windowId)||null;pending.delete(owner.windowId);return{view};}
    if(message.action!=='request')throw Error('Unknown side panel request.');
    const envelope=message.envelope;
    if(envelope?.version!==1||!operations.has(envelope.operation)||typeof envelope.requestId!=='string'||!envelope.requestId||envelope.requestId.length>128||!envelope.payload||typeof envelope.payload!=='object'||Array.isArray(envelope.payload))throw Error('Invalid side panel request.');
    if(envelope.payload.windowId!==undefined&&envelope.payload.windowId!==owner.windowId)throw Error('Use this browser window.');
    const payload={...envelope.payload,...envelope.operation.startsWith('DOCK_APPLY_')?{windowId:owner.windowId}:{}};
    return{version:1,requestId:envelope.requestId,ok:true,result:await dispatch(envelope.operation,payload,sender,envelope)};
  }
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='native-panel:request')return false;
    handle(message,sender).then(result=>respond({ok:true,result}),error=>respond({ok:false,error:{message:error.message}}));return true;
  });
  return {launch,handle,context};
}
