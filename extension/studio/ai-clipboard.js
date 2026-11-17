let creating;
export async function aiClipboard(operation,text,browser=globalThis.chrome){
  if(operation!=='write')throw Error('Clipboard reads are not supported. Paste the result into Manual retrieval.');
  const url=browser.runtime.getURL('offscreen.html');
  if(!(await browser.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]})).length){
    creating??=browser.offscreen.createDocument({url:'offscreen.html',reasons:['CLIPBOARD','BLOBS'],justification:'Copy text explicitly requested by the user.'}).catch(async error=>{if(!(await browser.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[url]})).length)throw error;}).finally(()=>creating=null);
    await creating;
  }
  const id=crypto.randomUUID(),result=await browser.runtime.sendMessage({target:'ai-manual-clipboard',id,operation:'write',text});
  if(result?.id!==id||!result.ok)throw Error(result?.error||'The AI clipboard could not be accessed. Reload the extension to enable clipboard access.');
  return ''; 
}
