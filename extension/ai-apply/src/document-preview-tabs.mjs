const opening = new WeakMap();
// Reuse one extension-owned preview per document kind and format. Every file
// still downloads; a batch does not leave a new PDF renderer behind per job.
export function openDocumentPreview(browser, item) {
  const slot=`${item.kind}:${item.format}`,pdf=item.format==='pdf',base=browser.runtime.getURL(pdf?'preview.html':'ai-apply/document-preview.html'),baseUrl=new URL(base),legacyUrl=new URL(browser.runtime.getURL('ai-apply/document-preview.html'));
  let slots=opening.get(browser);if(!slots){slots=new Map();opening.set(browser,slots);}
  const previous=slots.get(slot)||Promise.resolve();
  const task=previous.catch(()=>{}).then(async()=>{
    const url=base+(pdf?'?aiFile=':'?file=')+encodeURIComponent(item.key)+'&slot='+encodeURIComponent(slot);
    const tabs=browser.tabs.query ? await browser.tabs.query({}) : [];
    const existing=tabs.find(tab=>{
      if(tab.pinned)return false;
      try{const current=new URL(tab.pendingUrl||tab.url);return current.protocol===baseUrl.protocol&&current.host===baseUrl.host&&[baseUrl.pathname,legacyUrl.pathname].includes(current.pathname)&&(current.searchParams.get('slot')===slot||current.searchParams.get('file')?.endsWith('/'+item.kind+'.'+item.format));}catch{return false;}
    });
    if(existing && browser.tabs.update)return browser.tabs.update(existing.id,{url,active:true});
    return browser.tabs.create({url,active:true});
  });
  slots.set(slot,task);return task.finally(()=>{if(slots.get(slot)===task)slots.delete(slot);});
}
