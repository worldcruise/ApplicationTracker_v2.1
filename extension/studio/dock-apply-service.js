import { safeJobUrl } from './reference-dashboard-data.js';
import { normalizeProfile, profileName } from './profile-model.js';
import {profileFromQueueResume,profileImportReview} from './queue-resume-import.js';

export const DOCK_APPLY_OPERATIONS=['DOCK_APPLY_STATE','DOCK_APPLY_SELECT','DOCK_APPLY_START','DOCK_APPLY_ACTION','DOCK_APPLY_PDF','DOCK_APPLY_IMPORT'];
const active=run=>run&&!['cancelled','submitted'].includes(run.phase);
const normalized=value=>String(value||'').replace(/\s+/g,' ').trim().toLowerCase();
const defaults={reuse:true,reviewAI:true,autoNext:false,saveAnswers:true,record:true,autoSubmit:false};
const fieldKey=(frame,field)=>`${frame.documentId||frame.frameId}:${field.id}`;

export function createDockApplyService({browser,storage,profiles,records,renderSnapshot,parseResume,generateAnswer}) {
  const runs=new Map(),pdfs=new Map(),tasks=new Map(),actions=new Map();let starts=Promise.resolve();
  const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
  async function windowFor(payload,sender) {
    if(!Number.isSafeInteger(payload.windowId)||payload.windowId<0||sender.tab&&sender.tab.windowId!==payload.windowId)fail('INVALID_REQUEST','Use the current browser window.');
    const window=await browser.windows.get(payload.windowId);if(window.type&&window.type!=='normal')fail('INVALID_REQUEST','Open the dock in a normal browser window.');return payload.windowId;
  }
  async function load(windowId) {
    if(!runs.has(windowId)) {
      const run=(await storage.get(`dock-apply-run:v1:${windowId}`))[`dock-apply-run:v1:${windowId}`]||null;
      if(run&&['filling','drafting'].includes(run.phase)){run.phase='paused';run.message='The run was interrupted. Resume to rescan the current page.';}
      if(!runs.has(windowId))runs.set(windowId,run);
    }
    return runs.get(windowId);
  }
  async function save(run) {run.updatedAt=new Date().toISOString();await storage.set({[`dock-apply-run:v1:${run.windowId}`]:run});}
  const current=(run,epoch=run.epoch)=>runs.get(run.windowId)?.id===run.id&&active(run)&&!['paused','error'].includes(run.phase)&&run.epoch===epoch;
  async function queueState(sender) {return records.handle('DOCK_RECORDS_STATE',{},sender);}
  async function readyJob(id,sender) {
    const data=await queueState(sender),job=data.jobs.find(item=>item.id===id);
    if(!job||job.status!=='Ready'||!job.resume?.snapshot||job.resume.inputRevision!==job.inputRevision)fail('NOT_READY','Choose a job with a current, validated resume from Job Queues.');
    const candidate=await profiles.get(job.candidateId);
    if(!candidate||data.candidate?.id!==candidate.id)fail('CANDIDATE_CONFLICT','Select this job’s profile before applying.');
    return {job,candidate};
  }
  function publicRun(run) {
    if(!run)return null;
    const {id,jobId,candidateId,candidateRevision,company,role,resumeVersion,phase,step,message,windowId,tabId,targetUrl,fields,questions,drafts,options,applicationId,updatedAt}=run;
    return {id,jobId,candidateId,candidateName:profileName(run.profile),candidateRevision,company,role,resumeVersion,phase,step,message,windowId,tabId,targetUrl,fields,questions,drafts,options,applicationId,updatedAt,hasNextPage:run.frames?.some(frame=>frame.nextAvailable),canSubmit:run.frames?.filter(frame=>frame.submitAvailable).length===1};
  }
  async function state(windowId,sender) {
    const [data,candidates,run,tabs]=await Promise.all([queueState(sender),profiles.list(),load(windowId),browser.tabs.query({windowId})]);
    return {candidate:data.candidate,candidates,jobs:data.jobs,run:publicRun(run),
      tabs:tabs.filter(tab=>Number.isSafeInteger(tab.id)&&safeJobUrl(tab.url)).map(tab=>({id:tab.id,title:tab.title||tab.url,url:tab.url,active:!!tab.active})),defaults};
  }
  async function target(run) {
    const tab=await browser.tabs.get(run.tabId).catch(()=>null);
    if(!tab||tab.windowId!==run.windowId||!safeJobUrl(tab.url))fail('TAB_UNAVAILABLE','The employer tab is closed or unavailable. Cancel this run and select an application tab.');
    return tab;
  }
  async function send(run,frame,action,extra={},epoch=run.epoch) {
    await target(run);
    const reply=await browser.tabs.sendMessage(run.tabId,{target:'dock-apply-form:v1',runId:`${run.id}:${epoch||0}`,action,...extra},frame.documentId?{documentId:frame.documentId}:{frameId:frame.frameId});
    if(!reply?.ok)fail('FORM_ACTION_FAILED',reply?.error||'The employer page changed. Rescan to reconnect.');return reply.result;
  }
  async function frames(run) {
    const tab=await target(run);if(tab.status==='loading')fail('PAGE_LOADING','Wait for the employer page to finish loading, then rescan.');
    const injected=await browser.scripting.executeScript({target:{tabId:run.tabId,allFrames:true},files:['content-scripts/dock-apply.js']});
    return injected.map(({frameId,documentId})=>({frameId,documentId}));
  }
  function merge(run,scans) {
    run.frames=scans.map(({frame,result})=>({...frame,url:result.url,nextAvailable:result.nextAvailable,submitAvailable:result.submitAvailable}));
    run.fields=scans.flatMap(({frame,result})=>(result.fields||[]).slice(0,500).map(field=>({...field,key:fieldKey(frame,field),frameId:frame.frameId,documentId:frame.documentId}))).slice(0,500);
    run.questions=run.fields.filter(field=>!field.filled||Object.hasOwn(run.drafts||{},field.key));
    run.targetUrl=scans.find(item=>item.frame.frameId===0)?.result.url||run.targetUrl;
    run.confirmedSubmission=scans.some(item=>item.result.success);
  }
  async function scan(run,bind=false,epoch=run.epoch) {
    const list=bind?await frames(run):run.frames||[];const scans=[];
    for(const frame of list){if(!current(run,epoch))return;try{scans.push({frame,result:await send(run,frame,bind?'bind':'scan')});}catch(error){if(frame.frameId===0)throw error;}}
    if(current(run,epoch))merge(run,scans);
  }
  async function pdf(job) {
    const cacheKey=`${job.id}:${job.inputRevision}:${job.resume.version}:${job.resume.savedAt}`;
    if(!pdfs.has(cacheKey))pdfs.set(cacheKey,Promise.resolve(renderSnapshot({...job.resume.snapshot,workspaceId:`dock-apply:${job.id}:${job.resume.version}`})).then(result=>{
      if(!result?.base64||result.base64.length>24*1024*1024)fail('PDF_FAILED','The prepared PDF could not be rendered.');return {resumeBase64:result.base64,fileName:`${job.candidateName||'Candidate'}_${job.company}`.replace(/[<>:"/\\|?*\x00-\x1f]/g,'_').slice(0,170)+'.pdf'};
    }).catch(error=>{pdfs.delete(cacheKey);throw error;}));
    while(pdfs.size>8)pdfs.delete(pdfs.keys().next().value);
    return pdfs.get(cacheKey);
  }
  async function approved(run) {
    if(!run.options.reuse)return {};
    const saved=(await storage.get(`dock-approved-answers:v1:${run.candidateId}`))[`dock-approved-answers:v1:${run.candidateId}`]||{};
    return Object.fromEntries(Object.entries(saved).filter(([,value])=>value.candidateRevision===run.candidateRevision&&(!value.jobId||value.jobId===run.jobId&&value.inputRevision===run.inputRevision)).map(([key,value])=>[key,value.answer]));
  }
  async function completeFill(run) {
    if(!current(run))return;
    const required=run.fields.filter(field=>field.required&&!field.filled);
    run.phase=run.fields.length&&!required.length?'ready':'questions';run.step='autofill';
    run.message=run.fields.length?(required.length?'Review the remaining required fields.':'Review the employer page before submitting.'):'No standard form fields were found. Open the application form, then rescan. Custom controls can be completed on the employer page.';
    await save(run);
    if(run.options.autoNext&&!required.length&&run.frames.some(frame=>frame.nextAvailable)){
      const next=run.frames.find(frame=>frame.nextAvailable);await send(run,next,'next');run.message='Next page opened. Rescan when the form finishes loading.';run.phase='questions';await save(run);
    } else if(run.options.autoSubmit&&run.phase==='ready')await submit(run);
  }
  async function drive(run,bind=true) {
    const epoch=run.epoch;
    try {
      await scan(run,bind,epoch);if(!current(run,epoch))return;
      const resume=await pdf(run.job),answers=await approved(run);if(!current(run,epoch))return;
      const scans=[];
      for(const frame of run.frames){if(!current(run,epoch))return;scans.push({frame,result:await send(run,frame,'fill',{profile:run.profile,resume,answers})});}
      if(!current(run,epoch))return;merge(run,scans);await completeFill(run);
    } catch(error){if(current(run,epoch)){run.phase='error';run.message=error.message;await save(run);}}
  }
  function launch(run,bind=true) {const task=drive(run,bind);tasks.set(run.id,task);task.finally(()=>{if(tasks.get(run.id)===task)tasks.delete(run.id);}).catch(()=>{});}
  async function record(run,sender) {
    if(run.applicationId)return;
    if(run.recordRequest){const result=await records.handle('DOCK_RECORDS_MUTATE',run.recordRequest,sender);run.applicationId=result.selectedId;return;}
    const {job,candidate}=await readyJob(run.jobId,sender);
    if(job.inputRevision!==run.inputRevision||job.resume.version!==run.resumeVersion||candidate.revision!==run.candidateRevision)fail('RUN_STALE','The job, profile or prepared resume changed. Review a new run before recording.');
    run.recordRequest={action:'apply',type:'queue',id:job.id,expectedRevision:job.revision,expectedCandidateRevision:run.candidateRevision,expectedResumeVersion:run.resumeVersion,expectedInputRevision:run.inputRevision,mutationId:run.recordMutationId};await save(run);
    const result=await records.handle('DOCK_RECORDS_MUTATE',run.recordRequest,sender);
    run.applicationId=result.selectedId;
  }
  async function submit(run) {
    if(run.phase==='submission-pending'||run.phase==='submitted')return;
    await scan(run);if(!current(run))return;
    if(!run.fields.length||run.fields.some(field=>field.required&&!field.filled))fail('INCOMPLETE','Complete all required fields before submitting.');
    const available=run.frames.filter(frame=>frame.submitAvailable);if(available.length!==1)fail('MANUAL_SUBMISSION','Use Submit on the employer page, then confirm submission here.');
    // Persist before sending a click: an interrupted reply must not click twice.
    run.phase='submission-pending';run.step='review';run.message='Check the employer page for its submission confirmation.';await save(run);
    await send(run,available[0],'submit');
  }
  async function action(run,payload,sender) {
    if(!run||run.id!==payload.runId)fail('STALE_RUN','This run is no longer current. Reload the Apply to Job view.');
    const name=payload.action;
    if(name==='open'){await target(run);await browser.tabs.update(run.tabId,{active:true});return;}
    if(name==='pause'||name==='cancel') {
      if(run.phase==='submitted'||run.phase==='submission-pending')fail('INVALID_STATE','Check the employer submission before starting another run.');
      const epoch=run.epoch;run.epoch=(run.epoch||0)+1;run.phase=name==='pause'?'paused':'cancelled';run.message=name==='pause'?'Autofill paused. Values already filled remain on the employer page.':'Run cancelled. No further fields will be filled.';await save(run);
      await Promise.allSettled((run.frames||[]).map(frame=>send(run,frame,name,{},epoch)));return;
    }
    if(name==='confirm-submission') {
      if(run.phase==='submitted')return;
      if(!['ready','questions','submission-pending'].includes(run.phase))fail('INVALID_STATE','Review the employer application before confirming submission.');
      if(run.options.record)await record(run,sender);
      run.phase='submitted';run.step='review';run.message=run.options.record?'Submission recorded in Applications.':'Submission confirmed. Application recording was switched off.';await save(run);return;
    }
    if(name==='resume'||name==='rescan'||name==='refill') {
      if(['submitted','cancelled','submission-pending'].includes(run.phase))fail('INVALID_STATE','This run can no longer fill fields.');
      run.epoch=(run.epoch||0)+1;run.phase='filling';run.message='Scanning the employer form…';await save(run);launch(run,true);return;
    }
    if(!current(run)||run.phase==='submission-pending')fail('INVALID_STATE','Resume or rescan this application before continuing.');
    if(name==='review') {await scan(run);if(!run.fields.length||run.fields.some(field=>field.required&&!field.filled))fail('INCOMPLETE','Complete the required fields on the employer page, then rescan.');run.step='review';run.phase='ready';await save(run);return;}
    if(name==='back-to-fields'){run.step='autofill';await save(run);return;}
    if(name==='next-page'){const frame=run.frames.find(frame=>frame.nextAvailable);if(!frame)fail('MANUAL_NEXT','Use Next on the employer page, then rescan.');await send(run,frame,'next');run.phase='questions';run.message='Rescan after the next page finishes loading.';await save(run);return;}
    if(name==='submit'){await submit(run);return;}
    const field=run.questions.find(item=>item.key===payload.fieldKey);
    if(!field)fail('QUESTION_CHANGED','Select a current question after rescanning.');
    if(name==='draft') {
      if(field.kind!=='ai')fail('PERSONAL_FACT_REQUIRED','Enter this personal fact yourself.');
      const epoch=run.epoch;run.phase='drafting';await save(run);
      const task=(async()=>{try {const result=await generateAnswer({profile:run.profile,tabId:run.tabId,url:run.targetUrl,description:run.job.description,title:run.role,prompt:field.label});if(!current(run,epoch))return;run.drafts[field.key]=result;run.phase='questions';await save(run);if(!run.options.reviewAI)await action(run,{...payload,action:'fill-answer',answer:result},sender);}catch(error){if(current(run,epoch)){run.phase='questions';run.message=error.message;await save(run);}}})();
      tasks.set(run.id,task);task.finally(()=>{if(tasks.get(run.id)===task)tasks.delete(run.id);}).catch(()=>{});
      return;
    }
    if(name==='fill-answer') {
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
    if(operation==='DOCK_APPLY_STATE')return state(windowId,sender);
    if(operation==='DOCK_APPLY_SELECT') {
      if(active(run))fail('RUN_ACTIVE','Finish or cancel the current run before changing profiles.');await profiles.select(payload.candidateId);return state(windowId,sender);
    }
    if(operation==='DOCK_APPLY_PDF'){if(run&&payload.runId===run.id&&payload.jobId===run.jobId)return pdf(run.job);const {job}=await readyJob(payload.jobId,sender);return pdf(job);}
    if(operation==='DOCK_APPLY_START') {
      if(active(run))fail('RUN_ACTIVE','Finish or cancel the current run before starting another.');
      const {job,candidate}=await readyJob(payload.jobId,sender);
      if(job.isMock)fail('SAMPLE_JOB','Sample jobs are for preview. Add a real job to start autofill.');
      const options={...defaults};for(const name of Object.keys(defaults))if(typeof payload.options?.[name]==='boolean')options[name]=payload.options[name];
      const tab=payload.tabId?await browser.tabs.get(payload.tabId):await browser.tabs.create({windowId,url:job.url,active:true});
      if(tab.windowId!==windowId||!safeJobUrl(tab.url||tab.pendingUrl))fail('INVALID_TAB','Choose an employer tab in this browser window.');
      const next={id:crypto.randomUUID(),windowId,jobId:job.id,candidateId:candidate.id,candidateRevision:candidate.revision,inputRevision:job.inputRevision,resumeVersion:job.resume.version,company:job.company,role:job.role,job:structuredClone(job),profile:structuredClone(candidate.profile),
        phase:'filling',epoch:0,step:'autofill',message:'Scanning the employer form…',tabId:tab.id,targetUrl:tab.url||tab.pendingUrl,fields:[],questions:[],frames:[],drafts:{},options,recordMutationId:crypto.randomUUID()};
      runs.set(windowId,next);await save(next);launch(next);return state(windowId,sender);
    }
    if(operation==='DOCK_APPLY_IMPORT') {
      if(active(run))fail('RUN_ACTIVE','Finish or cancel the current run before updating a profile.');
      const data=await queueState(sender),selected=data.jobs.find(job=>job.id===payload.jobId),candidate=await profiles.get(data.candidate?.id);
      if(!selected||!candidate||selected.candidateId!==candidate.id)fail('NOT_FOUND','Select a job for the current candidate.');
      const job=selected;
      if(payload.action==='queue-json'){
        const {job:ready}=await readyJob(job.id,sender);
        const profile=profileFromQueueResume(candidate,ready,ready.isMock?null:await pdf(ready).then(file=>({resumeBase64:file.resumeBase64,fileName:file.fileName,fileSize:Math.floor(file.resumeBase64.length*3/4),dateUploaded:new Date().toISOString()})));
        if(ready.isMock)return {previewOnly:true,candidateId:candidate.id,...profileImportReview(profile)};
        const token=crypto.randomUUID();await storage.set({[`dock-apply-import:v1:${windowId}`]:{token,jobId:job.id,inputRevision:job.inputRevision,resumeVersion:job.resume.version,candidateId:candidate.id,candidateRevision:candidate.revision,profile}});
        return {token,candidateId:candidate.id,revision:candidate.revision,...profileImportReview(profile)};
      }
      if(payload.action==='parse') {
        if(typeof payload.base64!=='string'||payload.base64.length>8*1024*1024||!payload.base64||typeof payload.fileName!=='string'||!/^.{1,180}\.(pdf|docx)$/i.test(payload.fileName))fail('INVALID_FILE','Choose a PDF or DOCX resume up to 6 MiB.');
        const parsed=await parseResume({base64:payload.base64,fileName:payload.fileName});
        const profile=normalizeProfile({...candidate.profile,...Object.fromEntries(['jobData','educationData','skillsData'].filter(key=>Array.isArray(parsed[key])).map(key=>[key,parsed[key]])),.../\.pdf$/i.test(payload.fileName)?{resumeData:{resumeBase64:payload.base64,fileName:payload.fileName,fileSize:Math.floor(payload.base64.length*3/4),dateUploaded:new Date().toISOString()}}:{}});
        if(job.isMock)return {previewOnly:true,candidateId:candidate.id,...profileImportReview(profile)};
        const token=crypto.randomUUID();await storage.set({[`dock-apply-import:v1:${windowId}`]:{token,jobId:job.id,inputRevision:job.inputRevision,resumeVersion:job.resume?.version||null,candidateId:candidate.id,candidateRevision:candidate.revision,profile}});
        return {token,candidateId:candidate.id,revision:candidate.revision,...profileImportReview(profile)};
      }
      if(payload.action!=='apply')fail('INVALID_REQUEST','Choose a resume import action.');
      const imported=(await storage.get(`dock-apply-import:v1:${windowId}`))[`dock-apply-import:v1:${windowId}`];
      if(!imported||imported.token!==payload.token||imported.jobId!==job.id||imported.inputRevision!==job.inputRevision||imported.resumeVersion!==(job.resume?.version||null)||imported.candidateId!==candidate.id||imported.candidateRevision!==candidate.revision)fail('IMPORT_STALE','The selected profile or job changed. Parse the resume again.');
      await profiles.updateCanonical({candidateId:candidate.id,expectedRevision:candidate.revision,profile:imported.profile,mutationId:imported.token});await storage.remove(`dock-apply-import:v1:${windowId}`);return state(windowId,sender);
    }
    if(operation==='DOCK_APPLY_ACTION'){await action(run,payload,sender);return state(windowId,sender);}
    fail('INVALID_REQUEST','Unsupported dock application request.');
  }
  return {handle(operation,payload,sender){
    if(operation==='DOCK_APPLY_START'){const result=starts.then(()=>handle(operation,payload,sender));starts=result.catch(()=>{});return result;}
    if(operation==='DOCK_APPLY_ACTION'&&!['pause','cancel'].includes(payload.action)){const previous=actions.get(payload.windowId)||Promise.resolve(),result=previous.then(()=>handle(operation,payload,sender));actions.set(payload.windowId,result.catch(()=>{}));return result;}
    return handle(operation,payload,sender);
  },async settled(windowId){const run=await load(windowId);await tasks.get(run?.id);return publicRun(run);},async closeWindow(windowId){const run=runs.get(windowId);if(run){run.phase='cancelled';run.epoch=(run.epoch||0)+1;}runs.set(windowId,null);await storage.remove([`dock-apply-run:v1:${windowId}`,`dock-apply-ui:v1:${windowId}`,`dock-apply-import:v1:${windowId}`]);}};
}
