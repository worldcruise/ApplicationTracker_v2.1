import { createApplyForm } from '../extension/studio/dock-apply-form.js';
import {createApplyLifecycle} from '../extension/studio/apply-lifecycle.js';
import {createSpeedySubmissionTracker} from '../extension/studio/speedy-submission-tracker.js';
if(!globalThis.__applicationTrackerApplyBridge) {
  globalThis.__applicationTrackerApplyBridge=true;
  const form=createApplyForm(document);
  const emit=async event=>{const reply=await chrome.runtime.sendMessage({type:'ai-apply.lifecycle',event});if(event.runId&&reply?.ok&&reply.value?.watch===false)lifecycle.stop(event.runId);return reply;};
  let lifecycle=createApplyLifecycle(document,{scan:()=>form.scan(),emit});
  let submissionTracker=createSpeedySubmissionTracker(document,{emit});
  chrome.runtime.onMessage.addListener((message,sender,reply)=>{
    if(sender.id!==chrome.runtime.id||sender.tab||sender.url&&sender.url!==chrome.runtime.getURL('service-worker.js')||message?.target!=='dock-apply-form:v1')return false;
    Promise.resolve().then(async()=>{const result=await form.request(message);if(message.action==='bind'&&message.trackingToken)lifecycle.watch({runId:message.runId,token:message.trackingToken});if(['cancel','pause'].includes(message.action))lifecycle.stop(message.runId);return result;}).then(result=>reply({ok:true,result}),error=>reply({ok:false,error:error.message}));
    return true;
  });
  // document_idle may precede tabs.status='complete'. Retry a loading page's
  // announcement so its new form is connected even after the dock is closed.
  const announce=async()=>{for(const wait of [0,100,250,500,1000,2000]){if(wait)await new Promise(resolve=>setTimeout(resolve,wait));try{const reply=await emit({kind:'ready',url:location.href});if(reply?.ok||reply?.code!=='PAGE_LOADING')return;}catch{return;}}};
  void announce();
  window.addEventListener('pagehide',()=>{lifecycle.dispose();submissionTracker.dispose();});
  window.addEventListener('pageshow',event=>{if(event.persisted){lifecycle=createApplyLifecycle(document,{scan:()=>form.scan(),emit});submissionTracker=createSpeedySubmissionTracker(document,{emit});void announce();}});
}
