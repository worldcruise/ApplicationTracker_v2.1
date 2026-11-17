import { safeJobUrl } from './reference-dashboard-data.js';
import { flushStudioTab } from './navigation-flush.js';
import { createProfileNameLookup } from './profile-display.js';
import {createQueueResumeEditor} from './queue-resume-editor.js';
import {isoRecordDate} from './record-dates.js';
import {queueJobKey} from './queue-import.js';
import {aiQueueState,nativeResume} from './ai-apply-model.js';
import {isJobReady} from '../ai-apply/src/job-readiness.mjs';
import {meetingSourceRows} from './dock-meetings-data.js';
import {sameApplicationUrl} from '../ai-apply/src/application-identity.mjs';

export const DOCK_RECORD_OPERATIONS = ['DOCK_RECORDS_STATE', 'DOCK_RECORDS_DOCUMENT_PREVIEW', 'DOCK_RECORDS_MUTATE', 'DOCK_RECORDS_STUDIO', 'DOCK_RECORDS_RESUME','DOCK_RECORDS_OPEN_RESUME','DOCK_RECORDS_CV_INPUT'];
export const APPLICATION_STAGES = ['applied', 'screen', 'interview', 'offer', 'rejected', 'archived'];
const key = 'dock-job-records:v1';
const hash = value => { let result = 2166136261; for (const c of value) result = Math.imul(result ^ c.charCodeAt(0),16777619); return (result >>> 0).toString(16); };
const signature = raw => JSON.stringify([raw.id ?? null, raw.jobLink, raw.jobTitle, raw.companyName, raw.companyLink, raw.date, raw.profileName, raw.status]);
const identity = raw => raw.id ? `remote:${raw.id}` : `legacy:${hash(JSON.stringify([raw.jobLink,raw.jobTitle,raw.companyName,raw.date,raw.profileName]))}`;
const anchor = raw => JSON.stringify([raw.jobLink,raw.date,raw.profileName]);
const empty = () => ({ schemaVersion: 1, jobs: [], applications: {}, aliases: {}, receipts: {} });

export function createDockRecordsService({ browser, storage, profiles, drafts, prompts, validateResume, makeSnapshot, parseCoverLetter, resumeExports, renderRecordPDF, openStudio, now = () => new Date().toISOString() }) {
  const resumeEditor=createQueueResumeEditor({profiles,drafts,validateResume,makeSnapshot,parseCoverLetter});
  let tail = Promise.resolve();
  const serial = action => { const run = tail.then(action); tail = run.catch(() => {}); return run; };
  function fail(code, message) { throw Object.assign(new Error(message), { code }); }
  const text = (value, max, label, required = false) => {
    if (typeof value !== 'string' || value.length > max || required && !value.trim()) fail('INVALID_REQUEST', `Enter ${label}${required ? '' : ' within its size limit'}.`);
    return value.trim();
  };
  function url(value, label = 'a valid job URL') { const result = safeJobUrl(value); if (!result) fail('INVALID_REQUEST', `Enter ${label}.`); return result; }
  function conversation(value) {
    if (!value) return '';
    const parsed = new URL(url(value, 'a ChatGPT conversation URL'));
    if (!['chatgpt.com','chat.openai.com'].includes(parsed.hostname) || parsed.protocol !== 'https:' || !/^\/c\/[\w-]+\/?$/.test(parsed.pathname)) fail('INVALID_REQUEST', 'Use a saved ChatGPT conversation URL, such as https://chatgpt.com/c/…');
    return parsed.href;
  }
  async function read() {
    const saved = (await storage.get(key))[key];
    if (!saved) return empty();
    if (saved.schemaVersion !== 1 || !Array.isArray(saved.jobs)) fail('CORRUPT_STORAGE', 'The job queue could not be read. Its saved data has been retained.');
    let readyChanged=false;
    for(const record of saved.jobs)if(isJobReady(record)){
      const extra=record.aiApply;
      if(record.status!=='Ready'||extra&&(extra.needsAction||extra.error||extra.state==='attention')){
        record.status='Ready';if(extra)Object.assign(extra,{state:'ready',needsAction:false,error:''});readyChanged=true;
      }
    }
    if(readyChanged)await write(saved);
    return saved;
  }
  async function write(saved) { await storage.set({ [key]: saved }); await browser.storage.local.set({'ai-apply-queue-revision':crypto.randomUUID()}); }
  async function rawApplications() {
    const raw = (await browser.storage.local.get('appliedList')).appliedList ?? [];
    if (!Array.isArray(raw)) fail('CORRUPT_STORAGE', 'Saved application records could not be read.');
    return raw;
  }
  async function visibleApplications(){return rawApplications();}
  function applications(saved, raw) {
    const seen = new Map();
    const anchors = new Map(); for (const record of raw) if (record && typeof record === 'object') anchors.set(anchor(record),(anchors.get(anchor(record)) || 0) + 1);
    const workflowIds=meetingSourceRows(raw).map(record=>record.applicationId||record.id);
    return raw.map((record, index) => {
      if (!record || typeof record !== 'object') return null;
      const base = identity(record), occurrence = seen.get(base) || 0; seen.set(base, occurrence + 1);
      const alias = `${base}:${occurrence}`, linked = anchors.get(anchor(record)) === 1 ? Object.entries(saved.applications).find(([,meta]) => meta.sourceAnchor === anchor(record))?.[0] : null;
      const id = saved.aliases[alias] || linked || alias, meta = saved.applications[id] || {},resume=meta.resume||record.resume||null;
      return { id, type: 'applications', workflowApplicationId:workflowIds[index], revision: `${meta.revision || 0}:${hash(signature(record))}`, candidateId: meta.candidateId || meta.resume?.snapshot?.candidate?.id || null,
        candidateName: meta.candidateName || record.profileName || 'Saved profile', company: record.companyName || 'Company not provided', role: record.jobTitle || 'Untitled role',
        url: safeJobUrl(record.jobLink), status: String(record.status || 'applied').toLowerCase().replace('screening','screen').replace('failed','archived'),
        createdAt: isoRecordDate(meta.createdAt,record.createdAt,record.date), updatedAt: [meta.updatedAt,record.updatedAt,record.date].map(value=>isoRecordDate(value)).filter(Boolean).sort().at(-1), salary:meta.salary??record.salary??'',notes: meta.notes ?? record.notes ?? '', description: meta.description??record.description??record.jobDescription??'', conversationUrl: meta.conversationUrl || '',
        resume, coverLetterRaw:meta.coverLetterRaw??resume?.coverLetterRaw??'',coverLetterEnabled:meta.coverLetterEnabled??!!resume?.coverLetterEnabled,events: meta.events || [{ label: 'Application recorded', at: record.date }],
        sourceIndex: index, alias };
    }).filter(Boolean);
  }
  async function state(saved) {
    const candidate = await profiles.bootstrap();
    const candidates=profiles.list?await profiles.list({includeProfileName:true}):[];
    if(candidate)candidates.push({id:candidate.id,name:candidate.document.candidate.name,profileName:candidate.profile.profileName});
    const displayName=createProfileNameLookup(candidates),raw=await visibleApplications();
    const apps = applications(saved,raw).map(({sourceIndex,alias,...record})=>({...record,candidateName:displayName({...record,profileName:raw[sourceIndex].profileName})}));
    const jobs = saved.jobs.filter(job => !job.deletedAt && !job.applicationId && (!candidate || job.candidateId === candidate.id)).map(job=>({...job,...isJobReady(job)?{status:'Ready'}:{},candidateName:displayName(job)}));
    return { candidate: candidate ? { id: candidate.id, name: candidate.document.candidate.name } : null, applications: apps, jobs };
  }
  function job(saved, payload, allowDeleted = false) {
    const found = saved.jobs.find(item => item.id === payload.id && (allowDeleted || !item.deletedAt));
    if (!found) fail('NOT_FOUND', 'This queue job is no longer available.');
    if (found.revision !== payload.expectedRevision) fail('CONFLICT', 'This record changed. Your edits are retained; reload the saved record before trying again.');
    return found;
  }
  function touch(record, label) { record.revision++; record.updatedAt = now(); record.events.unshift({ label, at: record.updatedAt }); }
  async function flushOpenStudio(windowId) {
    const session = await browser.storage.session.get(`preview-tab:v1:${windowId}`), preview = session[`preview-tab:v1:${windowId}`];
    if (preview?.tabId == null) return;
    const tab = await browser.tabs.get(preview.tabId).catch(() => null);
    if (tab?.windowId === windowId && (tab.pendingUrl || tab.url || '').split('?')[0] === browser.runtime.getURL('preview.html')) await flushStudioTab(preview.tabId,browser);
  }
  async function prepareStudio(record, windowId, savedResume = false) {
    await flushOpenStudio(windowId);
    await profiles.select(record.candidateId);
    const current = await drafts.bootstrap(record.candidateId);
    const draft = current.record.draft;
    const input = `${record.url}\n${record.description}`;
    // Preserve the current editor before switching jobs or loading a saved CV.
    const next = draft.jobInputRaw === input ? { ...draft } : { ...draft, jobInputRaw: input, jobInputKind: 'job_description', sourceUrl: record.url, captureId: null,
      cvJsonRaw: record.resume?.cvJsonRaw || '', coverLetterRaw: record.resume?.coverLetterRaw || '', coverLetterEnabled: !!record.resume?.coverLetterEnabled };
    if (record.resume?.documentTemplate) next.documentTemplate = record.resume.documentTemplate;
    if(savedResume)Object.assign(next,{jobInputRaw:input,jobInputKind:'job_description',sourceUrl:record.url,captureId:null,
      cvJsonRaw:record.resume.cvJsonRaw,coverLetterRaw:record.resume.coverLetterRaw||'',coverLetterEnabled:!!record.resume.coverLetterEnabled,
      formattingOverrides:record.resume.snapshot.formattingOverrides||{},bindings:record.resume.snapshot.bindings||{experience:[],education:[]}});
    if(JSON.stringify(next)!==JSON.stringify(draft))await storage.set({ [`dock-draft-backup:${record.candidateId}:${draft.id}:${draft.revision}`]: draft });
    let saved = await drafts.save({ draft: next, expectedRevision: draft.revision, mutationId: crypto.randomUUID() });
    if(savedResume){
      const candidate=await profiles.get(record.candidateId),snapshot=makeSnapshot(candidate,{...saved.record.draft,documentTemplate:next.documentTemplate,formattingOverrides:next.formattingOverrides,bindings:next.bindings},String(windowId),1).snapshot;
      // Draft text and document settings have separate revision-checked APIs.
      saved=await drafts.settings({candidateId:record.candidateId,expectedRevision:saved.record.draft.revision,templateId:next.documentTemplate.id,
        overrides:snapshot.formattingOverrides||{},bindings:snapshot.bindings,mutationId:crypto.randomUUID()},snapshot.profile);
    }
    return { saved, candidate: await profiles.get(record.candidateId), opened: await openStudio(windowId) };
  }
  async function documents(record,input){
    if(typeof input.cvJsonRaw!=='string')return {};
    const coverLetterRaw=text(input.coverLetterRaw||'',128*1024,'cover-letter text'),coverLetterEnabled=input.coverLetterEnabled===true;
    if(coverLetterEnabled&&!coverLetterRaw)fail('INVALID_LETTER','Enter cover-letter text or turn Cover letter off.');
    if(!input.cvJsonRaw.trim())return {resume:null,coverLetterRaw,coverLetterEnabled};
    const candidate=await profiles.bootstrap();if(!candidate)fail('CANDIDATE_REQUIRED','Select a candidate before updating documents.');
    const {draft,snapshot}=await resumeEditor.prepare({...record,candidateId:record.candidateId||candidate.id},input);
    return {coverLetterRaw,coverLetterEnabled,resume:{cvJsonRaw:draft.cvJsonRaw,coverLetterRaw,coverLetterEnabled,documentTemplate:draft.documentTemplate,snapshot,inputRevision:record.inputRevision||1,candidateRevision:candidate.revision,version:(record.resume?.version||0)+1,savedAt:now()}};
  }
  function importedJob(candidate,library,input){
    if(!input||typeof input!=='object')fail('INVALID_REQUEST','Enter valid job fields.');
    const jobUrl=url(input.url),templateId=candidate.document.applicationPreferences?.assignedPromptTemplateId||library.selectedId;
    return {id:crypto.randomUUID(),type:'queue',candidateId:candidate.id,candidateName:candidate.document.candidate.name,candidateRevision:candidate.revision,
      company:text(input.company,300,'a company name',true),role:text(input.role,500,'a role',true),salary:text(input.salary||'',200,'a salary'),url:jobUrl,
      description:text(input.description,160000,'a job description',true),notes:'',conversationUrl:'',promptTemplateId:templateId,
      promptSnapshot:structuredClone(library.templates.find(item=>item.id===templateId)||library.templates.find(item=>item.id===library.selectedId)),
      status:'Queued',revision:1,inputRevision:1,attempt:0,resume:null,resumeHistory:[],createdAt:now(),updatedAt:now(),events:[{label:'Job imported from CSV',at:now()}]};
  }
  async function trackSubmission(saved,payload){
    const candidate=await profiles.get(payload.candidateId);
    if(!candidate||(await profiles.bootstrap())?.id!==candidate.id)fail('CANDIDATE_REQUIRED','Use the current profile to record this application.');
    const input=payload.metadata||{},jobLink=url(input.jobLink),companyLink=input.companyLink?url(input.companyLink):'',jobTitle=text(input.jobTitle||'',500,'a job title'),companyName=text(input.companyName||'',300,'a company name');
    const queued=saved.jobs.find(job=>!job.deletedAt&&job.candidateId===candidate.id&&(job.id===payload.jobId||sameApplicationUrl(job.url,jobLink)));
    if(queued){
      if(queued.applicationId)return{...await state(saved),selectedId:queued.applicationId,queueId:queued.id};
      const result=await mutate(saved,{action:'apply',type:'queue',id:queued.id,expectedRevision:queued.revision,submissionConfirmed:true,mutationId:`speedy:${candidate.id}:${queued.id}`});
      return{...result,queueId:queued.id};
    }
    const raw=await rawApplications(),date=new Date(now()).toString(),profileName=candidate.profile.profileName||'Default';
    // SpeedyApply dh/lh: save locally first; deduplicate by profile and day.
    // Canonical application URLs also collapse embedded and regular ATS forms.
    let entry=raw.find(row=>row.profileName===profileName&&row.date?.slice(0,15)===date.slice(0,15)&&(sameApplicationUrl(row.jobLink,jobLink)||row.jobTitle===jobTitle&&row.jobLink===jobLink&&row.companyLink===companyLink));
    if(!entry){entry={id:crypto.randomUUID(),jobTitle,jobLink,companyLink,companyName,date,createdAt:now(),status:'applied',profileName};raw.unshift(entry);await browser.storage.local.set({appliedList:raw});}
    const record=applications(saved,raw).find(record=>raw[record.sourceIndex]===entry);
    if(!saved.applications[record.id])saved.applications[record.id]={candidateId:candidate.id,candidateName:candidate.document.candidate.name,sourceAnchor:anchor(entry),createdAt:entry.createdAt||entry.date,updatedAt:entry.createdAt||entry.date,revision:1,events:[{label:'Application submitted',at:entry.createdAt||entry.date}]};
    saved.aliases[record.alias]=record.id;await write(saved);return{...await state(saved),selectedId:record.id};
  }
  async function mutate(saved, payload) {
    const action = payload.action;
    if (typeof payload.mutationId !== 'string' || !payload.mutationId || payload.mutationId.length > 128) fail('INVALID_REQUEST', 'A mutation ID is required.');
    const requestSignature = JSON.stringify(payload);
    if (saved.receipts[payload.mutationId]) {
      const receipt = saved.receipts[payload.mutationId];
      if (receipt.signature !== requestSignature) fail('MUTATION_CONFLICT', 'This operation ID was already used for different content.');
      return { ...await state(saved), selectedId: receipt.id,...receipt.deletedRecord?{deletedRecord:receipt.deletedRecord}:{},...receipt.importReport?{importReport:receipt.importReport}:{} };
    }
    let selectedId = payload.id,deletedRecord,importReport;
    if(action==='create-application'){
      const candidate=await profiles.bootstrap();if(!candidate)fail('CANDIDATE_REQUIRED','Create a candidate profile in Settings before adding applications.');
      const input=payload.fields||{},company=text(input.company,300,'a company name',true),role=text(input.role,500,'a role',true),jobLink=input.url?url(input.url):'';
      const meta={candidateId:candidate.id,candidateName:candidate.document.candidate.name,notes:text(input.notes||'',10000,'notes'),description:text(input.description||'',160000,'a job description'),conversationUrl:conversation(input.conversationUrl||''),revision:1,updatedAt:now(),events:[{label:'Application added manually',at:now()}]};
      const raw=await rawApplications(),entry={id:crypto.randomUUID(),jobTitle:role,companyName:company,jobLink,companyLink:jobLink?new URL(jobLink).origin:'',date:new Date(now()).toString(),createdAt:now(),status:'applied',profileName:candidate.profile.profileName};
      await browser.storage.local.set({appliedList:[entry,...raw]});
      const record=applications(saved,[entry])[0];selectedId=record.id;saved.applications[record.id]={...meta,sourceAnchor:anchor(entry)};saved.aliases[record.alias]=record.id;
    } else if (action === 'create') {
      if (saved.jobs.filter(item => !item.deletedAt && !item.applicationId).length >= 500) fail('QUEUE_LIMIT', 'The queue supports up to 500 active jobs.');
      const candidate = await profiles.bootstrap();
      if (!candidate) fail('CANDIDATE_REQUIRED', 'Create a candidate profile in Settings before adding jobs.');
      const input = payload.fields || {}, jobUrl = url(input.url);
      const duplicate = saved.jobs.find(item => !item.deletedAt && !item.applicationId && item.candidateId === candidate.id && item.url === jobUrl);
      if (duplicate) fail('DUPLICATE_JOB', 'This job is already in the candidate’s queue.');
      const library = await prompts.read(), templateId = candidate.document.applicationPreferences?.assignedPromptTemplateId || library.selectedId;
      const record = { id: crypto.randomUUID(), type: 'queue', candidateId: candidate.id, candidateName: candidate.document.candidate.name, candidateRevision: candidate.revision,
        company: text(input.company,300,'a company name',true), role: text(input.role,500,'a role',true), salary:text(input.salary||'',200,'a salary'),url: jobUrl,
        description: text(input.description,160000,'a job description',true), notes: text(input.notes || '',10000,'notes'), conversationUrl: conversation(input.conversationUrl || ''),
        promptTemplateId: templateId, promptSnapshot: structuredClone(library.templates.find(item => item.id === templateId) || library.templates.find(item => item.id === library.selectedId)),
        status: 'Queued', revision: 1, inputRevision: 1, attempt: 0, resume: null, resumeHistory: [], createdAt: now(), updatedAt: now(), events: [{ label: 'Job added to queue', at: now() }] };
      saved.jobs.unshift(record); selectedId = record.id;
    } else if(action==='import'){
      if(payload.type!=='queue'||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>1000)fail('INVALID_REQUEST','Import up to 1,000 rows into Job Queues.');
      const candidate=await profiles.bootstrap();if(!candidate)fail('CANDIDATE_REQUIRED','Create a profile in Settings before importing jobs.');
      const library=await prompts.read(),applicationsNow=await visibleApplications();
      const known=new Set([...saved.jobs.filter(job=>!job.deletedAt&&job.candidateId===candidate.id).map(job=>queueJobKey(job.url)),...applicationsNow.map(row=>queueJobKey(row.jobLink))].filter(Boolean));
      let active=saved.jobs.filter(job=>!job.deletedAt&&!job.applicationId).length;
      importReport={imported:0,skipped:0,failed:0,errors:[]};
      for(const [index,input]of payload.rows.entries()){
        const duplicate=queueJobKey(input?.url);if(duplicate&&known.has(duplicate)){importReport.skipped++;continue;}
        try{
          if(active>=500)fail('QUEUE_LIMIT','The queue supports up to 500 active jobs.');
          const record=importedJob(candidate,library,input);saved.jobs.unshift(record);known.add(queueJobKey(record.url));active++;importReport.imported++;
        }catch(error){if(!error.code)throw error;importReport.failed++;if(importReport.errors.length<20)importReport.errors.push({row:index+2,message:error.message});}
      }
      selectedId=null;
    } else if(action==='delete-selected'){
      if(!['queue','applications'].includes(payload.type)||!Array.isArray(payload.records)||!payload.records.length||payload.records.length>5000||payload.records.some(row=>!row||typeof row.id!=='string')||new Set(payload.records.map(row=>row.id)).size!==payload.records.length)fail('INVALID_REQUEST','Select records to delete.');
      const visible=await state(saved),available=payload.type==='queue'?visible.jobs:visible.applications;
      const targets=payload.records.map(selection=>{
        const record=available.find(row=>row.id===selection.id);
        if(!record||record.revision!==selection.revision)fail('CONFLICT','The selected records changed. Close and reopen Delete to review them again.');
        return record;
      });
      if(payload.type==='queue'){
        for(const target of targets){const record=job(saved,{id:target.id,expectedRevision:target.revision});record.deletedAt=now();touch(record,'Job removed');}
      }else{
        const raw=await visibleApplications(),current=applications(saved,raw);
        const entries=targets.map(target=>{const record=current.find(row=>row.id===target.id);if(!record||record.revision!==target.revision)fail('CONFLICT','The selected applications changed. Close and reopen Delete to review them again.');return{record,entry:raw[record.sourceIndex]};});
        const real=await rawApplications();
        for(const {record,entry} of entries)if(signature(real[record.sourceIndex]||{})!==signature(entry))fail('CONFLICT','The selected applications changed. Close and reopen Delete to review them again.');
        const indices=new Set(entries.map(({record})=>record.sourceIndex));
        if(indices.size)await browser.storage.local.set({appliedList:real.filter((_,index)=>!indices.has(index))});
        for(const {record,entry} of entries){
          const previous=saved.applications[record.id]||{},meta={...previous,createdAt:record.createdAt,deletedRecord:entry,sourceAnchor:anchor(entry),revision:(previous.revision||0)+1,updatedAt:now(),events:[{label:'Application removed',at:now()},...record.events]};          saved.applications[record.id]=meta;saved.aliases[record.alias]=record.id;
        }
      }
      selectedId=null;
    } else if (action === 'delete-all') {
      const candidate=await profiles.bootstrap();
      if(!candidate||payload.candidateId!==candidate.id)fail('CANDIDATE_CONFLICT','Select the same candidate before clearing the queue.');
      const targets=saved.jobs.filter(record=>record.candidateId===candidate.id&&!record.deletedAt&&!record.applicationId);
      if(!Array.isArray(payload.jobs)||payload.jobs.length!==targets.length||targets.some(record=>!payload.jobs.some(item=>item.id===record.id&&item.revision===record.revision)))fail('CONFLICT','The queue changed. Refresh it before deleting all jobs.');
      for(const record of targets){record.deletedAt=now();touch(record,'Job removed');}
      selectedId=null;
    } else if(payload.type==='applications'&&action==='restore'){
      const previous=saved.applications[payload.id],entry=previous?.deletedRecord;
      if(!entry||payload.expectedRevision!==`${previous.revision}:deleted`)fail('CONFLICT','This deleted application is no longer available to restore.');
      {
        const raw=await rawApplications();
        if(raw.some(row=>identity(row)===identity(entry)))fail('CONFLICT','This application already exists. Refresh before restoring it.');
        await browser.storage.local.set({appliedList:[entry,...raw]});
      }
      delete previous.deletedRecord;previous.revision++;previous.updatedAt=now();previous.events=[{label:'Application restored',at:now()},...(previous.events||[])];
    } else if (payload.type === 'applications') {
      if (!['update','delete'].includes(action)) fail('INVALID_REQUEST', 'Choose an application update or deletion.');
      const raw = await visibleApplications(), record = applications(saved, raw).find(item => item.id === payload.id);
      if (!record) fail('NOT_FOUND', 'This application is no longer available.');
      if (record.revision !== payload.expectedRevision) fail('CONFLICT', 'The application changed. Your edits are retained; reload the saved record before trying again.');
      if(action==='delete'){
        const entry=raw[record.sourceIndex],previous=saved.applications[record.id]||{},meta={...previous,createdAt:record.createdAt,deletedRecord:entry,sourceAnchor:anchor(entry),revision:(previous.revision||0)+1,updatedAt:now(),events:[{label:'Application removed',at:now()},...record.events]};        {
          const latest=await rawApplications();
          if(signature(latest[record.sourceIndex]||{})!==signature(entry))fail('CONFLICT','The application changed. Reload it before deleting.');
          await browser.storage.local.set({appliedList:latest.filter((_,index)=>index!==record.sourceIndex)});
        }
        saved.applications[record.id]=meta;saved.aliases[record.alias]=record.id;deletedRecord={...record,revision:`${meta.revision}:deleted`};selectedId=null;
      }else{
      const input = payload.fields || {}, status = input.status;
      if (!APPLICATION_STAGES.includes(status)) fail('INVALID_STATUS', 'Choose an available application stage.');
      const submitted={cvJsonRaw:record.resume?.cvJsonRaw||'',coverLetterRaw:record.coverLetterRaw,coverLetterEnabled:record.coverLetterEnabled};
      if(Object.entries(submitted).some(([name,value])=>Object.hasOwn(input,name)&&input[name]!==value)||['resume','snapshot','documentTemplate'].some(name=>Object.hasOwn(input,name)))fail('READ_ONLY_DOCUMENTS','Submitted resumes and cover letters cannot be changed. Edit documents in Job Queues before submitting.');
      const previous = saved.applications[record.id] || {};
      const meta = { ...previous, createdAt:record.createdAt,sourceAnchor:anchor(raw[record.sourceIndex]), salary:text(input.salary??record.salary??'',200,'a salary'),notes: text(input.notes || '',10000,'notes'), conversationUrl: conversation(input.conversationUrl || ''), revision: (previous.revision || 0) + 1, updatedAt: now(),
        events: [{ label: status === record.status ? 'Record updated' : `Status changed to ${status}`, at: now() }, ...record.events] };
      const nextRaw = { ...raw[record.sourceIndex], status };
      // Re-read before committing; a stale dock must never replace web edits.
      const latest = await rawApplications();
      if (signature(latest[record.sourceIndex] || {}) !== signature(raw[record.sourceIndex])) fail('CONFLICT', 'The application changed. Reload it before saving.');
      {
        latest[record.sourceIndex] = nextRaw;
        await browser.storage.local.set({ appliedList: latest });
      }
      saved.applications[record.id] = meta;
      saved.aliases[record.alias] = record.id;
      }
    } else {
      const record = job(saved, payload, action === 'restore');
      if (record.applicationId) {
        if (action === 'apply') return { ...await state(saved), selectedId: record.applicationId };
        fail('INVALID_STATE', 'This job has already been recorded as an application.');
      }
      if(action==='update-resume'){
        const prepared=await resumeEditor.prepare(record,payload.fields||{}),{candidate,draft,snapshot}=prepared;
        if(record.company!==prepared.company||record.role!==prepared.role)record.inputRevision++;
        record.company=prepared.company;record.role=prepared.role;
        if(record.resume)record.resumeHistory.unshift(record.resume);
        record.resume={cvJsonRaw:draft.cvJsonRaw,coverLetterRaw:draft.coverLetterRaw,coverLetterEnabled:draft.coverLetterEnabled,documentTemplate:draft.documentTemplate,
          snapshot,inputRevision:record.inputRevision,candidateRevision:candidate.revision,version:record.resumeHistory.length+1,savedAt:now()};
        record.candidateName=candidate.document.candidate.name;record.status='Ready';record.error='';touch(record,'Resume updated from CV input');
        record.coverLetterRaw=draft.coverLetterRaw;record.coverLetterEnabled=draft.coverLetterEnabled;
      }else if (action === 'update') {
        const fields = payload.fields || {}, description = text(fields.description,160000,'a job description',true), jobUrl = url(fields.url);
        const attachments=await documents(record,fields);
        const changed = description !== record.description || jobUrl !== record.url;
        Object.assign(record, { description, url: jobUrl, salary:fields.salary===undefined?record.salary||'':text(fields.salary,200,'a salary'),notes: text(fields.notes || '',10000,'notes'), conversationUrl: conversation(fields.conversationUrl || '') });
        if (changed) { record.inputRevision++; record.status = 'Queued'; if (record.resume) record.resumeHistory.unshift(record.resume); record.resume = null; record.error = ''; }
        if('resume' in attachments){if(record.resume)record.resumeHistory.unshift(record.resume);Object.assign(record,attachments);if(record.resume){record.resume.inputRevision=record.inputRevision;record.status='Ready';record.error='';}else if(record.status==='Ready')record.status='Queued';}
        touch(record, changed ? 'Job inputs changed; prepare a new resume' : 'Record updated');
      } else if (action === 'delete') {
        record.deletedAt = now(); touch(record, 'Job removed'); selectedId = null;
      } else if (action === 'restore') {
        if (!record.deletedAt) fail('INVALID_STATE', 'This job has already been restored.');
        delete record.deletedAt; touch(record, 'Job restored');
      } else if (action === 'retry') {
        if (record.status !== 'Failed') fail('INVALID_STATE', 'Only failed jobs can be queued for another attempt.');
        record.status = 'Queued'; record.error = ''; touch(record, 'Another resume attempt queued; previous history retained');
      } else if (action === 'fail') {
        if (!['Queued','Generating'].includes(record.status)) fail('INVALID_STATE', 'Only an unfinished job can be marked failed.');
        record.status = 'Failed'; record.error = text(payload.error || 'Resume preparation was interrupted.',2000,'an error description'); touch(record, 'Resume preparation failed');
      } else if (action === 'apply') {
        const currentResume=record.resume?.snapshot&&record.resume.inputRevision===record.inputRevision;
        if ((record.status!=='Ready'||!currentResume)&&payload.submissionConfirmed!==true) fail('INVALID_STATE', 'Save a current, validated resume before marking this job applied.');
        const candidate = await profiles.get(record.candidateId);
        if (!candidate) fail('CANDIDATE_REQUIRED', 'The candidate profile is no longer available.');
        if(payload.expectedCandidateRevision!==undefined&&(candidate.revision!==payload.expectedCandidateRevision||(record.resume?.version??null)!==payload.expectedResumeVersion||record.inputRevision!==payload.expectedInputRevision))fail('RUN_STALE','The profile, job or prepared resume changed. Review a new application run.');
        if ((await profiles.bootstrap())?.id !== record.candidateId) fail('CANDIDATE_CONFLICT', 'Select this job’s candidate in the dock before recording its application.');
        record.submission ||= { at: now() };
        // Persist the fixed submission time before saving. An interrupted retry
        // finds the same local record instead of adding a second application.
        await write(saved);
        const raw = await rawApplications(), expectedDate = new Date(record.submission.at).toString();
        if(!raw.some(item=>item.jobLink===record.url&&item.jobTitle===record.role&&item.profileName===candidate.profile.profileName&&item.date.slice(0,15)===expectedDate.slice(0,15))){
          raw.unshift({id:crypto.randomUUID(),jobTitle:record.role,jobLink:record.url,companyName:record.company,companyLink:new URL(record.url).origin,date:expectedDate,createdAt:record.submission.at,status:'applied',profileName:candidate.profile.profileName});
          await browser.storage.local.set({appliedList:raw});
        }
        const applicationsNow = applications(saved, raw), created = applicationsNow.find(item => {
          const source = raw[item.sourceIndex]; return source.jobLink === record.url && source.jobTitle === record.role && source.profileName === candidate.profile.profileName && source.date.slice(0,15) === expectedDate.slice(0,15);
        });
        if (!created) fail('SAVE_FAILED', 'The application could not be saved. Your ready job is retained; try again.');
        record.applicationId = created.id; record.status = 'Applied'; touch(record, 'Submission manually recorded as Applied'); selectedId = created.id;
        saved.applications[created.id] = { sourceAnchor:anchor(raw[created.sourceIndex]), candidateId: record.candidateId, candidateName: record.candidateName, queueId: record.id, description: record.description, notes: record.notes,
          createdAt:record.submission.at,salary:record.salary||'',conversationUrl: record.conversationUrl, resume: currentResume?structuredClone(record.resume):null,
          coverLetterRaw:record.coverLetterRaw??record.resume?.coverLetterRaw??'',coverLetterEnabled:record.coverLetterEnabled??!!record.resume?.coverLetterEnabled,events: record.events, revision: 1, updatedAt: now() };
      } else fail('INVALID_REQUEST', 'Unsupported queue action.');
    }
    saved.receipts[payload.mutationId] = { signature: requestSignature, id: selectedId,...deletedRecord?{deletedRecord}:{},...importReport?{importReport}:{} };
    const ids = Object.keys(saved.receipts); for (const id of ids.slice(0, Math.max(0,ids.length - 100))) delete saved.receipts[id];
    await write(saved);
    return { ...await state(saved), selectedId,...deletedRecord?{deletedRecord}:{},...importReport?{importReport}:{} };
  }
  async function aiApplyCommit(saved,payload) {
    const candidate=await profiles.bootstrap();
    if(!candidate)fail('CANDIDATE_REQUIRED','Upload your resume in Settings before adding jobs.');
    if(!Array.isArray(payload.changes)||!Array.isArray(payload.deleted)||payload.changes.length+payload.deleted.length>1000)fail('INVALID_REQUEST','Invalid shared queue changes.');
    const library=await prompts.read(),projected=aiQueueState(saved,candidate);
    for(const change of [...payload.changes.map(item=>({...item,id:item.record?.id})),...payload.deleted]){
      const current=saved.jobs.find(item=>item.id===change.id);
      if(typeof change.id!=='string'||!change.id||current&&(current.deletedAt||current.applicationId||current.candidateId!==candidate.id)||
        (current?.revision??null)!==change.expectedRevision)fail('CONFLICT','This job changed in another view. Reload the queue before saving.');
    }
    const existingApplications=await rawApplications();
    for(const {record:request} of payload.changes){
      if(!request?.input||request.input.candidateId!==candidate.id||request.isExample)fail('INVALID_REQUEST','Use your current profile for this job.');
      const input=request.input.job||{},previous=saved.jobs.find(item=>item.id===request.id),pending=request.capturePending===true;
      const jobUrl=input.url?url(input.url):'';
      const duplicate=jobUrl&&[...saved.jobs.filter(item=>item.id!==request.id&&!item.deletedAt),...existingApplications.map(item=>({url:item.jobLink}))].some(item=>queueJobKey(item.url)===queueJobKey(jobUrl));
      if(duplicate&&(!previous||previous.url!==jobUrl))fail('DUPLICATE_JOB','This application link is already saved.');
      const fields={company:text(input.company||'',300,'a company name',!pending),role:text(input.role||'',500,'a role',!pending),
        description:text(input.description||'',160000,'a job description',!pending&&request.input.tailor!==false),url:jobUrl,salary:text(input.salary||'',200,'a salary')};
      const timestamp=now(),templateId=candidate.document.applicationPreferences?.assignedPromptTemplateId||library.selectedId;
      const record=previous||{id:request.id,type:'queue',candidateId:candidate.id,candidateName:candidate.document.candidate.name,candidateRevision:candidate.revision,
        revision:0,inputRevision:1,attempt:0,resume:null,resumeHistory:[],notes:'',createdAt:timestamp,events:[],promptTemplateId:templateId,
        promptSnapshot:structuredClone(library.templates.find(item=>item.id===templateId)||library.templates.find(item=>item.id===library.selectedId))};
      const old=projected.requests.find(item=>item.id===record.id),changed=!!previous&&['company','role','url','description'].some(field=>record[field]!==fields[field]);
      if(changed){record.inputRevision++;if(record.resume)record.resumeHistory.unshift(record.resume);if(!request.documentsStale)record.resume=null;}
      Object.assign(record,fields);
      if(request.resume&&!request.documentsStale&&(!old||JSON.stringify(request.resume)!==JSON.stringify(old.resume)||request.coverLetter!==old.coverLetter||request.coverLetterEnabled!==old.coverLetterEnabled||request.input.resumeTemplate!==old.input.resumeTemplate||changed)){
        const attachments=await documents(record,{cvJsonRaw:JSON.stringify(nativeResume(request.resume)),coverLetterRaw:request.coverLetter||'',coverLetterEnabled:request.coverLetterEnabled===true,
          ...request.input.resumeTemplate?{documentTemplate:{id:request.input.resumeTemplate,version:1}}:{}});
        if(record.resume)record.resumeHistory.unshift(record.resume);Object.assign(record,attachments);
      }
      if(!request.resume&&old?.resume){if(record.resume)record.resumeHistory.unshift(record.resume);record.resume=null;}
      if((!request.resume||request.documentsStale)&&(request.coverLetter!==old?.coverLetter||request.coverLetterEnabled!==old?.coverLetterEnabled)){
        record.coverLetterRaw=text(request.coverLetter||'',50000,'cover-letter text');record.coverLetterEnabled=request.coverLetterEnabled===true;
        if(record.resume)record.resume={...record.resume,coverLetterRaw:record.coverLetterRaw,coverLetterEnabled:record.coverLetterEnabled};
      }
      const chat=request.manualChatUrl||'';
      if(chat){let parsed;try{parsed=new URL(chat);}catch{}if(!parsed||parsed.protocol!=='https:'||!['chatgpt.com','chat.deepseek.com'].includes(parsed.hostname)||parsed.username||parsed.password)fail('INVALID_REQUEST','Use a saved ChatGPT or DeepSeek conversation URL.');}
      record.conversationUrl=chat;record.aiApply={...structuredClone(request),sharedResumeVersion:record.resume?.version};delete record.aiApply.canonicalRevision;
      record.status=record.resume&&!request.documentsStale?'Ready':request.state==='attention'?'Failed':'Queued';
      if(isJobReady({...record,documentsStale:request.documentsStale})){record.status='Ready';Object.assign(record.aiApply,{state:'ready',needsAction:false,error:''});}
      if(request.state==='cancelled')record.deletedAt=timestamp;
      record.revision++;record.updatedAt=timestamp;record.events.unshift({label:previous?'Job updated in Apply to Job':'Job added from Apply to Job',at:timestamp});
      if(!previous)saved.jobs.push(record);
    }
    for(const item of payload.deleted){const record=saved.jobs.find(job=>job.id===item.id);record.deletedAt=now();touch(record,'Job removed');}
    if(saved.jobs.filter(item=>!item.deletedAt&&!item.applicationId).length>500)fail('QUEUE_LIMIT','The queue supports up to 500 active jobs.');
    await write(saved);return aiQueueState(saved,candidate);
  }
  return { handle: (operation, payload, sender) => serial(async () => {
    const saved = await read();
    if(operation==='AI_APPLY_READ')return aiQueueState(saved,await profiles.bootstrap());
    if(operation==='AI_APPLY_COMMIT')return aiApplyCommit(saved,payload);
    if(operation==='DOCK_RECORDS_TRACK_SUBMISSION')return trackSubmission(saved,payload);
    if(operation==='AI_APPLY_RENDER_PDF'){
      if(!['resume','cover-letter'].includes(payload.kind)||!renderRecordPDF)fail('PREVIEW_UNAVAILABLE','Choose a resume or cover letter to render with Resume Studio.');
      const record=saved.jobs.find(row=>row.id===payload.jobId&&!row.deletedAt&&!row.applicationId),candidate=await profiles.bootstrap();
      if(!record||!candidate||record.candidateId!==candidate.id||payload.candidateId&&payload.candidateId!==candidate.id)fail('NOT_FOUND','This job is no longer available for the current profile.');
      if(payload.sourceJob&&['company','role','url','description'].some(field=>(payload.sourceJob[field]||'')!==(record[field]||'')))fail('CONFLICT','This job changed. Review its current documents before exporting.');
      const resume=payload.resume;
      if(!resume||!Array.isArray(resume.experience)||!Array.isArray(resume.education))fail('INVALID_CV','A validated resume is required to render the PDF.');
      const cvJsonRaw=JSON.stringify(nativeResume(resume)),coverLetterRaw=text(payload.coverLetter||'',128*1024,'cover-letter text');
      if(payload.kind==='cover-letter'&&!coverLetterRaw)fail('INVALID_LETTER','This job has no cover letter.');
      // Reuse the frozen Studio snapshot when content matches the saved resume.
      // New AI results get a temporary snapshot; rendering never saves edits.
      const matches=record.resume?.snapshot&&record.resume.inputRevision===record.inputRevision&&
        JSON.stringify(nativeResume(JSON.parse(record.resume.cvJsonRaw)))===cvJsonRaw;
      const selectedTemplate=record.aiApply?.input?.resumeTemplate;
      const prepared=matches?record:{...record,...await documents(record,{cvJsonRaw,coverLetterRaw,coverLetterEnabled:payload.kind==='cover-letter',
        ...selectedTemplate?{documentTemplate:{id:selectedTemplate,version:1}}:{}})};
      return renderRecordPDF({...prepared,coverLetterRaw},payload.kind==='cover-letter'?'letter':'resume');
    }
    if (operation === 'DOCK_RECORDS_STATE') return state(saved);
    if(operation==='DOCK_RECORDS_DOCUMENT_PREVIEW'){
      if(!['queue','applications'].includes(payload.type)||!['resume','letter'].includes(payload.kind))fail('INVALID_REQUEST','Choose a saved resume or cover letter.');
      const record=payload.type==='queue'?job(saved,payload):applications(saved,await visibleApplications()).find(row=>row.id===payload.id);
      if(!record)fail('NOT_FOUND','This saved document is no longer available.');
      if(record.revision!==payload.expectedRevision)fail('CONFLICT','This record changed. Refresh before previewing its document.');
      if(!renderRecordPDF)fail('PREVIEW_UNAVAILABLE','The PDF preview is unavailable. Reload the extension and try again.');
      return renderRecordPDF(record,payload.kind);
    }
    if (operation === 'DOCK_RECORDS_MUTATE') return mutate(saved, payload);
    if(payload.type==='applications')fail('READ_ONLY_DOCUMENTS','View submitted documents from the application card. Only queue documents can be opened for editing.');
    const record = job(saved, payload);
    if(record.applicationId)fail('READ_ONLY_DOCUMENTS','This job has been submitted. View its saved documents from Applications.');
    if(record.revision!==payload.expectedRevision)fail('CONFLICT','This record changed. Refresh before opening its document.');
    if (!Number.isSafeInteger(payload.windowId) || sender.tab && sender.tab.windowId !== payload.windowId) fail('INVALID_REQUEST', 'Use the current browser window.');
    if(operation==='DOCK_RECORDS_CV_INPUT'){
      if(record.applicationId)fail('INVALID_STATE','Open an active queue job to update its resume.');
      if(payload.action==='validate'){const result=await resumeEditor.inspect(record,payload);return {candidate:result.candidate,validation:result.validation};}
      if(payload.action==='preview'){
        const {draft,snapshot}=await resumeEditor.prepare(record,payload);
        await prepareStudio({...record,resume:{cvJsonRaw:draft.cvJsonRaw,coverLetterRaw:draft.coverLetterRaw,coverLetterEnabled:draft.coverLetterEnabled,documentTemplate:draft.documentTemplate,snapshot}},payload.windowId,true);
        return {opened:true};
      }
      if(!resumeExports)fail('EXPORT_UNAVAILABLE','Resume download is unavailable.');
      if(payload.action==='export-status'){
        const ticket=await resumeExports.status(record,payload.ticketId),file=ticket.files?.find(item=>item.kind==='cv');
        if(record.resume?.export?.ticketId===payload.ticketId&&file?.state==='complete'&&file.filename){record.resume.export={...record.resume.export,fileName:file.filename,state:'complete'};await write(saved);}
        return ticket;
      }
      if(payload.action==='export-retry')return resumeExports.retry(record,payload.ticketId,payload.kind);
      if(payload.action==='export'){
        const {draft,snapshot,letter}=await resumeEditor.prepare(record,payload);
        const selection={snapshot,draftRevision:draft.revision,jobInputRaw:'',cvJsonRaw:draft.cvJsonRaw,coverLetterEnabled:draft.coverLetterEnabled,coverLetterRaw:draft.coverLetterRaw,letter,renderedAt:now(),omitJobDescription:true};
        const ticket=await resumeExports.start(record,{ticketId:payload.ticketId,bindingId:payload.bindingId,selection});
        if(record.resume?.cvJsonRaw===draft.cvJsonRaw&&selection.destination){const file=ticket.files?.find(item=>item.kind==='cv');record.resume.export={ticketId:ticket.id,bindingId:selection.destination.bindingId,companyFolder:selection.destination.companyFolder,fileName:file?.filename||'',state:file?.state||'pending'};await write(saved);}
        return ticket;
      }
      fail('INVALID_REQUEST','Choose a CV input action.');
    }
    if(operation==='DOCK_RECORDS_OPEN_RESUME'){
      if(!record.resume?.snapshot||!validateResume(record.resume.cvJsonRaw).value)fail('NOT_READY','Prepare and save this job’s resume in Resume Studio first.');
      await prepareStudio(record,payload.windowId,true);
      return {...await state(saved),selectedId:record.id};
    }
    if (operation === 'DOCK_RECORDS_STUDIO') {
      if (record.applicationId) fail('INVALID_STATE', 'Open a queued job to prepare a resume.');
      await prepareStudio(record, payload.windowId);
      if (record.status !== 'Ready') { if (record.status !== 'Generating') record.attempt++; record.status = 'Generating'; }
      record.error = ''; touch(record, record.status === 'Ready' ? 'Saved resume opened in Resume Studio' : `Resume Studio opened for attempt ${record.attempt}`); await write(saved);
      return { ...await state(saved), selectedId: record.id };
    }
    if (operation === 'DOCK_RECORDS_RESUME') {
      if (record.applicationId || !['Queued','Generating','Ready','Failed'].includes(record.status)) fail('INVALID_STATE', 'This queue job cannot accept a resume.');
      await flushOpenStudio(payload.windowId);
      const current = await drafts.read(record.candidateId), draft = current.draft;
      if (draft.jobInputRaw !== `${record.url}\n${record.description}`) fail('JOB_MISMATCH', 'Resume Studio contains a different job. Open this job in Studio before saving its result.');
      const parsed = validateResume(draft.cvJsonRaw); if (!parsed.value) fail('INVALID_CV', parsed.message || 'Paste valid CV JSON into Resume Studio first.');
      const candidate = await profiles.get(record.candidateId); if (!candidate) fail('CANDIDATE_REQUIRED','The candidate is no longer available.');
      const snapshot = makeSnapshot(candidate,draft,String(payload.windowId),1).snapshot;
      if (record.resume) record.resumeHistory.unshift(record.resume);
      record.resume = { cvJsonRaw: draft.cvJsonRaw, coverLetterRaw: draft.coverLetterRaw, coverLetterEnabled: draft.coverLetterEnabled, documentTemplate: draft.documentTemplate,
        snapshot, inputRevision: record.inputRevision, candidateRevision: candidate.revision, version: record.resumeHistory.length + 1, savedAt: now() };
      record.candidateName = candidate.document.candidate.name;
      record.status = 'Ready'; record.error = ''; touch(record,'Validated resume saved from Resume Studio'); await write(saved);
      return { ...await state(saved), selectedId: record.id };
    }
    fail('INVALID_REQUEST','Unsupported dock records operation.');
  }) };
}
