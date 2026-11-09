import { createApplyForm } from '../extension/studio/dock-apply-form.js';
if(!globalThis.__applicationTrackerApplyBridge) {
  globalThis.__applicationTrackerApplyBridge=true;
  const form=createApplyForm(document);
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||sender.tab||sender.url&&sender.url!==chrome.runtime.getURL('service-worker.js')||message?.target!=='dock-apply-form:v1')return false;
    Promise.resolve().then(()=>form.request(message)).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
    return true;
  });
}
