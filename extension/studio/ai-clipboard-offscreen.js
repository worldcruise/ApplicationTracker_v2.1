export function registerAIClipboard(browser=globalThis.chrome){
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.target!=='ai-manual-clipboard'||sender.id!==browser.runtime.id||sender.tab||sender.url&&sender.url!==browser.runtime.getURL('service-worker.js')||message.operation!=='write')return false;
    const field=document.createElement('textarea');field.style.cssText='position:fixed;left:0;top:0;width:1px;height:1px;opacity:0';document.body.append(field);
    try{
      if(typeof message.text!=='string'||message.text.length>2000000)throw Error('The copied prompt is too large.');field.value=message.text;
      field.focus();field.select();
      if(!document.execCommand('copy'))throw Error('Copy failed. Reload the extension and try again.');
      respond({id:message.id,ok:true});
    }catch(error){respond({id:message.id,ok:false,error:error.message});}finally{field.value='';field.remove();}return false;
  });
}
