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
    <div class="tracker-autofill-bar"><div class="tracker-status-copy"><span class="tracker-heading-title"><button type="button" class="tracker-popup-trigger tracker-eyebrow" data-open-autofill aria-haspopup="dialog">Application autofill</button><button type="button" class="tracker-profile-settings" aria-label="Open autofill profile settings" title="Profile settings" data-profile-settings></button></span><span class="tracker-autofill-status" role="status" aria-live="polite">Ready to autofill</span></div><button class="button primary" type="button" data-fill-start><span data-autofill-label>Autofill</span></button><button type="button" class="tracker-popup-trigger tracker-popup-icon" data-open-autofill aria-label="Open application autofill" aria-haspopup="dialog">↗</button></div>
    <dialog class="tracker-autofill-dialog" aria-label="Application autofill form"><header class="dialog-heading"><h2>Application autofill</h2><button type="button" class="tracker-popup-close" data-close-autofill aria-label="Close application autofill">×</button></header><div class="tracker-popup-content">
    <div class="tracker-autofill-progress" role="progressbar" aria-label="Application completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span></span></div>
    <p class="tracker-autofill-notice" role="status" hidden></p>
    <section class="tracker-autofill-panel" aria-label="Application form"><div class="tracker-questions"></div><div class="tracker-autofill-controls"></div></section>
    </div></dialog>
  </section>`;
  const popup=q('.tracker-autofill-dialog');
  function openAutofill(){if(!popup.open)popup.showModal();positionAnswerAlert();void refresh();}
  for(const trigger of root.querySelectorAll('[data-open-autofill]'))trigger.addEventListener('click',openAutofill);
  q('[data-close-autofill]').addEventListener('click',()=>{popup.close();positionAnswerAlert();});
  popup.addEventListener('cancel',()=>{});
  popup.addEventListener('click',event=>{if(event.target!==popup)return;const rect=popup.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)popup.close();});
  popup.addEventListener('close',()=>{positionAnswerAlert();q('[data-open-autofill]').focus({preventScroll:true});});
  const status=q('.tracker-autofill-status'),start=q('[data-fill-start]'),label=q('[data-autofill-label]'),panel=q('.tracker-autofill-panel'),controls=q('.tracker-autofill-controls'),questions=q('.tracker-questions'),progress=q('.tracker-autofill-progress'),notice=q('.tracker-autofill-notice');
  start.prepend(icon('lightning'));
  q('[data-profile-settings]').append(icon('settings'));
  let run=null,submission=null,profileContext=null,busy=false,disposed=false,refreshing=false,inspecting=false,inspectionWork=null,inspected=null,errorMessage='',selectionVersion=0,answerBatch=null,checkingAnswers=false,answerAlert=null,answerNotice=null,pendingFill=null;const drafts=new Map(),selection=new Map(),expanded=new Set();
  const currentJob=()=>studio.selectedJob()||profileContext;
  let confirmedInspection=null;
  const targetTabId=()=>profileContext?.tabId;
  const submissionFor=job=>submission&&submission.tabId===targetTabId(job)&&submissionPage(profileContext?.input.job.url,[submission.url,submission.metadata?.jobLink].filter(Boolean))&&(job?.profileOnly||submission.jobId===job?.id||sameApplicationUrl(job?.input.job.url,submission.metadata?.jobLink))?submission:null;
  const batchKey=`tracker-answer-batch:${windowId}`;
  try{answerBatch=JSON.parse(events.sessionStorage.getItem(batchKey)||'null');}catch{}
  function rememberBatch(){try{if(answerBatch)events.sessionStorage.setItem(batchKey,JSON.stringify(answerBatch));else events.sessionStorage.removeItem(batchKey);}catch{}}
  const make=(tag,className,text)=>{const node=root.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  function positionAnswerAlert(){if(answerAlert){const target=popup.open?popup:host;if(answerAlert.parentElement!==target)target.prepend(answerAlert);}}
  function showAnswerAlert(text,needsInput){
    answerAlert?.remove();answerAlert=make('aside','tracker-answer-alert'+(needsInput?' tracker-answer-alert-warning':''));answerAlert.setAttribute('role','alert');answerAlert.setAttribute('aria-live','assertive');
    const copy=make('div'),dismiss=make('button','tracker-answer-alert-close','×');copy.append(make('strong',null,text));dismiss.type='button';dismiss.setAttribute('aria-label','Dismiss AI answer alert');dismiss.addEventListener('click',clearAnswerAlert);answerAlert.append(copy,dismiss);positionAnswerAlert();
  }
  function clearAnswerAlert(){answerAlert?.remove();answerAlert=null;answerNotice=null;}
  function syncAnswerAlert(){
    if(!answerNotice)return;
    const {job,state}=currentState();
    if(state.submitted||job?.id!==answerNotice.jobId||Number.isSafeInteger(targetTabId())&&Number.isSafeInteger(answerNotice.tabId)&&targetTabId()!==answerNotice.tabId){clearAnswerAlert();return;}
    if(!answerNotice.targets)return;
    const missing=answerNotice.targets.filter(target=>{
      const field=state.fields.find(field=>field.key===target.id);if(!field||field.filled||scope(field)!==target.scope)return false;
      const answer=drafts.get(target.scope)??currentAnswer(field);if(!field.multiple)return !String(answer||'').trim();
      try{const values=JSON.parse(answer||'[]');return !Array.isArray(values)||!values.some(value=>typeof value==='string'&&value.trim());}catch{return !String(answer||'').trim();}
    }).length;
    if(!missing){answerAlert?.remove();answerAlert=null;return;}
    const text=`${missing} Answers need your input`;if(!answerAlert)showAnswerAlert(text,true);else answerAlert.querySelector('strong').textContent=text;
  }
  async function call(operation,payload={}){const reply=await browser.runtime.sendMessage({type:'ai-apply.autofill',operation,payload:{...payload,windowId}});if(!reply?.ok)throw Error(reply?.error||'Autofill could not connect.');return reply.value;}
  async function tool(action,payload={}){const reply=await browser.runtime.sendMessage({type:'ai-apply.tools',payload:{action,...payload,windowId}});if(!reply?.ok)throw Error(reply?.error||'This action could not complete.');return reply.value;}
  function currentState(){
    const job=currentJob(),state=autofillPresentation(job,run,targetTabId(job),profileContext?.input.job.url);
    if(inspected&&inspected.jobId===job?.id&&(!Number.isSafeInteger(targetTabId(job))||inspected.tabId===targetTabId(job))&&!running(state.own)){
      if(!state.own||inspected.tabId!==state.own.tabId)state.own=null;
      state.fields=inspected.fields||[];state.filled=state.fields.filter(field=>field.filled).length;
      if(state.prepared&&state.fields.length&&!['paused','error','submission-pending','submitted'].includes(state.own?.phase))state.status=`${state.filled} of ${state.fields.length} fields filled`;
    }
    const platform=submissionFor(job);
    const receiptConfirmed=confirmedInspection&&confirmedInspection.tabId===targetTabId()&&(confirmedInspection.jobId===job?.id||job?.profileOnly)&&submissionPage(profileContext?.input.job.url,[confirmedInspection.url]);
    state.submitted=state.own?.phase==='submitted'||platform?.phase==='submitted'||!!receiptConfirmed;
    state.submitting=!state.submitted&&(state.own?.phase==='submission-pending'||platform?.phase==='submitting');
    if(state.submitted){state.fields=[];state.filled=0;state.status='Application submitted';state.label='Submitted';state.disabled=true;}
    else if(state.submitting){state.status=platform?.message||state.status;state.disabled=true;}
    return{job,state};
  }
  const scope=field=>`${currentJob()?.id}:${inspected?.tabId??run?.tabId??''}:${field.key}`;
  function included(field){const key=scope(field);if(!selection.has(key))selection.set(key,!!field.required||!!field.canAutofill);return selection.get(key);}
  function selectedFields(){return currentState().state.fields.filter(field=>!field.filled&&included(field));}
  const draftButton=make('button','button tracker-ai-answer','Draft answers with AI'),fillButton=make('button','button tracker-secondary','Fill all');draftButton.type=fillButton.type='button';draftButton.dataset.draftSelected='';fillButton.dataset.fillSelected='';controls.append(draftButton,fillButton);
  const confirmation=make('div','tracker-submission-confirmation'),confirmationCopy=make('p','tracker-form-help','If the employer confirms your application was submitted, you can record it here.'),confirmButton=make('button','button tracker-secondary','Confirm submitted');confirmButton.type='button';confirmation.hidden=true;confirmation.append(confirmationCopy,confirmButton);panel.append(confirmation);
  confirmButton.addEventListener('click',()=>void perform(()=>call('DOCK_APPLY_ACTION',{runId:run.id,action:'confirm-submission'})));
  q('[data-profile-settings]').addEventListener('click',event=>{event.preventDefault();event.stopPropagation();void tool('profile.open',{tabId:inspected?.tabId??run?.tabId}).catch(error=>{errorMessage=error.message;render();});});
  draftButton.addEventListener('click',()=>{void perform(async()=>{const job=studio.selectedJob(),fields=selectedFields().filter(field=>field.type!=='file').map(field=>({...field,answer:drafts.get(scope(field))??field.answer??''})),targets=fields.map(field=>({id:field.key,scope:scope(field),answer:field.answer}));const result=await tool('chat.draft',{jobId:job.id,conversationUrl:studio.applyChatUrl?.(),fields});const note='AI is drafting answers. They will appear here when ready.';answerBatch=result.id?{id:result.id,jobId:job.id,targets,note}:null;rememberBatch();errorMessage=note;return null;});});
  async function collectAnswers(){
    if(disposed||!answerBatch||checkingAnswers)return;checkingAnswers=true;const batch=answerBatch;
    try{
      const result=await tool('chat.draft.status',{id:batch.id,jobId:batch.jobId});if(disposed||answerBatch!==batch)return;
      if(result.phase==='error')throw Error(result.error||'AI answers could not be collected.');
      if(result.phase!=='complete'){if(result.message)batch.note=result.message;return;}
      if(studio.selectedJob()?.id!==batch.jobId){errorMessage='AI answers belong to the previous job. Select it and draft again to review its answers.';return;}
      answerBatch=null;rememberBatch();let added=0,kept=0;const missing=[];
      const fields=currentState().state.fields;
      for(const answer of result.answers||[]){const target=batch.targets.find(item=>item.id===answer.id),field=fields.find(item=>item.key===answer.id);if(!target||field?.filled||field&&scope(field)!==target.scope)continue;if(answer.needsUser){missing.push(target);continue;}const current=drafts.get(target.scope)??field?.answer??target.answer??'';if(current!==target.answer){kept++;continue;}drafts.set(target.scope,answer.answer);added++;}
      selectionVersion++;questions.dataset.signature='';errorMessage='';
      clearAnswerAlert();answerNotice={jobId:batch.jobId,tabId:inspected?.tabId??run?.tabId,targets:missing.length?missing:null};
      if(missing.length)syncAnswerAlert();else showAnswerAlert(`${added} AI answers ready for review`,false);
    }catch(error){answerBatch=null;rememberBatch();errorMessage=error.message;}finally{checkingAnswers=false;render();}
  }
  fillButton.addEventListener('click',()=>void perform(()=>fill(true)));
  function section(title,count){const group=make('section','tracker-field-group'),heading=make('header','tracker-field-heading');heading.append(make('h3',null,title));if(count)heading.append(make('span','tracker-group-count',count));group.append(heading);questions.append(group);return group;}
  function filledField(group,field){const key=scope(field),row=make('details','tracker-filled-field'),summary=make('summary'),input=make('textarea','input');row.open=expanded.has(key);summary.append(make('span',null,field.label||'Application field'),make('span','tracker-field-check','✓'));input.value=field.answer||'Filled on page';input.readOnly=true;input.rows=2;input.setAttribute('aria-label',field.label||'Filled answer');row.append(summary,input);row.addEventListener('toggle',()=>row.open?expanded.add(key):expanded.delete(key));group.append(row);}
  const currentAnswer=field=>field.multiple?field.answerValues?.length?JSON.stringify(field.answerValues):'':field.answer??'';
  function setAnswerEditor(input,value){
    if(!input.multiple){input.value=value;return;}
    let selected;try{selected=JSON.parse(value||'[]');}catch{selected=[value];}
    if(!Array.isArray(selected))selected=[];
    for(const option of input.options)option.selected=selected.includes(option.value);
  }
  function renderFields(state,job){
    const signature=JSON.stringify([job?.id,job?.updatedAt,state.own?.id,state.submitted,state.submitting,state.status,state.fields,run?.drafts,selectionVersion,state.fields.length?false:inspecting]);if(questions.dataset.signature===signature)return;
    const active=questions.contains(root.activeElement)&&root.activeElement?.matches('[data-answer-key]')?root.activeElement:null,focused=!!active&&root.hasFocus(),selectionStart=active?.selectionStart,selectionEnd=active?.selectionEnd;
    let preserved;
    questions.dataset.signature=signature;questions.replaceChildren();
    if(!job)return;if(state.submitted||state.submitting){const message=make('p','tracker-form-help tracker-submission-message',state.status);message.setAttribute('role','status');questions.append(message);return;}if(!state.fields.length){questions.append(make('p','tracker-form-help',inspecting?'Reading application fields…':'No application fields detected on this page. Open the employer’s application form, then expand this section to refresh.'));return;}
    const grouped=new Map();for(const field of state.fields){const title=field.type==='file'?'Documents':field.kind==='ai'?'Additional questions':'Application information';if(!grouped.has(title))grouped.set(title,[]);grouped.get(title).push(field);}
    for(const [title,fields]of grouped){const group=section(title,`${fields.filter(field=>field.filled).length}/${fields.length}`);
      for(const field of fields){
        if(field.filled){drafts.delete(scope(field));filledField(group,field);continue;}
        const row=make('div','tracker-question'),heading=make('div','tracker-question-heading'),caption=make('label','tracker-field-label',(field.label||'Application question')+(field.required&&!/\*/.test(field.label||'')?' *':'')),checkbox=make('input','tracker-field-selector');checkbox.type='checkbox';checkbox.checked=included(field);checkbox.setAttribute('aria-label',`Include ${field.label||'question'} in bulk actions`);checkbox.dataset.fieldKey=field.key;
        checkbox.addEventListener('change',()=>{selection.set(scope(field),checkbox.checked);selectionVersion++;updateControls();});heading.append(caption,checkbox);row.append(heading);
        if(field.type==='file'){row.append(make('p','tracker-form-help','Your saved document will be attached when available.'));}
        else{
          const options=field.type==='checkbox'?[{value:'Yes',label:'Yes'},{value:'No',label:'No'}]:field.options||[],fieldScope=scope(field),optionsKey=JSON.stringify([!!field.multiple,options]),reuse=active?.dataset.answerScope===fieldScope&&active.dataset.answerOptions===optionsKey;
          const input=reuse?active:make(options.length?'select':'textarea','input');
          if(reuse){preserved=input;const value=drafts.get(fieldScope)??currentAnswer(field)??run?.drafts?.[field.key]??'';setAnswerEditor(input,value);}
          else{
            input.id=`answer-${crypto.randomUUID()}`;input.dataset.answerKey=field.key;input.dataset.answerScope=fieldScope;input.dataset.answerOptions=optionsKey;
            if(options.length){input.multiple=!!field.multiple;if(input.multiple)input.size=Math.min(5,Math.max(2,options.length));else{const empty=make('option',null,'Choose an answer');empty.value='';input.append(empty);}for(const option of options){const node=make('option',null,option.label);node.value=option.value;node.disabled=!!option.disabled;input.append(node);}}else input.rows=field.kind==='ai'?2:1;
            setAnswerEditor(input,drafts.get(fieldScope)??currentAnswer(field)??run?.drafts?.[field.key]??'');input.placeholder='Enter or paste your answer';const save=()=>{drafts.set(fieldScope,input.multiple?JSON.stringify([...input.options].filter(option=>option.selected).map(option=>option.value)):input.value);syncAnswerAlert();};input.addEventListener('input',save);input.addEventListener('change',save);
          }
          caption.htmlFor=input.id;row.append(input);if(field.optionMessage)row.append(make('p','tracker-form-help',field.optionMessage));
        }
        group.append(row);
      }
    }
    if(preserved&&focused){preserved.focus({preventScroll:true});if(typeof selectionStart==='number')preserved.setSelectionRange(selectionStart,selectionEnd);}
  }
  function render(){
    if(disposed)return;
    const {job,state}=currentState();
    if(state.submitted){clearAnswerAlert();pendingFill=null;errorMessage='';if(answerBatch){answerBatch=null;rememberBatch();}}
    if(pendingFill&&run?.id===pendingFill.id){
      if(['error','paused','cancelled'].includes(run.phase))pendingFill=null;
      else if(['ready','questions'].includes(run.phase)){
        const filled=run.fields?.some(field=>field.filled&&pendingFill.keys.includes(field.key));pendingFill=null;
        if(filled&&!run.warnings?.length){if(!answerNotice?.targets)clearAnswerAlert();errorMessage='';if(popup.open)popup.close();}
      }
    }
    syncAnswerAlert();positionAnswerAlert();host.dataset.jobId=job?.id||'';
    const submissionHere=submissionFor(job);
    start.disabled=busy||!canFill(state);label.textContent=busy?'Working…':state.label;status.textContent=state.submitted?state.status:answerBatch?answerBatch.note||'AI is drafting answers…':errorMessage||submissionHere&&submission.message||state.status;panel.hidden=!job;controls.hidden=state.submitted||state.submitting;
    const percent=state.fields.length?Math.round(state.filled/state.fields.length*100):0;progress.setAttribute('aria-valuenow',String(percent));progress.querySelector('span').style.width=percent+'%';progress.hidden=!state.fields.length;
    const message=errorMessage||(state.own?.phase==='error'?state.own.message:state.own?.warnings?.join(' ')||'');notice.textContent=message;notice.hidden=!message;renderFields(state,job);
    confirmation.hidden=state.own?.phase!=='submission-pending'||!run.submissionStartedAt||Date.now()-run.submissionStartedAt<10000;confirmButton.disabled=busy;
    updateControls();
  }
  function canFill(state){return !state.disabled;}
  function updateControls(){const fields=selectedFields(),{job,state}=currentState();draftButton.textContent=answerBatch?'Waiting for answers…':'Draft answers with AI';draftButton.disabled=busy||state.own?.phase==='submission-pending'||['submitting','submitted'].includes(submissionFor(job)?.phase)||!!answerBatch||!job||job.profileOnly||!fields.some(field=>field.type!=='file');draftButton.title=job?.profileOnly?'Select a queued job to use its AI conversation.':'';fillButton.disabled=busy||!canFill(state)||!fields.length;}
  function inspect(){
    if(inspectionWork)return inspectionWork;
    if(disposed||!popup.open&&!(answerNotice?.targets&&answerAlert)||currentState().state.submitted||running(currentState().state.own))return Promise.resolve();
    inspecting=true;render();
    inspectionWork=(async()=>{try{const job=currentJob(),jobId=job?.id,own=currentState().state.own&&!completed(run),tabId=targetTabId(job),result=await call('DOCK_APPLY_INSPECT',{...job?.profileOnly?{tabId:job.tabId}:{jobId},...Number.isSafeInteger(tabId)?{tabId}:own?{tabId:run.tabId}:inspected?.jobId===jobId?{fallbackTabId:inspected.tabId}:{}});if(jobId===currentJob()?.id){inspected={...result,jobId};if(result.submissionConfirmed)confirmedInspection={jobId,tabId:result.tabId,url:result.url||profileContext?.input.job.url};}}catch(error){if(inspected?.jobId!==currentJob()?.id)inspected=null;if(!currentState().state.submitted)errorMessage=error.message;}finally{inspecting=false;inspectionWork=null;render();}})();return inspectionWork;
  }
  function syncTarget(state){
    const previous=run;
    submission=state.submission||null;
    const activeTab=state.tabs?.find(item=>item.active&&employerTab(item))||state.tabs?.find(item=>item.id===(inspected?.tabId??profileContext?.tabId)&&employerTab(item));
    profileContext=state.candidate&&activeTab?{id:profileContextId(activeTab.id,activeTab.url),profileOnly:true,tabId:activeTab.id,state:'profile',input:{job:{url:activeTab.url}}}:null;
    if(inspected&&Number.isSafeInteger(profileContext?.tabId)&&inspected.tabId!==profileContext.tabId)inspected=null;
    run=state.run;if(previous?.pageRevision!==run?.pageRevision||previous?.tabId!==run?.tabId)inspected=null;
  }
  async function refresh(){if(refreshing||disposed)return;refreshing=true;try{
    let state=await call('DOCK_APPLY_STATE');syncTarget(state);
    const job=studio.selectedJob(),tab=state.tabs?.find(item=>item.active&&sameApplicationUrl(item.url,job?.input.job.url));
    const canObserve=!state.run||state.run.jobId!==job?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase)||!completed(state.run)&&state.run.tabId!==tab?.id&&!['filling','drafting','submission-pending'].includes(state.run.phase);
    if(canObserve&&!currentState().state.submitted&&job&&!['cancelled','applied'].includes(job.state)&&tab)state=await call('DOCK_APPLY_TRACK',{jobId:job.id,tabId:tab.id});
    syncTarget(state);
    studio.updateApplicationSession?.(run);render();await inspect();await collectAnswers();
  }catch(error){if(!disposed){errorMessage=error.message;render();}}finally{refreshing=false;}}
  async function perform(task){if(busy)return;busy=true;errorMessage='';render();try{const state=await task();if(state&&Object.hasOwn(state,'run')){run=state.run;inspected=null;}}catch(error){errorMessage=error.message;}finally{busy=false;render();}}
  async function fill(selectedOnly=false){
    let state=await call('DOCK_APPLY_STATE');syncTarget(state);
    if(currentState().state.submitted||currentState().state.submitting){render();return state;}
    const job=currentJob();if(!job)throw Error('Open an application page and create or upload your profile in Settings.');
    if(selectedOnly){
      await inspect();
      // Submission can finish while the form inspection is in flight. Check
      // its authoritative state before interpreting an empty confirmation page.
      state=await call('DOCK_APPLY_STATE');syncTarget(state);
      if(currentState().state.submitted||currentState().state.submitting){render();return state;}
    }
    const hasFields=currentState().state.fields.length>0;
    if(selectedOnly&&!hasFields&&runContextId(run)!==job.id)throw Error(errorMessage||'No application fields were found. Open this job’s application form, then try Autofill.');
    const fields=selectedFields(),answers=Object.fromEntries(fields.map(field=>[field.key,drafts.get(scope(field))??currentAnswer(field)])),payload=selectedOnly&&hasFields?{fieldKeys:fields.map(field=>field.key),answers}:{};
    if(!job.profileOnly)void Promise.resolve().then(()=>studio.prepareApplyChat?.()).catch(()=>{});
    const track=result=>{if(result?.run)pendingFill={id:result.run.id,keys:fields.map(field=>field.key)};return result;};
    const tab=state.tabs.find(item=>item.id===inspected?.tabId&&inspected.jobId===job.id)||state.tabs.find(item=>item.id===targetTabId(job))||state.tabs.find(item=>item.id===job.tabId)||state.tabs.find(item=>item.active&&employerTab(item))||state.tabs.find(item=>item.url===job.input.job.url);
    if(runContextId(run)===job.id&&!completed(run)&&(!tab||tab.id===run.tabId))return track(await call('DOCK_APPLY_ACTION',{runId:run.id,action:run.phase==='paused'?'resume':'rescan',...payload}));
    return track(await call('DOCK_APPLY_START',{...job.profileOnly?{profileOnly:true}:{jobId:job.id},...tab?{tabId:tab.id}:{},...!completed(run)?{replaceRunId:run.id}:{},options:{},...payload}));
  }
  start.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!popup.open)popup.showModal();void perform(async()=>{
    return fill(true);
  });});
  const unsubscribe=queue.subscribe(()=>{render();});for(const id of ['apply-job-select','apply-previous','apply-next'])q('#'+id).addEventListener(id==='apply-job-select'?'change':'click',render);
  events.addEventListener('message',event=>{if(event.source!==events.parent||event.data?.nonce!==nonce||event.data?.type!=='ai-apply.show')return;void studio.ready.then(async()=>{await restoreState();await queue.refresh();if(!event.data.restore){selectView('studio');selectStudioTab(event.data.panel==='results'?'results':'apply');}if(event.data.jobId)studio.selectJob(event.data.jobId);await refresh();});});
  const tabActivated=info=>{if(info.windowId===windowId)void refresh();},tabUpdated=(_id,change,tab)=>{if(tab.windowId===windowId&&(change.url||change.status==='complete'))void refresh();};
  const submissionChanged=(message,sender)=>{if(sender.id===browser.runtime.id&&!sender.tab&&message?.type==='ai-apply.submission-changed'&&message.windowId===windowId)void refresh();};
  browser.runtime.onMessage?.addListener(submissionChanged);
  browser.tabs?.onActivated?.addListener(tabActivated);browser.tabs?.onUpdated?.addListener(tabUpdated);
  const timer=events.setInterval(()=>{if(currentState().state.submitted)return;void collectAnswers();if(!root.hidden)void refresh();},2000);void studio.ready.then(()=>{events.parent.postMessage({type:'ai-apply.ready',nonce},'*');void refresh();void collectAnswers();});events.addEventListener('pagehide',()=>{disposed=true;events.clearInterval(timer);unsubscribe();browser.tabs?.onActivated?.removeListener(tabActivated);browser.tabs?.onUpdated?.removeListener(tabUpdated);browser.runtime.onMessage?.removeListener(submissionChanged);},{once:true});
  return {refresh,render};
}
