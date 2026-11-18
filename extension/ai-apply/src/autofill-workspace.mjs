import {createAutofillFormReview} from './autofill-form-review.mjs';
import {icon} from './icons.mjs';
import {sameApplicationUrl,applicationIdentity,confirmationRoute} from './application-identity.mjs';

const completed=run=>!run||['cancelled','submitted'].includes(run.phase);
const running=run=>run&&['filling','drafting'].includes(run.phase);
const profileContextId=(tabId,url)=>`profile:${tabId}:${applicationIdentity(url)?.key||''}`;
const runContextId=run=>run?.profileOnly?profileContextId(run.tabId,run.listingUrl||run.targetUrl):run?.jobId;
const employerTab=tab=>Number.isSafeInteger(tab?.id)&&/^https?:\/\//.test(tab.url||'')&&!['chatgpt.com','chat.deepseek.com'].includes(new URL(tab.url).hostname);
const runUrls=run=>[run?.targetUrl,run?.listingUrl,run?.applicationUrl,...run?.visitedUrls||[]].filter(Boolean);
function submissionPage(url,known){
  if(!url)return true;
  if(known.some(saved=>sameApplicationUrl(saved,url)))return true;
  if(!confirmationRoute(url))return false;
  const next=applicationIdentity(url);
  return known.some(saved=>{try{const previous=applicationIdentity(saved);return new URL(saved).origin===new URL(url).origin&&!(previous&&next&&previous.provider!=='page'&&previous.provider===next.provider&&previous.key!==next.key);}catch{return false;}});
}
export function autofillPresentation(job,run,targetTabId,targetUrl){
  const prepared=!!job&&!['cancelled','applied'].includes(job.state),sameContext=runContextId(run)===job?.id||run?.phase==='submitted'&&job?.profileOnly&&submissionPage(job.input.job.url,runUrls(run)),onPage=run?.phase!=='submitted'||!runUrls(run).length||submissionPage(targetUrl,runUrls(run)),own=sameContext&&onPage&&(!Number.isSafeInteger(targetTabId)||run?.tabId===targetTabId)?run:null,fields=own?.fields||[],filled=fields.filter(field=>field.filled).length;
  let label='Autofill',status=prepared?(job.resume?'Ready to autofill':'Ready to fill saved profile details'):'Select a queued job',disabled=!prepared;
  if(!completed(run)&&!own&&prepared){status='Ready to autofill this page';disabled=false;}
  else if(own?.phase==='submitted'){status='Application submitted';disabled=true;}
  else if(running(own)){label='Filling…';status=own.phase==='drafting'?'Drafting your answer':'Filling your application';disabled=true;}
  else if(own?.phase==='submission-pending'){label='Check submission';status=own.message||'Waiting for the employer’s submission confirmation';disabled=true;}
  else if(own?.phase==='paused'){label='Resume';status='Autofill paused';}
  else if(own&&!completed(own)){label=fields.length&&!own.trackingOnly?'Autofill again':'Autofill';status=fields.length?`${filled} of ${fields.length} fields filled`:'Open the application form to autofill';}
  return{prepared,own,fields,filled,label,status,disabled};
}

export function connectTrackerWorkspace({studio,queue,selectView,selectStudioTab,restoreState=async()=>{},browser=chrome,root=document,events=window}){
  const params=new URL(events.location.href).searchParams,nonce=params.get('nonce'),windowId=Number(params.get('windowId'));
  const q=selector=>root.querySelector(selector),host=q('#apply-actions');
  host.innerHTML=`<section class="tracker-autofill" aria-label="Application autofill">
    <div class="tracker-autofill-actions"><button class="button primary" type="button" data-fill-start><span data-autofill-label>Autofill</span></button><button class="button" type="button" data-draft-ai><span data-draft-label>Draft answers with AI</span></button></div>
    <details class="tracker-form-review" data-form-review open><summary>Application form</summary><div class="tracker-form-fields" data-form-fields></div></details>
  </section>`;
  const start=q('[data-fill-start]'),label=q('[data-autofill-label]'),draftButton=q('[data-draft-ai]'),draftLabel=q('[data-draft-label]'),formBar=q('[data-form-review]');
  start.prepend(icon('lightning'));draftButton.prepend(icon('sparkles'));
  let run=null,submission=null,profileContext=null,busy=false,disposed=false,refreshWork=null,inspectionWork=null,inspectionSerial=0,inspected=null,errorMessage='',aiError='',aiSending=false,answerBatch=null,checkingAnswers=false;
  const batchKey=`tracker-form-answer-batch:v1:${windowId}`;
  try{const saved=JSON.parse(events.sessionStorage.getItem(batchKey)||'null');if(saved?.id&&saved?.context&&Array.isArray(saved.targets))answerBatch=saved;}catch{}
  function rememberBatch(){try{if(answerBatch)events.sessionStorage.setItem(batchKey,JSON.stringify(answerBatch));else events.sessionStorage.removeItem(batchKey);}catch{}}
  const currentJob=()=>studio.selectedJob()||profileContext;
  const targetTabId=()=>profileContext?.tabId;
  const contextKey=()=>JSON.stringify([currentJob()?.id,targetTabId(),applicationIdentity(profileContext?.input.job.url)?.key||profileContext?.input.job.url]);
  const review=createAutofillFormReview(q('[data-form-fields]'),{onChange:renderActions});
  const submissionFor=job=>submission&&submission.tabId===targetTabId()&&submissionPage(profileContext?.input.job.url,[submission.url,submission.metadata?.jobLink].filter(Boolean))&&(job?.profileOnly||submission.jobId===job?.id||sameApplicationUrl(job?.input.job.url,submission.metadata?.jobLink))?submission:null;
  async function call(operation,payload={}){const reply=await browser.runtime.sendMessage({type:'ai-apply.autofill',operation,payload:{...payload,windowId}});if(!reply?.ok)throw Error(reply?.error||'Autofill could not connect.');return reply.value;}
  async function tool(action,payload={}){const reply=await browser.runtime.sendMessage({type:'ai-apply.tools',payload:{action,...payload,windowId}});if(!reply?.ok)throw Error(reply?.error||'AI answers could not connect.');return reply.value;}
  function currentState(){
    const job=currentJob(),state=autofillPresentation(job,run,targetTabId(),profileContext?.input.job.url),platform=submissionFor(job),inspection=inspected?.context===contextKey()?inspected:null;
    if(inspection&&(!running(state.own)||!state.fields.length)){state.fields=inspection.fields;state.filled=state.fields.filter(field=>field.filled).length;}
    state.submitted=state.own?.phase==='submitted'||platform?.phase==='submitted'||!!inspection?.submissionConfirmed;
    state.submitting=!state.submitted&&(state.own?.phase==='submission-pending'||platform?.phase==='submitting');
    if(state.submitted){state.status='Application submitted';state.disabled=true;state.fields=[];}
    else if(state.submitting){state.status=platform?.message||state.status;state.disabled=true;state.fields=[];}
    return {job,state};
  }
  function renderActions(){
    if(disposed)return;const {job,state}=currentState(),waiting=!!answerBatch;
    start.disabled=busy||state.disabled||aiSending;start.setAttribute('aria-busy',String(busy||running(state.own)));
    label.textContent=state.submitted?'Submitted':state.submitting?'Submitting…':busy||running(state.own)?'Filling…':'Autofill';
    start.title=errorMessage||(state.own?.phase==='error'?state.own.message:'')||state.own?.warnings?.join(' ')||state.status;
    start.dataset.submissionStatus=state.submitted?'submitted':state.submitting?'submitting':'';
    draftButton.disabled=busy||state.disabled||aiSending||waiting||!job||job.profileOnly||!review.selected().length;
    draftButton.setAttribute('aria-busy',String(aiSending||waiting));draftLabel.textContent=aiSending||waiting?'Drafting…':'Draft answers with AI';
    draftButton.title=aiError||(job?.profileOnly?'Select a saved job to draft answers in its AI conversation.':!review.selected().length?'Select questions using the checkbox beside a question number.':'Draft the selected questions in your AI conversation.');
  }
  function render(){if(disposed)return;const {job,state}=currentState();host.dataset.jobId=job?.id||'';formBar.hidden=!job||state.submitted||state.submitting;
    if(state.submitted&&answerBatch?.context===contextKey()){answerBatch=null;rememberBatch();}
    review.update(state.fields,{key:contextKey(),busy:busy||aiSending||running(state.own)});renderActions();
  }
  function syncTarget(state){
    const previous=contextKey();submission=state.submission||null;
    const tab=state.tabs?.find(item=>item.active&&employerTab(item))||state.tabs?.find(item=>item.id===profileContext?.tabId&&employerTab(item));
    profileContext=state.candidate&&tab?{id:profileContextId(tab.id,tab.url),profileOnly:true,tabId:tab.id,state:'profile',input:{job:{url:tab.url}}}:null;run=state.run;
    if(previous!==contextKey()){inspectionSerial++;inspected=null;errorMessage='';aiError='';}
  }
  async function inspect(){
    if(disposed||!currentJob()||!Number.isSafeInteger(targetTabId())||currentState().state.submitted||currentState().state.submitting)return;
    if(inspectionWork)return inspectionWork;
    const context=contextKey(),serial=++inspectionSerial,job=currentJob(),tabId=targetTabId();
    inspectionWork=(async()=>{try{const result=await call('DOCK_APPLY_INSPECT',{...!job.profileOnly?{jobId:job.id}:{},tabId});if(disposed||serial!==inspectionSerial||context!==contextKey())return;
      inspected={context,tabId:result.tabId,url:result.url,fields:result.fields||[],submissionConfirmed:!!result.submissionConfirmed};
    }catch(error){if(!disposed&&context===contextKey())errorMessage=error.message;}finally{inspectionWork=null;}})();return inspectionWork;
  }
  async function collectAnswers(){
    if(disposed||checkingAnswers||!answerBatch||answerBatch.context!==contextKey())return;
    checkingAnswers=true;const batch=answerBatch;
    try{const result=await tool('chat.draft.status',{id:batch.id,jobId:batch.jobId});if(disposed||answerBatch!==batch)return;
      if(result.phase==='error')throw Error(result.error||'The AI answers could not be retrieved.');
      if(result.phase!=='complete')return;
      await inspect();if(disposed||batch.context!==contextKey())return;
      render();review.accept(result.answers,batch.targets);answerBatch=null;rememberBatch();
    }catch(error){if(!disposed){aiError=error.message;answerBatch=null;rememberBatch();}}finally{checkingAnswers=false;render();}
  }
  function refresh(){
    if(disposed)return Promise.resolve();if(refreshWork)return refreshWork;
    refreshWork=(async()=>{try{
      let state=await call('DOCK_APPLY_STATE');if(disposed)return;syncTarget(state);
      const job=studio.selectedJob(),tab=state.tabs?.find(item=>item.active&&sameApplicationUrl(item.url,job?.input.job.url));
      const canObserve=!state.run||state.run.jobId!==job?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase)||!completed(state.run)&&state.run.tabId!==tab?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase);
      if(!busy&&!aiSending&&canObserve&&!currentState().state.submitted&&job&&!['cancelled','applied'].includes(job.state)&&tab)state=await call('DOCK_APPLY_TRACK',{jobId:job.id,tabId:tab.id});
      if(disposed)return;syncTarget(state);studio.updateApplicationSession?.(run);render();
      if(!busy&&!aiSending&&!running(currentState().state.own)&&formBar.open&&!q('#apply-panel')?.hidden)await inspect();
      if(disposed)return;render();await collectAnswers();
    }catch(error){if(!disposed){errorMessage=error.message;render();}}finally{refreshWork=null;}})();return refreshWork;
  }
  async function fill(){
    await refreshWork;if(disposed)return;
    const state=await call('DOCK_APPLY_STATE');if(disposed)return;syncTarget(state);render();
    if(currentState().state.submitted||currentState().state.submitting)return;
    const job=currentJob();if(!job)throw Error('Open an application page and create or upload your profile in Settings.');
    await inspect();if(disposed||currentJob()?.id!==job.id)return;render();
    if(currentState().state.submitted||currentState().state.submitting)return;
    const answers=review.edits(),payload=Object.keys(answers).length?{answers}:{};
    if(!job.profileOnly)void Promise.resolve().then(()=>studio.prepareApplyChat?.()).catch(()=>{});
    const tabs=state.tabs||[],tab=tabs.find(item=>item.id===targetTabId())||tabs.find(item=>item.id===job.tabId)||tabs.find(item=>item.active&&employerTab(item))||tabs.find(item=>item.url===job.input.job.url);
    const result=runContextId(run)===job.id&&!completed(run)&&(!tab||tab.id===run.tabId)
      ?await call('DOCK_APPLY_ACTION',{runId:run.id,action:run.phase==='paused'?'resume':'rescan',...payload})
      :await call('DOCK_APPLY_START',{...job.profileOnly?{profileOnly:true}:{jobId:job.id},...tab?{tabId:tab.id}:{},...!completed(run)?{replaceRunId:run.id}:{},options:{},...payload});
    if(!disposed){inspected=null;syncTarget(result);studio.updateApplicationSession?.(run);}
  }
  async function draft(){
    await refreshWork;if(disposed||busy||aiSending||answerBatch)return;
    aiSending=true;aiError='';render();
    try{await inspect();if(disposed)return;render();const job=currentJob(),context=contextKey(),fields=review.selected();
      if(!job||job.profileOnly||!fields.length)return;
      const targets=review.targets(fields),result=await tool('chat.draft',{jobId:job.id,conversationUrl:studio.applyChatUrl?.(),fields});if(disposed)return;
      answerBatch={id:result.id,jobId:job.id,context,targets};rememberBatch();
    }catch(error){if(!disposed)aiError=error.message;}finally{aiSending=false;render();}
  }
  const click=event=>{event.preventDefault();if(busy||start.disabled)return;busy=true;errorMessage='';render();void fill().catch(error=>{errorMessage=error.message;}).finally(()=>{busy=false;render();});};
  start.addEventListener('click',click);const draftClick=()=>{if(!draftButton.disabled)void draft();};draftButton.addEventListener('click',draftClick);
  const expand=()=>{if(formBar.open)void refresh();};formBar.addEventListener('toggle',expand);
  const unsubscribe=queue.subscribe(()=>{render();void refresh();}),selectors=['apply-job-select','apply-previous','apply-next'].map(id=>q('#'+id));
  const selectionChanged=()=>{inspectionSerial++;inspected=null;render();void refresh();};selectors.forEach(node=>node?.addEventListener(node.id==='apply-job-select'?'change':'click',selectionChanged));
  const message=event=>{if(event.source!==events.parent||event.data?.nonce!==nonce||event.data?.type!=='ai-apply.show')return;void studio.ready.then(async()=>{if(disposed)return;await restoreState();await queue.refresh();if(disposed)return;if(!event.data.restore){selectView('studio');selectStudioTab(event.data.panel==='results'?'results':'apply');}if(event.data.jobId)studio.selectJob(event.data.jobId);await refresh();}).catch(error=>{errorMessage=error.message;render();});};
  const tabActivated=info=>{if(info.windowId===windowId)void refresh();},tabUpdated=(_id,change,tab)=>{if(tab.windowId===windowId&&(change.url||change.status==='complete'))void refresh();};
  const submissionChanged=(message,sender)=>{if(sender.id===browser.runtime.id&&!sender.tab&&message?.type==='ai-apply.submission-changed'&&message.windowId===windowId)void refresh();};
  events.addEventListener('message',message);browser.runtime.onMessage?.addListener(submissionChanged);browser.tabs?.onActivated?.addListener(tabActivated);browser.tabs?.onUpdated?.addListener(tabUpdated);
  const timer=events.setInterval(()=>{if(!root.hidden)void refresh();},2000);
  void studio.ready.then(()=>{if(disposed)return;events.parent.postMessage({type:'ai-apply.ready',nonce},'*');void refresh();}).catch(error=>{errorMessage=error.message;render();});
  function close(){if(disposed)return;disposed=true;inspectionSerial++;events.clearInterval(timer);unsubscribe();review.clear();start.removeEventListener('click',click);draftButton.removeEventListener('click',draftClick);formBar.removeEventListener('toggle',expand);selectors.forEach(node=>node?.removeEventListener(node.id==='apply-job-select'?'change':'click',selectionChanged));events.removeEventListener('message',message);events.removeEventListener('pagehide',close);browser.tabs?.onActivated?.removeListener(tabActivated);browser.tabs?.onUpdated?.removeListener(tabUpdated);browser.runtime.onMessage?.removeListener(submissionChanged);}
  events.addEventListener('pagehide',close,{once:true});render();return {refresh,render,close};
}
