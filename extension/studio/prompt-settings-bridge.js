import {isPromptSettingsSender,PROMPT_SETTINGS_OPERATIONS} from './settings-access.js';
import {isWorkspaceRecordsSender} from './reference-dashboard-access.js';
import {isProfileSettingsSender,PROFILE_OPERATIONS} from './single-profile-service.js';

// Chrome can retain the document's initial URL in MessageSender after an SPA
// hash change. Resolve the current route through Chrome, never from the hint.
export function configurePromptSettingsBridge({browser,dispatch}){
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    const prompt=['#/settings/prompts','#/settings/ai/prompt','#/settings/ai/candidate'].includes(message?.settingsRoute)&&PROMPT_SETTINGS_OPERATIONS.has(message?.operation);
    const profile=['#/settings/profile','#/settings/profile/new'].includes(message?.settingsRoute)&&PROFILE_OPERATIONS.has(message?.operation);
    const authorized=prompt?isPromptSettingsSender:profile?isProfileSettingsSender:null;
    if(!authorized||authorized(sender,browser)||!isWorkspaceRecordsSender(sender,browser)||!Number.isInteger(sender.tab?.id))return false;
    if(message.version!==1||typeof message.requestId!=='string'||!message.requestId||message.requestId.length>128||!message.payload||typeof message.payload!=='object'||Array.isArray(message.payload))return false;
    (async()=>{
      const tab=await browser.tabs.get(sender.tab.id),current={...sender,url:tab.url};
      if(!authorized(current,browser))throw Error('Open the requested Settings page and try again.');
      return dispatch(message.operation,message.payload,current,message);
    })().then(result=>respond({version:1,requestId:message.requestId,ok:true,result}),error=>respond({version:1,requestId:message.requestId,ok:false,error:{code:error.code||'INVALID_REQUEST',message:error.message}}));
    return true;
  });
}
