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
  host.innerHTML='<section class="tracker-autofill" aria-label="Application autofill"><button class="button primary" type="button" data-fill-start><span data-autofill-label>Autofill</span></button></section>';
  const start=q('[data-fill-start]'),label=q('[data-autofill-label]');start.prepend(icon('lightning'));
  let run=null,submission=null,profileContext=null,busy=false,disposed=false,refreshing=false,refreshWork=null,errorMessage='';
  const currentJob=()=>studio.selectedJob()||profileContext;
  const targetTabId=()=>profileContext?.tabId;
  const submissionFor=job=>submission&&submission.tabId===targetTabId()&&submissionPage(profileContext?.input.job.url,[submission.url,submission.metadata?.jobLink].filter(Boolean))&&(job?.profileOnly||submission.jobId===job?.id||sameApplicationUrl(job?.input.job.url,submission.metadata?.jobLink))?submission:null;
  async function call(operation,payload={}){
    const reply=await browser.runtime.sendMessage({type:'ai-apply.autofill',operation,payload:{...payload,windowId}});
    if(!reply?.ok)throw Error(reply?.error||'Autofill could not connect.');return reply.value;
  }
  function currentState(){
    const job=currentJob(),state=autofillPresentation(job,run,targetTabId(),profileContext?.input.job.url),platform=submissionFor(job);
    state.submitted=state.own?.phase==='submitted'||platform?.phase==='submitted';
    state.submitting=!state.submitted&&(state.own?.phase==='submission-pending'||platform?.phase==='submitting');
    if(state.submitted){state.status='Application submitted';state.disabled=true;}
    else if(state.submitting){state.status=platform?.message||state.status;state.disabled=true;}
    return {job,state};
  }
  function render(){
    if(disposed)return;
    const {job,state}=currentState();host.dataset.jobId=job?.id||'';
    start.disabled=busy||state.disabled;start.setAttribute('aria-busy',String(busy||running(state.own)));
    label.textContent=state.submitted?'Submitted':state.submitting?'Submitting…':busy||running(state.own)?'Filling…':'Autofill';
    start.title=state.submitted?state.status:errorMessage||(state.own?.phase==='error'?state.own.message:'')||state.own?.warnings?.join(' ')||state.status;
    start.dataset.submissionStatus=state.submitted?'submitted':state.submitting?'submitting':'';
  }
  function syncTarget(state){
    submission=state.submission||null;
    const activeTab=state.tabs?.find(item=>item.active&&employerTab(item))||state.tabs?.find(item=>item.id===profileContext?.tabId&&employerTab(item));
    profileContext=state.candidate&&activeTab?{id:profileContextId(activeTab.id,activeTab.url),profileOnly:true,tabId:activeTab.id,state:'profile',input:{job:{url:activeTab.url}}}:null;
    run=state.run;
  }
  function refresh(){
    if(refreshing||disposed)return refreshWork||Promise.resolve();refreshing=true;
    refreshWork=(async()=>{
    try{
      let state=await call('DOCK_APPLY_STATE');if(disposed)return;syncTarget(state);
      const job=studio.selectedJob(),tab=state.tabs?.find(item=>item.active&&sameApplicationUrl(item.url,job?.input.job.url));
      const canObserve=!state.run||state.run.jobId!==job?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase)||!completed(state.run)&&state.run.tabId!==tab?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase);
      if(!busy&&canObserve&&!currentState().state.submitted&&job&&!['cancelled','applied'].includes(job.state)&&tab)state=await call('DOCK_APPLY_TRACK',{jobId:job.id,tabId:tab.id});
      if(disposed)return;syncTarget(state);studio.updateApplicationSession?.(run);render();
    }catch(error){if(!disposed){errorMessage=error.message;render();}}finally{refreshing=false;}
    })();return refreshWork;
  }
  async function fill(){
    // Let an initial passive binding finish before choosing Start or Rescan.
    await refreshWork;if(disposed)return;
    const state=await call('DOCK_APPLY_STATE');if(disposed)return;syncTarget(state);
    const current=currentState();if(current.state.submitted||current.state.submitting)return;
    const job=current.job;if(!job)throw Error('Open an application page and create or upload your profile in Settings.');
    if(!job.profileOnly)void Promise.resolve().then(()=>studio.prepareApplyChat?.()).catch(()=>{});
    const tabs=state.tabs||[],tab=tabs.find(item=>item.id===targetTabId())||tabs.find(item=>item.id===job.tabId)||tabs.find(item=>item.active&&employerTab(item))||tabs.find(item=>item.url===job.input.job.url);
    // Omitting fieldKeys lets the existing engine fill every known answer and
    // available document directly, without a second form editor in the dock.
    const result=runContextId(run)===job.id&&!completed(run)&&(!tab||tab.id===run.tabId)
      ?await call('DOCK_APPLY_ACTION',{runId:run.id,action:run.phase==='paused'?'resume':'rescan'})
      :await call('DOCK_APPLY_START',{...job.profileOnly?{profileOnly:true}:{jobId:job.id},...tab?{tabId:tab.id}:{},...!completed(run)?{replaceRunId:run.id}:{},options:{}});
    if(!disposed){syncTarget(result);studio.updateApplicationSession?.(run);}
  }
  const click=event=>{event.preventDefault();event.stopPropagation();if(busy||start.disabled)return;busy=true;errorMessage='';render();void fill().catch(error=>{errorMessage=error.message;}).finally(()=>{busy=false;render();});};
  start.addEventListener('click',click);
  const unsubscribe=queue.subscribe(render),selectors=['apply-job-select','apply-previous','apply-next'].map(id=>q('#'+id));
  selectors.forEach(node=>node.addEventListener(node.id==='apply-job-select'?'change':'click',render));
  const message=event=>{if(event.source!==events.parent||event.data?.nonce!==nonce||event.data?.type!=='ai-apply.show')return;void studio.ready.then(async()=>{if(disposed)return;await restoreState();await queue.refresh();if(disposed)return;if(!event.data.restore){selectView('studio');selectStudioTab(event.data.panel==='results'?'results':'apply');}if(event.data.jobId)studio.selectJob(event.data.jobId);await refresh();}).catch(error=>{errorMessage=error.message;render();});};
  const tabActivated=info=>{if(info.windowId===windowId)void refresh();},tabUpdated=(_id,change,tab)=>{if(tab.windowId===windowId&&(change.url||change.status==='complete'))void refresh();};
  const submissionChanged=(message,sender)=>{if(sender.id===browser.runtime.id&&!sender.tab&&message?.type==='ai-apply.submission-changed'&&message.windowId===windowId)void refresh();};
  events.addEventListener('message',message);browser.runtime.onMessage?.addListener(submissionChanged);
  browser.tabs?.onActivated?.addListener(tabActivated);browser.tabs?.onUpdated?.addListener(tabUpdated);
  const timer=events.setInterval(()=>{if(!root.hidden)void refresh();},2000);
  void studio.ready.then(()=>{if(disposed)return;events.parent.postMessage({type:'ai-apply.ready',nonce},'*');void refresh();}).catch(error=>{errorMessage=error.message;render();});
  function close(){if(disposed)return;disposed=true;events.clearInterval(timer);unsubscribe();start.removeEventListener('click',click);selectors.forEach(node=>node.removeEventListener(node.id==='apply-job-select'?'change':'click',render));events.removeEventListener('message',message);events.removeEventListener('pagehide',close);browser.tabs?.onActivated?.removeListener(tabActivated);browser.tabs?.onUpdated?.removeListener(tabUpdated);browser.runtime.onMessage?.removeListener(submissionChanged);}
  events.addEventListener('pagehide',close,{once:true});render();return {refresh,render,close};
}
