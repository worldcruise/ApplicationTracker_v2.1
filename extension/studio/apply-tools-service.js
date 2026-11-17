import {linkedConversationUrl} from '../ai-apply/src/sidebar-protocol.mjs';
import {createQuestionAnswerChat,answerBatchPrompt} from './question-answer-chat.js';
import {savedPDFPreview} from '../ai-apply/src/saved-pdf-preview.mjs';
import {exportDocuments} from '../ai-apply/src/document-export.mjs';
import {installDocumentPreviewOverlay} from './page-document-preview.js';

export function questionDraftPrompt(job,fields) {
  return answerBatchPrompt(job,fields,crypto.randomUUID()).prompt;
}

// This overlay is installed in the employer tab, separate from the native dock.
export function installProfileOverlay(url,token) {
  globalThis.__trackerProfileOverlayClose?.();
  const previous=document.activeElement,host=document.createElement('div');host.id='application-tracker-profile';
  host.style.cssText='position:fixed!important;inset:0!important;z-index:2147483647!important;display:block!important;';
  const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
  style.textContent=':host{all:initial}.backdrop{position:absolute;inset:0;background:#10102566;display:grid;place-items:center;padding:24px;box-sizing:border-box}iframe{width:min(960px,100%);height:min(820px,94vh);border:0;border-radius:16px;background:white;box-shadow:0 24px 90px #0005}';
  const backdrop=document.createElement('div');backdrop.className='backdrop';
  const frame=document.createElement('iframe');frame.src=url;frame.title='Application autofill profile settings';backdrop.append(frame);shadow.append(style,backdrop);document.documentElement.append(host);
  const close=()=>{host.remove();window.removeEventListener('message',message);document.removeEventListener('keydown',escape,true);if(previous?.isConnected)previous.focus({preventScroll:true});delete globalThis.__trackerProfileOverlayClose;};
  const message=event=>{if(event.source===frame.contentWindow&&event.origin===new URL(url).origin&&event.data?.type==='tracker.profile.close'&&event.data.token===token)close();};
  const escape=event=>{if(event.key==='Escape'){event.stopPropagation();close();}};
  backdrop.addEventListener('click',event=>{if(event.target===backdrop)close();});window.addEventListener('message',message);document.addEventListener('keydown',escape,true);globalThis.__trackerProfileOverlayClose=close;frame.focus();
}

export function stageQuestionDraft(prompt) {
  const input=document.querySelector('#prompt-textarea,textarea[data-id="root"],textarea[placeholder*="Message"]');
  if(!input)return {ready:false};
  const current=(input.value??input.innerText??input.textContent??'').trim();
  if(current&&current!==prompt.trim())return {ready:true,blocked:true};
  if(!current){
    input.focus();
    if(input.tagName==='TEXTAREA')Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input,prompt);
    else {input.replaceChildren();for(const line of prompt.split('\n')){const p=document.createElement('p');p.textContent=line||'\u00a0';input.append(p);}}
    input.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:prompt}));
  }
  return {ready:true,staged:true};
}

export function configureApplyTools({browser,isUI,authorizeUI,dispatch,store,readResumePrompt,previewPDF=savedPDFPreview}) {
  const answerChat=createQuestionAnswerChat(browser,{readPromptValues:async job=>(await readResumePrompt?.(job))?.values||job.input.promptValues||{}});
  const profileBase=browser.runtime.getURL('ai-apply/profile.html'),grantKey=tabId=>`apply-profile-overlay:v1:${tabId}`;
  const isProfile=sender=>sender.id===browser.runtime.id&&(sender.url||'').split('?')[0]===profileBase;
  async function profileGrant(sender){
    const token=new URL(sender.url).searchParams.get('token'),grant=(await browser.storage.session.get(grantKey(sender.tab?.id)))[grantKey(sender.tab?.id)];
    if(!token||!grant||grant.token!==token||grant.windowId!==sender.tab?.windowId||grant.expiresAt<Date.now())throw Error('Reopen profile settings from Application autofill.');
    const tab=await browser.tabs.get(sender.tab.id);if(tab.url!==grant.url)throw Error('The employer page changed. Reopen profile settings.');return grant;
  }
  async function openChat(payload,sender){
    const state=await store('read');let job=state.requests.find(item=>item.id===payload.jobId);if(!job)throw Error('Select a saved job.');
    if(payload.action==='chat.draft'){
      const current=await dispatch('DOCK_APPLY_PROFILE',{windowId:payload.windowId,action:'PROFILE_STATE'},sender);
      const instructions=(current.candidate?.document?.customPromptInstructions||[]).map(item=>[item.title,item.text].filter(value=>typeof value==='string'&&value.trim()).join('\n')).filter(Boolean).join('\n\n');
      return answerChat.start({...job,input:{...job.input,autofillInstructions:instructions}},payload.fields,payload.windowId,payload.conversationUrl||job.manualChatUrl||job.sourceChatUrl);
    }
    const url=linkedConversationUrl(payload.conversationUrl)||linkedConversationUrl(job.manualChatUrl)||linkedConversationUrl(job.sourceChatUrl)||'https://chatgpt.com/';
    const tabs=await browser.tabs.query({windowId:payload.windowId}),existing=tabs.find(tab=>tab.url===url);
    const tab=existing?await browser.tabs.update(existing.id,{active:true}):await browser.tabs.create({windowId:payload.windowId,url,active:true});
    await browser.windows.update?.(tab.windowId,{focused:true});
    return {opened:true,tabId:tab.id};
  }
  browser.runtime.onMessage.addListener((message,sender,respond)=>{
    if(message?.type!=='ai-apply.tools'||!isUI(sender)&&!isProfile(sender))return false;
    (async()=>{
      const payload=message.payload||{};
      if(isProfile(sender)){
        const grant=await profileGrant(sender);
        if(!['profile.read','profile.save','profile.preview'].includes(payload.action))throw Error('Unknown profile action.');
        const operation=payload.action==='profile.read'?'PROFILE_STATE':payload.action==='profile.preview'?'PROFILE_RESUME_PREVIEW':payload.importResume?'PROFILE_RESUME_IMPORT':'PROFILE_SAVE';
        return dispatch('DOCK_APPLY_PROFILE',{...payload,windowId:grant.windowId,action:operation},sender);
      }
      await authorizeUI(sender);
      const windowId=sender.tab?.windowId??payload.windowId;
      if(!Number.isSafeInteger(windowId)||(await browser.windows.get(windowId)).type!=='normal')throw Error('Open Apply to Job in a normal browser window.');
      if(payload.action==='job.mark-applied'){
        if(typeof payload.jobId!=='string'||!payload.jobId||!Number.isSafeInteger(payload.expectedRevision)||typeof payload.mutationId!=='string'||!/^[\w-]{1,128}$/.test(payload.mutationId))throw Error('Reopen the saved job details before marking it applied.');
        return dispatch('DOCK_RECORDS_MUTATE',{action:'apply',type:'queue',id:payload.jobId,expectedRevision:payload.expectedRevision,mutationId:payload.mutationId,submissionConfirmed:true},sender);
      }
      if(payload.action==='profile.open'){
        const tab=Number.isSafeInteger(payload.tabId)?await browser.tabs.get(payload.tabId):(await browser.tabs.query({windowId,active:true})).find(item=>/^https?:\/\//.test(item.url||''));if(!tab||tab.windowId!==windowId||!/^https?:\/\//.test(tab.url||''))throw Error('Open an employer webpage to edit your autofill profile.');
        const token=crypto.randomUUID();await browser.storage.session.set({[grantKey(tab.id)]:{token,windowId,url:tab.url,expiresAt:Date.now()+30*60*1000}});
        await browser.scripting.executeScript({target:{tabId:tab.id},func:installProfileOverlay,args:[`${profileBase}?token=${encodeURIComponent(token)}`,token]});return {opened:true};
      }
      if(payload.action==='document.preview'){
        if(!['resume','cover-letter'].includes(payload.kind))throw Error('Choose a resume or cover letter to preview.');
        const tab=Number.isSafeInteger(payload.tabId)?await browser.tabs.get(payload.tabId):(await browser.tabs.query({windowId,active:true})).find(item=>/^https?:\/\//.test(item.url||''));
        if(!tab||tab.windowId!==windowId||!/^https?:\/\//.test(tab.url||''))throw Error('Open an employer webpage to preview this document.');
        const job=(await store('read')).requests.find(item=>item.id===payload.jobId&&item.state!=='cancelled');
        if(!job||job.documentsStale||payload.kind==='resume'&&!job.resume||payload.kind==='cover-letter'&&(!job.coverLetterEnabled||!job.coverLetter?.trim()))throw Error('This saved document is unavailable. Update the job documents before previewing.');
        const url=new URL(await previewPDF(job,{kind:payload.kind,browser,exporter:{exportDocuments}})),token=crypto.randomUUID();url.searchParams.set('overlayToken',token);
        const label=payload.kind==='resume'?'Resume':'Cover letter',title=[job.input.job.company,label].filter(Boolean).join(' \u00b7 ');
        await browser.scripting.executeScript({target:{tabId:tab.id},func:installDocumentPreviewOverlay,args:[url.href,title,token,tab.url]});
        return {opened:true,tabId:tab.id,kind:payload.kind};
      }
      if(['chat.open','chat.draft'].includes(payload.action))return openChat({...payload,windowId},sender);
      if(payload.action==='chat.draft.status')return answerChat.status(payload.id,windowId,payload.jobId);
      throw Error('Unknown application tool.');
    })().then(value=>respond({ok:true,value}),error=>respond({ok:false,error:error.message}));return true;
  });
}
