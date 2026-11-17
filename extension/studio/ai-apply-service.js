import {setQueueBackend} from '../ai-apply/src/queue-store.mjs';
import {initializeTemplateWorker} from '../ai-apply/src/service-worker.mjs';
import {configureApplyTools} from './apply-tools-service.js';
import {setStudioPDFBackend} from '../ai-apply/src/studio-pdf.mjs';
import {createDocumentDirectoryWriter} from './document-export-directory.js';

export function configureAIApply({browser,records,dispatch,launch,readResumePrompt,startTemplate=initializeTemplateWorker}) {
  const base=browser.runtime.getURL('ai-apply/index.html');
  const isUI=sender=>sender.id===browser.runtime.id&&(sender.url||'').split(/[?#]/)[0]===base;
  async function authorizeUI(sender) {
    if(!isUI(sender))throw Error('Invalid Apply to Job page.');
    if(!sender.tab||sender.frameId===0)return;
    throw Error('Open Apply to Job in the extension dock.');
  }
  const store=async(action,payload)=>{const service=await records();return service.handle(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload,{});};
  setQueueBackend(store);
  const renderPDF=async payload=>(await records()).handle('AI_APPLY_RENDER_PDF',payload,{});
  setStudioPDFBackend(renderPDF);
  configureApplyTools({browser,isUI,authorizeUI,dispatch,store,readResumePrompt});
  // Page observations are accepted only from our content scripts. The sender's
  // real tab/window/document identity is supplied by Chrome, never by the page.
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='ai-apply.lifecycle'||sender.id!==browser.runtime.id||!Number.isInteger(sender.tab?.id)||!/^https?:\/\//.test(sender.url||''))return false;
    Promise.resolve().then(()=>dispatch('DOCK_APPLY_EVENT',{windowId:sender.tab.windowId,event:message.event},sender)).then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message,code:error.code}));return true;
  });
  browser.tabs.onUpdated?.addListener((tabId,change,tab)=>{
    if(change.status==='complete'&&/^https?:\/\//.test(tab.url||''))void dispatch('DOCK_APPLY_EVENT',{windowId:tab.windowId,event:{kind:'ready',url:tab.url}},{id:browser.runtime.id,url:tab.url,frameId:0,tab:{...tab,id:tabId}}).catch(()=>{});
  });
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(!['ai-apply.store','ai-apply.autofill','ai-apply.pdf'].includes(message?.type)||!isUI(sender))return false;
    (async()=>{
      await authorizeUI(sender);
      if(message.type==='ai-apply.pdf')return renderPDF(message.payload||{});
      if(message.type==='ai-apply.store'){
        if(!['read','commit'].includes(message.action))throw Error('Unknown shared queue action.');
        return store(message.action,message.payload||{});
      }
      if(!['DOCK_APPLY_STATE','DOCK_APPLY_INSPECT','DOCK_APPLY_START','DOCK_APPLY_TRACK','DOCK_APPLY_ACTION'].includes(message.operation))throw Error('Unknown autofill action.');
      const payload={...message.payload,windowId:sender.tab?.windowId??message.payload.windowId};
      return dispatch(message.operation,payload,sender);
    })().then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message,code:error.code,duplicate:error.duplicate}));
    return true;
  });
  const pending=new Map();
  const readPageCommands={
    take(windowId){const value=pending.get(windowId);pending.delete(windowId);return value&&Date.now()-value.createdAt<30000?value:null;},
    async handle(command,tab){
      if(command!=='read-job-page'||!Number.isInteger(tab?.id)||!/^https?:\/\//.test(tab.url||''))return;
      pending.set(tab.windowId,{tabId:tab.id,windowId:tab.windowId,createdAt:Date.now()});
      try{await launch(tab);await browser.runtime.sendMessage({type:'job.read-requested',windowId:tab.windowId}).catch(()=>{});}
      catch(error){console.warn('Job capture could not open:',error.message);}
    }
  };
  startTemplate({isUI,authorizeUI,readPageCommands,readResumePrompt,writeToDirectory:createDocumentDirectoryWriter()});
  return {authorizeUI};
}
