const PREFIX='inline-dock:v1:';
const website=url=>/^https?:\/\//i.test(url||'');
function inlinePage(url){
  if(!website(url))return false;
  try{const page=new URL(url);return page.hostname!=='chromewebstore.google.com'&&!(page.hostname==='chrome.google.com'&&page.pathname.startsWith('/webstore'));}catch{return false;}
}
const failure=message=>{throw Error(message);};

export function configureInlineDock({browser,storage,dispatch,operations}) {
  const grantKey=id=>`${PREFIX}${id}`;
  const configure=()=>browser.sidePanel.setPanelBehavior({openPanelOnActionClick:false});
  configure().catch(console.error);
  browser.runtime.onInstalled.addListener(()=>configure().catch(console.error));
  browser.runtime.onStartup.addListener(()=>configure().catch(console.error));

  const dashboardOpenings=new Map();
  function openWebDashboard(tab){
    const windowId=tab.windowId;
    if(dashboardOpenings.has(windowId))return dashboardOpenings.get(windowId);
    const opening=(async()=>{
      const base=browser.runtime.getURL('options.html'),url=base+'#/dashboard';
      const tabs=await browser.tabs.query({windowId}),existing=tabs.find(item=>(item.url||'').split('#')[0]===base);
      if(existing)return browser.tabs.update(existing.id,{url,active:true});
      return browser.tabs.create({windowId,url,active:true});
    })().finally(()=>dashboardOpenings.delete(windowId));
    dashboardOpenings.set(windowId,opening);return opening;
  }

  const launches=new Map();
  function launch(tab,force=true){
    const active=launches.get(tab.id);
    if(active){
      if(force&&!active.force)return active.promise.then(()=>launch(tab,true));
      return active.promise;
    }
    const entry={force};
    entry.promise=inject(tab,force).finally(()=>{if(launches.get(tab.id)===entry)launches.delete(tab.id);});
    launches.set(tab.id,entry);return entry.promise;
  }
  async function inject(tab,force){
    if(!Number.isSafeInteger(tab.id)||!inlinePage(tab.url))throw Error('Open a regular website to use the dock.');
    const key=grantKey(tab.id),previous=(await browser.storage.session.get(key))[key];
    if(!force&&!previous)return;
    // The document ID still scopes authorization; retaining this tab's token
    // avoids invalidating a dock that is finishing startup on another click.
    const token=previous?.token||crypto.randomUUID(),collapsed=force?false:!!previous?.collapsed;
    const [result]=await browser.scripting.executeScript({target:{tabId:tab.id},world:'ISOLATED',func:config=>{globalThis.__applicationTrackerInlineConfig=config;},args:[{token,collapsed,windowId:tab.windowId}]});
    if(!result?.documentId)throw Error('The webpage changed. Click the extension again.');
    await browser.storage.session.set({[key]:{token,documentId:result.documentId,collapsed}});
    await browser.scripting.executeScript({target:{tabId:tab.id,documentIds:[result.documentId]},world:'ISOLATED',files:['content-scripts/inline-dock.js']});
  }
  browser.action.onClicked.addListener(tab=>{
    if(!inlinePage(tab.url)){void openWebDashboard(tab).catch(console.error);return;}
    void launch(tab).catch(error=>{
      console.warn('Dock unavailable:',error.message);
      // Opening a web tab does not require the original click's user gesture.
      void browser.storage.session.remove(grantKey(tab.id)).catch(()=>{});
      void openWebDashboard(tab).catch(console.error);
    });
  });
  browser.tabs.onUpdated.addListener((id,change,tab)=>{if(change.status==='complete'&&inlinePage(tab.url))void launch(tab,false).catch(()=>{});});
  browser.tabs.onAttached?.addListener(id=>{void browser.tabs.get(id).then(tab=>launch(tab,false)).catch(()=>{});});
  browser.tabs.onRemoved.addListener(id=>{void browser.storage.session.remove(grantKey(id));});

  async function authorize(message,sender){
    if(sender.id!==browser.runtime.id||sender.frameId!==0||!sender.documentId||!Number.isSafeInteger(sender.tab?.id)||!website(sender.url))failure('Invalid dock document.');
    const grant=(await browser.storage.session.get(grantKey(sender.tab.id)))[grantKey(sender.tab.id)];
    if(!grant||grant.documentId!==sender.documentId||grant.token!==message.token)failure('Reopen the dock on this page.');
    return grant;
  }
  const tabSummary=tab=>({id:tab.id,windowId:tab.windowId,url:tab.url,title:tab.title,active:tab.active,lastAccessed:tab.lastAccessed});
  function safeDestination(url){
    if(typeof url!=='string'||!website(url)&&!url.startsWith(browser.runtime.getURL('options.html')+'#'))failure('Invalid dock destination.');
    return url;
  }
  async function handle(message,sender){
    const grant=await authorize(message,sender),windowId=sender.tab.windowId,tabId=sender.tab.id;
    const {action,payload={}}=message;
    if(action==='request'){
      const envelope=payload;
      if(envelope.version!==1||!operations.has(envelope.operation)||typeof envelope.requestId!=='string'||envelope.requestId.length>128||!envelope.payload||typeof envelope.payload!=='object'||Array.isArray(envelope.payload))failure('Invalid dock request.');
      if(envelope.payload.windowId!==undefined&&envelope.payload.windowId!==windowId)failure('Use this browser window.');
      return {version:1,requestId:envelope.requestId,ok:true,result:await dispatch(envelope.operation,envelope.payload,sender,envelope)};
    }
    if(action==='context')return {windowId,tabId};
    if(action==='collapse'){
      await browser.storage.session.set({[grantKey(tabId)]:{...grant,collapsed:payload.collapsed===true}});return {};
    }
    if(action==='local-read')return browser.storage.local.get(['appliedList','ui-theme:v1']);
    if(action==='session-read'){
      const key=payload.key;
      if(key===null){const saved=await browser.storage.session.get(null);return Object.fromEntries(Object.entries(saved).filter(([name])=>name.startsWith('pdf-export:')));}
      if(key!==`dock-records-ui:v1:${windowId}:${tabId}`)failure('Invalid dock storage key.');
      return browser.storage.session.get(key);
    }
    if(action==='session-write'){
      const key=`dock-records-ui:v1:${windowId}:${tabId}`;
      if(payload.key!==key)failure('Invalid dock storage key.');
      await browser.storage.session.set({[key]:payload.value});return {};
    }
    if(action==='private-read'||action==='private-write'){
      const key=`dock-apply-ui:v1:${windowId}:${tabId}`;
      if(payload.key!==key)failure('Invalid dock storage key.');
      if(action==='private-read')return storage.get(key);
      await storage.set({[key]:payload.value});return {};
    }
    if(action==='tabs-query')return (await browser.tabs.query({windowId})).map(tabSummary);
    if(action==='tabs-create')return tabSummary(await browser.tabs.create({windowId,url:safeDestination(payload.url),active:true}));
    if(action==='tabs-update'){
      const target=await browser.tabs.get(payload.id);if(target.windowId!==windowId)failure('Use this browser window.');
      return tabSummary(await browser.tabs.update(target.id,{active:true,...(payload.url?{url:safeDestination(payload.url)}:{})}));
    }
    if(action==='open-cv'){
      if(typeof payload.id!=='string'||payload.id.length>200)failure('Invalid queue record.');
      return tabSummary(await browser.tabs.create({windowId,url:browser.runtime.getURL('dashboard.html')+'#'+new URLSearchParams({cv:payload.id,letter:payload.letter?'1':'0'}),active:true}));
    }
    failure('Unknown dock action.');
  }
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='inline-dock:request')return false;
    handle(message,sender).then(result=>respond({ok:true,result}),error=>respond({ok:false,error:{message:error.message}}));return true;
  });
  storage.onChanged.addListener(changes=>{
    // Send invalidation keys only; private values stay in the extension.
    const keys=Object.keys(changes).filter(key=>key==='dock-job-records:v1'||key.startsWith('dock-apply-run:v1:'));
    if(!keys.length)return;
    void browser.storage.session.get(null).then(saved=>Promise.all(Object.entries(saved).filter(([key])=>key.startsWith(PREFIX)).map(([key,grant])=>browser.tabs.sendMessage(Number(key.slice(PREFIX.length)),{type:'inline-dock:changed',keys},{documentId:grant.documentId}).catch(()=>{})))).catch(()=>{});
  });
  return {launch,handle};
}
