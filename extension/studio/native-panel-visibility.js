export function createNativePanelVisibility(browser){
  const root=browser.runtime.getURL(''),disabled=new Set(),pending=new Map();
  const owns=tab=>typeof (tab?.pendingUrl||tab?.url)==='string'&&(tab.pendingUrl||tab.url).startsWith(root);
  async function update(tab){
    if(!Number.isInteger(tab?.id))return;
    tab=await browser.tabs.get(tab.id).catch(()=>null);if(!tab)return;
    const own=owns(tab);
    if(!own){
      const persisted=typeof browser.sidePanel.close!=='function'&&browser.sidePanel.getOptions&&(await browser.sidePanel.getOptions({tabId:tab.id})).enabled===false;
      if(disabled.has(tab.id)||persisted){await browser.sidePanel.setOptions({tabId:tab.id,enabled:true});disabled.delete(tab.id);}
      return;
    }
    if(typeof browser.sidePanel.close==='function'){
      if(tab.active&&Number.isInteger(tab.windowId))await browser.sidePanel.close({windowId:tab.windowId});
    }else{
      // Chrome 116–140 has no close(). Disabling this tab hides the dock
      // without changing another browser window's panel.
      await browser.sidePanel.setOptions({tabId:tab.id,enabled:false});disabled.add(tab.id);
    }
  }
  function sync(tab){
    const previous=pending.get(tab?.id)||Promise.resolve();
    const task=previous.catch(()=>{}).then(()=>update(tab));pending.set(tab?.id,task);
    task.finally(()=>{if(pending.get(tab?.id)===task)pending.delete(tab?.id);}).catch(()=>{});return task;
  }
  const report=error=>console.warn('Side panel visibility could not update:',error.message);
  browser.tabs.onActivated?.addListener(({tabId})=>{void browser.tabs.get(tabId).then(sync).catch(report);});
  browser.tabs.onUpdated?.addListener((tabId,changes,tab)=>{if(changes.url||changes.status==='complete')void sync({...tab,id:tabId}).catch(report);});
  browser.tabs.onRemoved?.addListener(tabId=>{disabled.delete(tabId);pending.delete(tabId);});
  return {owns,sync,async initialize(){const tabs=await browser.tabs.query({});await Promise.allSettled(tabs.filter(owns).map(sync));}};
}
