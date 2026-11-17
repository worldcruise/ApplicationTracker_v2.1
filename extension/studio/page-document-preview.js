// Serialized into the employer tab by chrome.scripting. Keep this function
// self-contained; the PDF stays inside an extension-owned iframe.
export function installDocumentPreviewOverlay(url,title,token,expectedUrl) {
  if(location.href!==expectedUrl)throw Error('The webpage changed. Open the document preview again.');
  globalThis.__trackerDocumentPreviewClose?.();
  const previous=document.activeElement,host=document.createElement('div');host.id='application-tracker-document-preview';
  host.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
  const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
  style.textContent=':host{all:initial}dialog{position:fixed;inset:0;box-sizing:border-box;margin:auto;padding:0;width:min(1100px,calc(100vw - 32px));height:min(960px,calc(100dvh - 32px));max-width:none;max-height:none;border:1px solid #dcd9ef;border-radius:14px;background:#fff;color:#202331;box-shadow:0 24px 90px #0005;font:14px/1.4 system-ui,sans-serif;overflow:hidden}dialog[open]{display:flex;flex-direction:column}dialog::backdrop{background:#10102588}header{display:flex;align-items:center;gap:16px;flex:none;min-height:52px;padding:0 16px;background:#f0edfc;border-bottom:1px solid #dcd9ef}h2{flex:1;min-width:0;margin:0;font:600 15px/1.4 system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}button{display:grid;place-items:center;width:32px;height:32px;flex:none;border:1px solid #d5d0ed;border-radius:8px;background:#fff;color:#6550ce;font:24px/1 system-ui,sans-serif;cursor:pointer}button:focus-visible{outline:2px solid #6550ce;outline-offset:2px}iframe{display:block;flex:1;width:100%;min-height:0;border:0;background:#282828}@media(max-width:600px){dialog{width:calc(100vw - 12px);height:calc(100dvh - 12px);border-radius:10px}header{padding:0 10px}}';
  const dialog=document.createElement('dialog'),heading=document.createElement('header'),label=document.createElement('h2'),button=document.createElement('button'),frame=document.createElement('iframe');
  label.id='tracker-document-title-'+token;label.textContent=title;dialog.setAttribute('aria-labelledby',label.id);
  button.type='button';button.textContent='\u00d7';button.setAttribute('aria-label','Close document preview');
  frame.src=url;frame.title=title;heading.append(label,button);dialog.append(heading,frame);shadow.append(style,dialog);
  let closed=false;
  const close=()=>{if(closed)return;closed=true;if(dialog.open)dialog.close();host.remove();document.removeEventListener('keydown',escape,true);window.removeEventListener('message',message);if(globalThis.__trackerDocumentPreviewClose===close)delete globalThis.__trackerDocumentPreviewClose;if(previous?.isConnected)previous.focus({preventScroll:true});};
  const escape=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  const message=event=>{if(event.source===frame.contentWindow&&event.origin===new URL(url).origin&&event.data?.type==='tracker.document-preview.close'&&event.data.token===token)close();};
  button.addEventListener('click',close);dialog.addEventListener('close',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)close();});
  document.documentElement.append(host);document.addEventListener('keydown',escape,true);window.addEventListener('message',message);globalThis.__trackerDocumentPreviewClose=close;
  try{dialog.showModal();button.focus({preventScroll:true});}catch(error){close();throw error;}
}
