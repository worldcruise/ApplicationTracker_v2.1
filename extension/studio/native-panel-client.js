import {withRequestDeadline} from './request-deadline.js';
import {readDockMeetings} from './dock-meetings-data.js';
import {readMeetingWorkflow,saveMeetingWorkflow} from './meeting-workflow-service.js';

export async function createNativePanelClient(chromeBrowser=chrome){
  const initialWindow=await chromeBrowser.windows.getCurrent();
  async function call(action,envelope){
    const reply=await withRequestDeadline(chromeBrowser.runtime.sendMessage({type:'native-panel:request',action,envelope,windowId:initialWindow.id}));
    if(!reply?.ok)throw Error(reply?.error?.message||'The native side panel could not connect. Reopen it from Chrome’s toolbar.');return reply.result;
  }
  const context=await call('context'),windowId=context.windowId;
  const browser={...chromeBrowser,
    runtime:{getURL:path=>chromeBrowser.runtime.getURL(path),sendMessage:envelope=>call('request',envelope)},
    windows:{getCurrent:async()=>({id:windowId})},
    tabs:{query:options=>chromeBrowser.tabs.query({...options,windowId}),create:options=>chromeBrowser.tabs.create({...options,windowId}),async update(id,options){const tab=await chromeBrowser.tabs.get(id);if(tab.windowId!==windowId)throw Error('Use this browser window.');return chromeBrowser.tabs.update(id,options);}},
    meetings:{read:()=>readDockMeetings(chromeBrowser)},workflow:{read:()=>readMeetingWorkflow(chromeBrowser),mutate:payload=>saveMeetingWorkflow(payload,chromeBrowser)}
  };
  return {browser,context,takeView:()=>call('take-view')};
}
