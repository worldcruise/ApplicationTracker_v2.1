import { safeJobUrl } from './reference-dashboard-data.js';
import { profileName } from './profile-model.js';
import {readSavedQueueFile} from './saved-queue-file.js';
import {savedCoverLetter} from './saved-cover-letter.js';
import {createSingleProfileService} from './single-profile-service.js';
import {sameApplicationUrl,isApplicationTransition,applicationUrl,applicationIdentity,confirmationRoute} from '../ai-apply/src/application-identity.mjs';
import {validateWorkdaySubmission} from './workday-submission.js';
import {AUTOFILL_DEFAULTS,autofillPreferences,AUTOFILL_SETTINGS_KEY} from './autofill-settings.js';
import {applicationPDFFilename} from './document-paths.js';
import {createSpeedySubmissionService} from './speedy-submission-service.js';

export const DOCK_APPLY_OPERATIONS=['DOCK_APPLY_STATE','DOCK_APPLY_PROFILE','DOCK_APPLY_INSPECT','DOCK_APPLY_START','DOCK_APPLY_TRACK','DOCK_APPLY_EVENT','DOCK_APPLY_ACTION'];
const active=run=>run&&!['cancelled','submitted'].includes(run.phase);
const normalized=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
const defaults=AUTOFILL_DEFAULTS;
const fieldKey=(frame,field)=>`${frame.documentId||frame.frameId}:${field.id}`;
// srcdoc/blank application frames inherit their employer origin. An opaque
// sandbox or a non-web frame must still be excluded from autofill.
const employerForm=result=>!!safeJobUrl(result.url)||/^about:(?:blank|srcdoc)$/.test(result.url)&&!!safeJobUrl(result.origin);

export function createDockApplyService({browser,storage,profiles,records,renderSnapshot,parseResume,readQueueFile=readSavedQueueFile,renderCoverLetter=savedCoverLetter}) {
  const profileService=createSingleProfileService({profiles,parseResume});
  const runs=new Map(),pendingRuns=new Map(),pendingWrites=new Map(),pdfs=new Map(),tasks=new Map(),actions=new Map();let starts=Promise.resolve();
  const submissions=createSpeedySubmissionService({browser,storage,profiles,records,
    resolveJob:async(state,sender,windowId)=>{const run=await load(windowId);return run?.tabId===sender.tab.id&&[run.listingUrl,run.applicationUrl,...run.visitedUrls||[]].some(url=>sameApplicationUrl(url,state.metadata.jobLink)||sameApplicationUrl(url,state.url))?run.jobId:undefined;},
    onRecorded:async(state,sender)=>{const run=await load(state.windowId),waiting=[...pendingRuns.values()].find(run=>run.tabId===sender.tab.id&&run.windowId===state.windowId);const selected=waiting||run;if(selected?.tabId===sender.tab.id&&[selected.listingUrl,selected.applicationUrl,...selected.visitedUrls||[]].some(url=>sameApplicationUrl(url,state.metadata.jobLink)||sameApplicationUrl(url,state.url))){selected.applicationId||=state.applicationId;selected.phase='submitted';selected.step='review';selected.message=state.message;selected.epoch=(selected.epoch||0)+1;await save(selected);}}
  });
  const pendingKey=windowId=>`dock-apply-pending:v1:${windowId}`;
  function savePending(windowId){
    const task=(pendingWrites.get(windowId)||Promise.resolve()).then(()=>storage.set({[pendingKey(windowId)]:[...pendingRuns.values()].filter(run=>run.windowId===windowId)}));
    pendingWrites.set(windowId,task.catch(()=>{}));return task;
  }
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  async function windowFor(payload,sender) {
    if(!Number.isSafeInteger(payload.windowId)||payload.windowId<0||sender.tab&&sender.tab.windowId!==payload.windowId)fail('INVALID_REQUEST','Use the current browser window.');
    const window=await browser.windows.get(payload.windowId);if(window.type&&window.type!=='normal')fail('INVALID_REQUEST','Open the dock in a normal browser window.');return payload.windowId;
  }
  async function load(windowId) {
    if(!runs.has(windowId)) {
      const key=`dock-apply-run:v1:${windowId}`,saved=await storage.get([key,pendingKey(windowId)]),run=saved[key]||null;
      for(const waiting of saved[pendingKey(windowId)]||[])if(waiting.windowId===windowId&&waiting.phase==='submission-pending'&&waiting.id!==run?.id)pendingRuns.set(waiting.id,waiting);
      if(run&&['filling','drafting'].includes(run.phase)){run.phase='paused';run.message='The run was interrupted. Resume to rescan the current page.';}
      if(!runs.has(windowId))runs.set(windowId,run);
    }
    return runs.get(windowId);
  }
  async function save(run) {
    run.updatedAt=new Date().toISOString();
    if(pendingRuns.has(run.id)){if(run.phase!=='submission-pending')pendingRuns.delete(run.id);await savePending(run.windowId);}
    else if(runs.get(run.windowId)?.id===run.id)await storage.set({[`dock-apply-run:v1:${run.windowId}`]:run});
  }
  const current=(run,epoch=run.epoch)=>(runs.get(run.windowId)?.id===run.id||pendingRuns.has(run.id))&&active(run)&&!['paused','error'].includes(run.phase)&&run.epoch===epoch;
  async function queueState(sender) {return records.handle('DOCK_RECORDS_STATE',{},sender);}
  const preparedResume=job=>!!job.resume?.snapshot&&job.resume.inputRevision===job.inputRevision;
  async function applicationJob(id,sender) {
    const data=await queueState(sender),job=data.jobs.find(item=>item.id===id);
    if(!job)fail('JOB_UNAVAILABLE','Select a current job from Job Queues.');
    const candidate=await profiles.get(job.candidateId);
    if(!candidate||data.candidate?.id!==candidate.id)fail('CANDIDATE_CONFLICT','Select this job’s profile before applying.');
    return {job,candidate};
  }
  async function profileApplication(tab){
    const candidate=await profiles.bootstrap();
    if(!candidate?.profile)fail('PROFILE_REQUIRED','Create or upload your profile in Settings before autofilling.');
    return {candidate,job:{id:null,candidateId:candidate.id,company:'',role:tab.title||'Current application',url:tab.url||tab.pendingUrl,inputRevision:0,resume:null,coverLetterRaw:'',coverLetterEnabled:false}};
  }
  function publicRun(run) {
    if(!run)return null;
    const {id,jobId,candidateId,candidateRevision,company,role,resumeVersion,phase,step,message,windowId,tabId,targetUrl,fields,questions,drafts,options,applicationId,updatedAt,listingUrl,applicationUrl,visitedUrls,pageRevision,trackingOnly,pendingSubmission,warnings,profileOnly}=run;
    return {id,jobId,candidateId,candidateName:profileName(run.profile),candidateRevision,company,role,resumeVersion,phase,step,message,windowId,tabId,targetUrl,fields,questions,drafts,options,applicationId,updatedAt,listingUrl,applicationUrl,visitedUrls,pageRevision,trackingOnly,warnings,profileOnly,submissionStartedAt:pendingSubmission?.at,submissionConfirmed:pendingSubmission?.status==='confirmed',hasNextPage:run.frames?.some(frame=>frame.nextAvailable),canSubmit:run.frames?.filter(frame=>frame.submitAvailable).length===1};
  }
  async function state(windowId,sender) {
    const [data,candidates,run,tabs,saved]=await Promise.all([queueState(sender),profiles.list(),load(windowId),browser.tabs.query({windowId}),browser.storage.local.get(AUTOFILL_SETTINGS_KEY)]);
    return {candidate:data.candidate,candidates,jobs:data.jobs.filter(job=>job.status==='Ready'&&job.resume?.snapshot&&job.resume.inputRevision===job.inputRevision),run:publicRun(run),pendingSubmissions:[...pendingRuns.values()].filter(run=>run.windowId===windowId).map(publicRun),
      tabs:tabs.filter(tab=>Number.isSafeInteger(tab.id)&&safeJobUrl(tab.url)).map(tab=>({id:tab.id,title:tab.title||tab.url,url:tab.url,active:!!tab.active})),submission:await submissions.current(windowId,tabs),defaults:autofillPreferences(saved[AUTOFILL_SETTINGS_KEY])};
  }
  async function target(run) {
    const tab=await browser.tabs.get(run.tabId).catch(()=>null);
    if(!tab||tab.windowId!==run.windowId||!safeJobUrl(tab.url))fail('TAB_UNAVAILABLE','The employer tab is closed or unavailable. Cancel this run and select an application tab.');
    if(run.listingUrl&&!isApplicationTransition(run,tab.url))fail('DIFFERENT_JOB','This tab now shows a different job. Select that job before filling.');
    return tab;
  }
  async function send(run,frame,action,extra={},epoch=run.epoch) {
    await target(['cancel','pause'].includes(action)?{...run,phase:'paused'}:run);
    const reply=await browser.tabs.sendMessage(run.tabId,{target:'dock-apply-form:v1',runId:`${run.id}:${epoch||0}`,action,...run.trackingToken?{trackingToken:run.trackingToken}:{},...extra},frame.documentId?{documentId:frame.documentId}:{frameId:frame.frameId});
    if(!reply?.ok)fail('FORM_ACTION_FAILED',reply?.error||'The employer page changed. Rescan to reconnect.');return reply.result;
  }
  async function frames(run) {
    const tab=await target(run);if(tab.status==='loading')fail('PAGE_LOADING','Wait for the employer page to finish loading, then rescan.');
    const injected=await browser.scripting.executeScript({target:{tabId:run.tabId,allFrames:true},files:['content-scripts/dock-apply.js']});
    return injected.map(({frameId,documentId})=>({frameId,documentId}));
  }
  function merge(run,scans) {
    scans=scans.filter(({result})=>employerForm(result));
    run.frames=scans.map(({frame,result})=>({...frame,url:result.url,nextAvailable:result.nextAvailable,submitAvailable:result.submitAvailable}));
    run.fields=scans.flatMap(({frame,result})=>(result.fields||[]).slice(0,500).map(field=>({...field,key:fieldKey(frame,field),frameId:frame.frameId,documentId:frame.documentId}))).slice(0,500);
    run.questions=run.fields.filter(field=>!field.filled||Object.hasOwn(run.drafts||{},field.key));
    run.targetUrl=scans.find(item=>item.frame.frameId===0)?.result.url||run.targetUrl;
    run.confirmedSubmission=scans.some(item=>item.result.success);
    run.receipt=scans.map(item=>item.result.receipt).find(Boolean)||null;
    run.formErrors=scans.map(item=>item.result.errors).filter(Boolean).join(' ').slice(0,800);
  }
  async function scan(run,bind=false,epoch=run.epoch) {
    const list=bind?await frames(run):run.frames||[];const scans=[];
    for(const frame of list){if(!current(run,epoch))return;try{scans.push({frame,result:await send(run,frame,bind?'bind':'scan',{profile:run.profile},epoch)});}catch(error){if(frame.frameId===0)throw error;}}
    if(current(run,epoch))merge(run,scans);
  }
  async function pdf(job) {
    const cacheKey=`${job.id}:${job.inputRevision}:${job.resume.version}:${job.resume.savedAt}`;
    if(!pdfs.has(cacheKey))pdfs.set(cacheKey,Promise.resolve(renderSnapshot({...job.resume.snapshot,workspaceId:`dock-apply:${job.id}:${job.resume.version}`})).then(rendered=>{
      const result=rendered?.stale?null:rendered?.result??rendered;
      if(!result?.base64||result.base64.length>24*1024*1024)fail('PDF_FAILED','The prepared PDF could not be rendered.');return {resumeBase64:result.base64,fileName:applicationPDFFilename(job.candidateName,'resume')};
    }).catch(error=>{pdfs.delete(cacheKey);throw error;}));
    while(pdfs.size>8)pdfs.delete(pdfs.keys().next().value);
    return pdfs.get(cacheKey);
  }
  async function approved(run) {
    if(!run.options.reuse)return {};
    const saved=(await storage.get(`dock-approved-answers:v1:${run.candidateId}`))[`dock-approved-answers:v1:${run.candidateId}`]||{};
    const values=Object.fromEntries(Object.entries(saved).filter(([,value])=>value.candidateRevision===run.candidateRevision&&(!value.jobId||value.jobId===run.jobId&&value.inputRevision===run.inputRevision)).map(([key,value])=>[key,value.answer]));
    const question=value=>normalized(value).replace(/[\s*:]+$/,'');
    for(const field of run.fields){const answer=(run.customAnswers||[]).find(item=>question(item.question)===question(field.label));if(typeof answer?.answer==='string'&&answer.answer.trim())values[`${field.type}:${normalized(field.label)}`]=answer.answer.trim();}
    return values;
  }
  async function currentOptions(run){const saved=autofillPreferences((await browser.storage.local.get(AUTOFILL_SETTINGS_KEY))[AUTOFILL_SETTINGS_KEY]);run.options={...saved,...run.optionOverrides,...run.profileOnly?{record:false}:{}};}
  async function rememberDrafts(run){
    if(!run.options.saveAnswers)return;
    const entries=run.fields.filter(field=>field.filled&&!['file','checkbox'].includes(field.type)&&typeof run.drafts[field.key]==='string'&&run.drafts[field.key].trim());if(!entries.length)return;
    const key=`dock-approved-answers:v1:${run.candidateId}`,saved=(await storage.get(key))[key]||{};
    for(const field of entries)saved[`${field.type}:${normalized(field.label)}`]={answer:run.drafts[field.key].trim(),candidateRevision:run.candidateRevision,...field.kind==='ai'?{jobId:run.jobId,inputRevision:run.inputRevision}:{}};
    await storage.set({[key]:saved});
  }
  async function completeFill(run) {
    if(!current(run))return;
    const required=run.fields.filter(field=>field.required&&!field.filled);
    run.phase=run.fields.length&&!required.length?'ready':'questions';run.step='autofill';
    run.message=run.fields.length?(required.length?'Review the remaining required fields.':'Review the employer page before submitting.'):'No standard form fields were found. Open the application form, then rescan. Custom controls can be completed on the employer page.';
    await save(run);
  }
  async function drive(run,bind=true) {
    const epoch=run.epoch;
    try {
      await scan(run,bind,epoch);if(!current(run,epoch))return;
      await currentOptions(run);if(!current(run,epoch))return;
      const answers=await approved(run),letterEnabled=run.job.resume?.coverLetterEnabled??run.job.coverLetterEnabled,letterText=letterEnabled===false?'':run.job.resume?.coverLetterRaw||run.job.coverLetterRaw||'';
      run.warnings=[];
      async function fillFrames(documents={},documentsOnly=false){
        const scans=[];
        for(const frame of run.frames){if(!current(run,epoch))return;
          const selectedIds=documentsOnly?[]:run.selection?.filter(key=>key.startsWith(`${frame.documentId||frame.frameId}:`)).map(key=>key.slice(key.indexOf(':')+1));
          const edits=Object.fromEntries(run.fields.filter(field=>field.frameId===frame.frameId&&field.documentId===frame.documentId&&Object.hasOwn(run.drafts,field.key)).map(field=>[field.id,run.drafts[field.key]]));
          const overwriteIds=documentsOnly?[]:run.fields.filter(field=>field.frameId===frame.frameId&&field.documentId===frame.documentId&&run.overwriteFields?.includes(field.key)).map(field=>field.id);
          scans.push({frame,result:await send(run,frame,'fill',{profile:run.profile,answers,selectedIds,edits,overwriteIds,...documents},epoch)});
        }
        if(current(run,epoch))merge(run,scans);
      }
      // Fill known answers before waiting for any document rendering.
      await fillFrames({coverLetter:letterText?{text:letterText}:null});if(!current(run,epoch))return;await save(run);
      const needsResume=run.fields.some(field=>field.type==='file'&&!field.filled&&/resume|\bcv\b/i.test(field.label)),needsLetter=run.fields.some(field=>!field.filled&&/cover.?letter/i.test(field.label));
      const original=run.profile.resumeData;
      const resumeTask=!needsResume?null:preparedResume(run.job)?pdf(run.job):original?.resumeBase64&&original.fileName?Promise.resolve({resumeBase64:original.resumeBase64,fileName:original.fileName}):null;
      const [resume,coverLetter]=await Promise.allSettled([resumeTask,needsLetter?renderCoverLetter(run.job):null]);if(!current(run,epoch))return;
      if(resume.status==='rejected')run.warnings.push('Resume could not be attached. Attach it on the employer page.');
      if(coverLetter.status==='rejected')run.warnings.push('Cover letter could not be attached. Attach it on the employer page.');
      const documents={resume:resume.status==='fulfilled'?resume.value:null,coverLetter:coverLetter.status==='fulfilled'?coverLetter.value:letterText?{text:letterText}:null};
      if(documents.resume||documents.coverLetter)await fillFrames(documents,true);
      for(const field of run.fields.filter(field=>field.type==='file'&&!field.filled)){
        const provided=/cover.?letter/i.test(field.label)?documents.coverLetter?.resumeBase64:/resume|\bcv\b/i.test(field.label)?documents.resume?.resumeBase64:null;
        if(field.uploadError)run.warnings.push(`${field.label}: ${field.uploadError}`);
        else if(provided)run.warnings.push(`${field.label}: the page did not accept this upload. Check the document field on the employer page.`);
      }
      if(current(run,epoch)){await rememberDrafts(run);await completeFill(run);}
    } catch(error){if(current(run,epoch)){run.phase='error';run.message=error.message;await save(run);}}
  }
  function launch(run,bind=true) {const task=drive(run,bind);tasks.set(run.id,task);task.finally(()=>{if(tasks.get(run.id)===task)tasks.delete(run.id);}).catch(()=>{});}
  async function record(run,sender) {
    if(run.applicationId)return;
    if(run.recordRequest){const result=await records.handle('DOCK_RECORDS_MUTATE',run.recordRequest,sender);run.applicationId=result.selectedId;return;}
    const {job,candidate}=await applicationJob(run.jobId,sender);
    if(job.inputRevision!==run.inputRevision||(job.resume?.version??null)!==run.resumeVersion||candidate.revision!==run.candidateRevision)fail('RUN_STALE','The job, profile or prepared resume changed. Review a new run before recording.');
    run.recordRequest={action:'apply',submissionConfirmed:true,type:'queue',id:job.id,expectedRevision:job.revision,expectedCandidateRevision:run.candidateRevision,expectedResumeVersion:run.resumeVersion,expectedInputRevision:run.inputRevision,mutationId:run.recordMutationId};await save(run);
    const result=await records.handle('DOCK_RECORDS_MUTATE',run.recordRequest,sender);
    run.applicationId=result.selectedId;
  }
  function initializeTracking(run){
    run.trackingToken||=crypto.randomUUID();run.listingUrl||=run.job.url;run.applicationUrl||=run.targetUrl;
    run.visitedUrls||=[run.targetUrl];run.pageRevision||=0;
  }
  function visit(run,url){
    if(run.targetUrl!==url)run.pageRevision=(run.pageRevision||0)+1;
    run.targetUrl=url;run.visitedUrls=[...new Set([...(run.visitedUrls||[]),url])].slice(-50);
  }
  async function observe(run){
    initializeTracking(run);const before=run.targetUrl;
    await scan(run,true);if(!active(run))return;
    visit(run,run.targetUrl);if(before!==run.targetUrl)run.pageRevision++;
    run.questions=run.fields.filter(field=>!field.filled);await save(run);
  }
  async function finishSubmission(run,sender){
    if(run.phase==='submitted')return;
    await currentOptions(run);
    run.pendingSubmission.status='confirmed';run.message='Application submitted. Saving the application record…';await save(run);
    if(run.options.record)await record(run,sender);
    run.phase='submitted';run.step='review';run.message=run.options.record?'Submission recorded in Applications.':'Application submitted.';await save(run);
  }
  async function pageEvent(run,event,sender){
    if(!run||!active(run)||sender.id!==browser.runtime.id||!sender.tab||!applicationUrl(sender.url)||applicationUrl(event.url)?.origin!==applicationUrl(sender.url).origin)return {watch:false};
    // Chrome can retain the content script's initial sender.url after pushState.
    // The top tab URL is current; documentId below still binds the sender.
    // Chrome may already report the destination tab URL when the bound source
    // document's click reaches the worker. Validate its document/token below;
    // retaining that intent is what authorizes the application handoff.
    if(!sender.frameId&&event.kind!=='intent'&&event.url!==(sender.tab.url||sender.url))return {watch:false};
    initializeTracking(run);
    const child=sender.tab.id!==run.tabId&&sender.tab.openerTabId===run.tabId&&run.navigationIntent?.kind==='apply';
    if(sender.tab.id!==run.tabId&&!child)return {watch:false};
    if(event.kind==='ready'){
      if(sender.frameId&&sender.frameId!==0){
        if(!child&&sender.tab.id===run.tabId&&!['filling','drafting','paused'].includes(run.phase)){
          await observe(run);
          const pending=run.pendingSubmission;
          if(pending&&pending.frameId===sender.frameId&&Date.now()-pending.at<300000&&!run.formErrors&&isApplicationTransition({...run,listingUrl:pending.fromUrl,applicationUrl:pending.fromUrl,visitedUrls:[pending.fromUrl]},event.url)&&(run.receipt&&run.receipt.text!==pending.baseline||confirmationRoute(event.url)))await finishSubmission(run,sender);
        }
        return {watch:run.phase!=='submitted'};
      }
      if(!isApplicationTransition(run,event.url)){
        run.phase='paused';run.message='This tab shows another page. Select its job before filling.';run.epoch++;await save(run);return {watch:false};
      }
      if(child)run.tabId=sender.tab.id;
      visit(run,event.url);if(['filling','drafting','paused'].includes(run.phase))return {watch:false};
      await observe(run);
      if(run.pendingSubmission&&Date.now()-run.pendingSubmission.at<300000&&!run.formErrors&&(run.receipt&&run.receipt.text!==run.pendingSubmission.baseline||confirmationRoute(event.url)))await finishSubmission(run,sender);
      else if(run.phase!=='submission-pending'){run.phase='questions';run.message='Application page updated. Autofill is available when you choose it.';await save(run);}
      return {watch:run.phase!=='submitted'};
    }
    const frame=run.frames?.find(frame=>sender.documentId?frame.documentId===sender.documentId:frame.frameId===(sender.frameId||0));
    if(event.runId!==`${run.id}:${run.epoch||0}`||event.token!==run.trackingToken||!frame||run.phase==='paused')return {watch:false};
    if(sender.frameId&&!isApplicationTransition({...run,listingUrl:frame.url,applicationUrl:frame.url,visitedUrls:[frame.url],targetUrl:frame.url},event.url))return {watch:false};
    if(event.kind==='intent'){
      if(!['apply','next','submit'].includes(event.action))return {watch:true};
      if(!isApplicationTransition(run,sender.frameId?sender.tab.url||run.targetUrl:event.url))return {watch:false};
      run.navigationIntent={kind:event.action,fromUrl:event.url,targetUrl:applicationUrl(event.targetUrl)?.href||null,at:Date.now()};
      if(event.action==='submit'){
        if(!run.pendingSubmission||run.phase!=='submission-pending'||event.attemptId&&event.attemptId!==run.pendingSubmission.id)run.pendingSubmission={id:typeof event.attemptId==='string'&&/^[\w-]{1,128}$/.test(event.attemptId)?event.attemptId:crypto.randomUUID(),at:Number.isFinite(event.at)&&Math.abs(Date.now()-event.at)<2000?event.at:Date.now(),fromUrl:event.url,frameId:sender.frameId||0,baseline:event.receipt?.text||'',status:'pending'};
        run.phase='submission-pending';run.step='review';run.message='Waiting for the employer’s submission confirmation.';
      }else run.message=event.action==='apply'?'Opening this job’s application…':'Moving to the next application step…';
      await save(run);return {watch:true};
    }
    if(event.kind==='network'){
      if(run.phase==='submission-pending'&&run.pendingSubmission&&validateWorkdaySubmission(event.proof,run.pendingSubmission))await finishSubmission(run,sender);
      return {watch:run.phase!=='submitted'};
    }
    if(event.kind==='invalid'||event.errors){
      run.pendingSubmission=null;run.phase='questions';run.message=String(event.errors||'Review the employer form errors.').slice(0,800);await save(run);return {watch:true};
    }
    if(event.kind==='state'){
      const topUrl=sender.frameId?sender.tab.url||run.targetUrl:event.url;
      if(!isApplicationTransition(run,topUrl)){
        run.phase='paused';run.message='This tab now shows a different job. Select it before filling.';run.epoch++;await save(run);return {watch:false};
      }
      const result=event.scan;
      if(!result||result.url!==event.url||!Array.isArray(result.fields)||result.fields.length>500)return {watch:true};
      const scans=(run.frames||[]).map(known=>({frame:known,result:known===frame?result:{url:known.url,fields:run.fields.filter(field=>field.documentId===known.documentId&&field.frameId===known.frameId),nextAvailable:known.nextAvailable,submitAvailable:known.submitAvailable}}));
      const oldKeys=run.fields.map(field=>field.key).join('|'),oldUrl=run.targetUrl;
      merge(run,scans);visit(run,topUrl);if(oldUrl!==topUrl||oldKeys!==run.fields.map(field=>field.key).join('|'))run.pageRevision++;
      if(run.pendingSubmission&&(run.pendingSubmission.frameId||0)===(sender.frameId||0)&&Date.now()-run.pendingSubmission.at<300000&&(event.receipt&&event.receipt.text!==run.pendingSubmission.baseline||confirmationRoute(event.url)))await finishSubmission(run,sender);
      else{if(run.phase!=='submission-pending'&&!['filling','drafting'].includes(run.phase)){run.phase='questions';run.message='Application fields updated. Fill them when ready.';}await save(run);}
    }
    return {watch:run.phase!=='submitted'};
  }
  async function action(run,payload,sender) {
    if(!run||run.id!==payload.runId)fail('STALE_RUN','This run is no longer current. Reload the Apply to Job view.');
    const name=payload.action;if(!['open','pause','cancel','confirm-submission','resume','rescan','refill','fill-answer'].includes(name))fail('INVALID_REQUEST','Unsupported autofill action.');
    if(name==='open'){await target(run);await browser.tabs.update(run.tabId,{active:true});return;}
    if(name==='pause'||name==='cancel') {
      if(run.phase==='submitted'||run.phase==='submission-pending')fail('INVALID_STATE','Check the employer submission before starting another run.');
      const epoch=run.epoch;run.epoch=(run.epoch||0)+1;run.phase=name==='pause'?'paused':'cancelled';run.message=name==='pause'?'Autofill paused. Values already filled remain on the employer page.':'Run cancelled. No further fields will be filled.';await save(run);
      await Promise.allSettled((run.frames||[]).map(frame=>send(run,frame,name,{},epoch)));return;
    }
    if(name==='confirm-submission') {
      if(run.phase==='submitted')return;
      if(!['ready','questions','submission-pending'].includes(run.phase))fail('INVALID_STATE','Review the employer application before confirming submission.');
      await currentOptions(run);if(run.options.record)await record(run,sender);
      if(run.pendingSubmission)run.pendingSubmission.status='confirmed';
      run.phase='submitted';run.step='review';run.message=run.options.record?'Submission recorded in Applications.':'Submission confirmed. Application recording was switched off.';await save(run);return;
    }
    if(name==='resume'||name==='rescan'||name==='refill') {
      if(['submitted','cancelled','submission-pending'].includes(run.phase))fail('INVALID_STATE','This run can no longer fill fields.');
      const latest=run.profileOnly?await profileApplication(await target(run)):await applicationJob(run.jobId,sender);run.profile=structuredClone(latest.candidate.profile);run.candidateRevision=latest.candidate.revision;run.job=structuredClone(latest.job);run.inputRevision=latest.job.inputRevision;run.resumeVersion=latest.job.resume?.version??null;
      run.customAnswers=structuredClone(latest.candidate.document?.customAnswers||[]);
      run.trackingOnly=false;run.selection=Array.isArray(payload.fieldKeys)?payload.fieldKeys.slice(0,500):null;
      run.overwriteFields=payload.answers&&typeof payload.answers==='object'?Object.keys(payload.answers).slice(0,500):[];
      if(payload.answers&&typeof payload.answers==='object')for(const [key,value]of Object.entries(payload.answers).slice(0,500))if(typeof value==='string')run.drafts[key]=value.slice(0,10000);
      run.epoch=(run.epoch||0)+1;run.phase='filling';run.message='Scanning the employer form…';await save(run);launch(run,true);return;
    }
    if(!current(run)||run.phase==='submission-pending')fail('INVALID_STATE','Resume or rescan this application before continuing.');
    const field=run.questions.find(item=>item.key===payload.fieldKey);
    if(!field)fail('QUESTION_CHANGED','Select a current question after rescanning.');
    if(name==='fill-answer') {
      await currentOptions(run);
      const answer=String(payload.answer||'').trim();if(!answer||answer.length>10000)fail('INVALID_ANSWER','Enter an answer up to 10,000 characters.');
      const epoch=run.epoch,result=await send(run,field,'answer',{fieldId:field.id,label:field.label,answer});
      if(!current(run,epoch))return;run.drafts[field.key]=answer;
      const scans=run.frames.map(frame=>({frame,result:frame.frameId===field.frameId&&frame.documentId===field.documentId?result:{url:frame.url,fields:run.fields.filter(item=>item.frameId===frame.frameId&&item.documentId===frame.documentId),nextAvailable:frame.nextAvailable,submitAvailable:frame.submitAvailable}}));
      merge(run,scans);run.drafts[field.key]=answer;
      const filled=run.fields.find(item=>item.key===field.key)?.filled;
      if(filled&&run.options.saveAnswers&&(field.kind==='ai'||payload.remember===true)) {
        const key=`dock-approved-answers:v1:${run.candidateId}`,saved=(await storage.get(key))[key]||{};
        saved[`${field.type}:${normalized(field.label)}`]={answer,candidateRevision:run.candidateRevision,...field.kind==='ai'?{jobId:run.jobId,inputRevision:run.inputRevision}:{}};await storage.set({[key]:saved});
      }
      await completeFill(run);return;
    }
    fail('INVALID_REQUEST','Unsupported application action.');
  }
  async function handle(operation,payload,sender) {
    const windowId=await windowFor(payload,sender),run=await load(windowId);
    if(operation==='DOCK_APPLY_EVENT'){
      if(payload.event?.kind?.startsWith('speedy-'))return submissions.handle(payload.event,sender,windowId);
      const event=payload.event||{},waiting=[...pendingRuns.values()].find(item=>item.windowId===windowId&&item.tabId===sender.tab?.id&&(!event.runId||event.runId===`${item.id}:${item.epoch||0}`));
      return pageEvent(waiting||run,event,sender);
    }
    if(operation==='DOCK_APPLY_STATE')return state(windowId,sender);
    if(operation==='DOCK_APPLY_PROFILE') {
      if(!['PROFILE_STATE','PROFILE_SAVE','PROFILE_RESUME_PREVIEW','PROFILE_RESUME_IMPORT'].includes(payload.action))fail('INVALID_REQUEST','Unknown profile action.');
      return profileService.handle(payload.action,payload);
    }
    if(operation==='DOCK_APPLY_INSPECT') {
      const tabs=await browser.tabs.query({windowId}),activeTab=tabs.find(item=>item.active&&safeJobUrl(item.url)&&!['chatgpt.com','chat.deepseek.com'].includes(new URL(item.url).hostname));
      const selected=payload.jobId?await applicationJob(payload.jobId,sender):null;
      const fallback=Number.isSafeInteger(payload.fallbackTabId)?await browser.tabs.get(payload.fallbackTabId).catch(()=>null):null;
      const tab=Number.isSafeInteger(payload.tabId)?await browser.tabs.get(payload.tabId):activeTab||fallback||(selected?tabs.find(item=>sameApplicationUrl(item.url,selected.job.url)):null);
      if(!tab)return {fields:[],tabId:null};
      if(tab.windowId!==windowId||!safeJobUrl(tab.url))fail('INVALID_TAB','Inspect an employer tab in this browser window.');
      const inspection={id:'inspect',windowId,tabId:tab.id},fields=[],candidate=await profiles.bootstrap();let submissionConfirmed=false;
      for(const frame of await frames(inspection)) {
        try {const result=await send(inspection,frame,'inspect',{profile:candidate?.profile||{}});if(employerForm(result)){submissionConfirmed||=!!result.success&&!!result.receipt;fields.push(...(result.fields||[]).slice(0,500).map(field=>({...field,key:fieldKey(frame,field),frameId:frame.frameId,documentId:frame.documentId})));}}
        catch(error){if(frame.frameId===0)throw error;}
      }
      return {fields:fields.slice(0,500),tabId:tab.id,url:tab.url,submissionConfirmed};
    }
    if(operation==='DOCK_APPLY_START'||operation==='DOCK_APPLY_TRACK') {
      const tracking=operation==='DOCK_APPLY_TRACK',profileOnly=payload.profileOnly===true;
      if(tracking&&profileOnly)fail('INVALID_REQUEST','Profile autofill starts only when Autofill is clicked.');
      if(tracking&&active(run)&&(run.jobId===payload.jobId&&run.tabId===payload.tabId||['filling','drafting','submission-pending'].includes(run.phase)))return state(windowId,sender);
      if(!tracking&&active(run)&&payload.replaceRunId!==run.id)fail('RUN_ACTIVE','The active autofill changed. Click Autofill again to switch to this page.');
      let tab=payload.tabId?await browser.tabs.get(payload.tabId):null;
      if(profileOnly&&!tab)tab=(await browser.tabs.query({windowId,active:true})).find(item=>safeJobUrl(item.url)&&!['chatgpt.com','chat.deepseek.com'].includes(new URL(item.url).hostname));
      if(profileOnly&&(!tab||tab.windowId!==windowId||!safeJobUrl(tab.url||tab.pendingUrl)))fail('INVALID_TAB','Open an employer application page in this browser window.');
      const {job,candidate}=profileOnly?await profileApplication(tab):await applicationJob(payload.jobId,sender);
      const options=autofillPreferences((await browser.storage.local.get(AUTOFILL_SETTINGS_KEY))[AUTOFILL_SETTINGS_KEY]);for(const name of Object.keys(defaults))if(typeof payload.options?.[name]==='boolean')options[name]=payload.options[name];
      if(profileOnly)options.record=false;
      tab||=await browser.tabs.create({windowId,url:job.url,active:true});
      if(tab.windowId!==windowId||!safeJobUrl(tab.url||tab.pendingUrl))fail('INVALID_TAB','Choose an employer tab in this browser window.');
      if(tracking&&!sameApplicationUrl(job.url,tab.url||tab.pendingUrl))return state(windowId,sender);
      const savedIdentity=applicationIdentity(job.url),pageIdentity=applicationIdentity(tab.url||tab.pendingUrl);
      if(!tracking&&savedIdentity&&pageIdentity&&savedIdentity.provider!=='page'&&savedIdentity.provider===pageIdentity.provider&&savedIdentity.key!==pageIdentity.key)fail('DIFFERENT_JOB','This form belongs to another job. Select its saved record before filling.');
      if(active(run)){
        // Validate the new binding before retiring its old observation. Values
        // already entered on the old employer page remain untouched.
        if(run.phase==='submission-pending'){
          pendingRuns.set(run.id,run);await savePending(windowId);
        }else{
          const previousEpoch=run.epoch;run.phase='cancelled';run.epoch++;await save(run);
          await Promise.allSettled((run.frames||[]).map(frame=>send(run,frame,'cancel',{},previousEpoch)));
        }
      }
      const next={id:crypto.randomUUID(),windowId,jobId:job.id,profileOnly,candidateId:candidate.id,candidateRevision:candidate.revision,inputRevision:job.inputRevision,resumeVersion:job.resume?.version??null,company:job.company,role:job.role,job:structuredClone(job),profile:structuredClone(candidate.profile),
        phase:'filling',epoch:0,step:'autofill',message:'Scanning the employer form…',tabId:tab.id,targetUrl:tab.url||tab.pendingUrl,fields:[],questions:[],frames:[],drafts:{},options,recordMutationId:crypto.randomUUID()};
      next.customAnswers=structuredClone(candidate.document?.customAnswers||[]);next.optionOverrides=Object.fromEntries(Object.keys(defaults).filter(key=>typeof payload.options?.[key]==='boolean').map(key=>[key,payload.options[key]]));
      next.selection=Array.isArray(payload.fieldKeys)?payload.fieldKeys.slice(0,500):null;
      next.overwriteFields=payload.answers&&typeof payload.answers==='object'?Object.keys(payload.answers).slice(0,500):[];
      if(payload.answers&&typeof payload.answers==='object')for(const [key,value]of Object.entries(payload.answers).slice(0,500))if(typeof value==='string')next.drafts[key]=value.slice(0,10000);
      // A manually selected form is also an explicit application entry point.
      initializeTracking(next);next.trackingOnly=tracking;
      runs.set(windowId,next);
      if(tracking){next.phase='questions';next.message='Application linked. Fill the form when ready.';await save(next);if(tab.status!=='loading'&&applicationUrl(tab.url))await observe(next);}
      else{await save(next);launch(next);}
      return state(windowId,sender);
    }
    if(operation==='DOCK_APPLY_ACTION'){const requested=pendingRuns.get(payload.runId);await action(requested?.windowId===windowId?requested:run,payload,sender);return state(windowId,sender);}
    fail('INVALID_REQUEST','Unsupported dock application request.');
  }
  return {handle(operation,payload,sender){
    if(['DOCK_APPLY_START','DOCK_APPLY_TRACK'].includes(operation)){const result=starts.then(()=>handle(operation,payload,sender));starts=result.catch(()=>{});return result;}
    if(operation==='DOCK_APPLY_EVENT'||operation==='DOCK_APPLY_ACTION'&&!['pause','cancel'].includes(payload.action)){const previous=actions.get(payload.windowId)||Promise.resolve(),result=previous.then(()=>handle(operation,payload,sender));actions.set(payload.windowId,result.catch(()=>{}));return result;}
    return handle(operation,payload,sender);
  },async settled(windowId){const run=await load(windowId);await tasks.get(run?.id);return publicRun(run);},async closeWindow(windowId){const run=runs.get(windowId);if(run){run.phase='cancelled';run.epoch=(run.epoch||0)+1;}for(const [id,waiting]of pendingRuns)if(waiting.windowId===windowId)pendingRuns.delete(id);await pendingWrites.get(windowId);runs.set(windowId,null);await submissions.closeWindow(windowId);await storage.remove([`dock-apply-run:v1:${windowId}`,pendingKey(windowId),`dock-apply-ui:v1:${windowId}`,`dock-apply-import:v1:${windowId}`]);}};
}
