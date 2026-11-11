import { safeJobUrl } from './reference-dashboard-data.js';
import { flushStudioTab } from './navigation-flush.js';
import { createProfileNameLookup } from './profile-display.js';
import {QUEUE_SAMPLES,sampleResume} from './queue-samples.js';
import {createQueueResumeEditor} from './queue-resume-editor.js';

export const DOCK_RECORD_OPERATIONS = ['DOCK_RECORDS_STATE', 'DOCK_RECORDS_MUTATE', 'DOCK_RECORDS_STUDIO', 'DOCK_RECORDS_RESUME','DOCK_RECORDS_SEED_SAMPLES','DOCK_RECORDS_OPEN_RESUME','DOCK_RECORDS_CV_INPUT'];
export const APPLICATION_STAGES = ['applied', 'screen', 'interview', 'offer', 'rejected', 'archived'];
const key = 'dock-job-records:v1';
const hash = value => { let result = 2166136261; for (const c of value) result = Math.imul(result ^ c.charCodeAt(0),16777619); return (result >>> 0).toString(16); };
const signature = raw => JSON.stringify([raw.id ?? null, raw.jobLink, raw.jobTitle, raw.companyName, raw.companyLink, raw.date, raw.profileName, raw.status]);
const identity = raw => raw.id ? `remote:${raw.id}` : `legacy:${hash(JSON.stringify([raw.jobLink,raw.jobTitle,raw.companyName,raw.date,raw.profileName]))}`;
const anchor = raw => JSON.stringify([raw.jobLink,raw.date,raw.profileName]);
const empty = () => ({ schemaVersion: 1, jobs: [], applications: {}, aliases: {}, receipts: {} });

export function createDockRecordsService({ browser, storage, profiles, drafts, prompts, validateResume, makeSnapshot, parseCoverLetter, resumeExports, openStudio, saveApplication, syncApplication, now = () => new Date().toISOString() }) {
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
    return saved;
  }
  async function write(saved) { await storage.set({ [key]: saved }); }
  async function rawApplications() {
    const raw = (await browser.storage.local.get('appliedList')).appliedList ?? [];
    if (!Array.isArray(raw)) fail('CORRUPT_STORAGE', 'Saved application records could not be read.');
    return raw;
  }
  function applications(saved, raw) {
    const seen = new Map();
    const anchors = new Map(); for (const record of raw) if (record && typeof record === 'object') anchors.set(anchor(record),(anchors.get(anchor(record)) || 0) + 1);
    return raw.map((record, index) => {
      if (!record || typeof record !== 'object') return null;
      const base = identity(record), occurrence = seen.get(base) || 0; seen.set(base, occurrence + 1);
      const alias = `${base}:${occurrence}`, linked = anchors.get(anchor(record)) === 1 ? Object.entries(saved.applications).find(([,meta]) => meta.sourceAnchor === anchor(record))?.[0] : null;
      const id = saved.aliases[alias] || linked || alias, meta = saved.applications[id] || {};
      return { id, type: 'applications', revision: `${meta.revision || 0}:${hash(signature(record))}`, candidateId: meta.candidateId || null,
        candidateName: meta.candidateName || record.profileName || 'Saved profile', company: record.companyName || 'Company not provided', role: record.jobTitle || 'Untitled role',
        url: safeJobUrl(record.jobLink), status: String(record.status || 'applied').toLowerCase().replace('screening','screen').replace('failed','archived'),
        createdAt: record.date, updatedAt: meta.updatedAt || record.date, notes: meta.notes || '', description: meta.description || '', conversationUrl: meta.conversationUrl || '',
        resume: meta.resume || null, coverLetterRaw:meta.coverLetterRaw??meta.resume?.coverLetterRaw??'',coverLetterEnabled:meta.coverLetterEnabled??!!meta.resume?.coverLetterEnabled,events: meta.events || [{ label: 'Application recorded', at: record.date }], syncWarning: meta.syncWarning || '',
        sourceIndex: index, alias };
    }).filter(Boolean);
  }
  async function state(saved) {
    const candidate = await profiles.bootstrap();
    const candidates=profiles.list?await profiles.list({includeProfileName:true}):[];
    if(candidate)candidates.push({id:candidate.id,name:candidate.document.candidate.name,profileName:candidate.profile.profileName});
    const displayName=createProfileNameLookup(candidates),raw=await rawApplications();
    const apps = applications(saved,raw).map(({sourceIndex,alias,...record})=>({...record,candidateName:displayName({...record,profileName:raw[sourceIndex].profileName})}));
    const jobs = saved.jobs.filter(job => !job.deletedAt && !job.applicationId && (!candidate || job.candidateId === candidate.id)).map(job=>({...job,candidateName:displayName(job)}));
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
  async function mutate(saved, payload) {
    const action = payload.action;
    if (typeof payload.mutationId !== 'string' || !payload.mutationId || payload.mutationId.length > 128) fail('INVALID_REQUEST', 'A mutation ID is required.');
    const requestSignature = JSON.stringify(payload);
    if (saved.receipts[payload.mutationId]) {
      const receipt = saved.receipts[payload.mutationId];
      if (receipt.signature !== requestSignature) fail('MUTATION_CONFLICT', 'This operation ID was already used for different content.');
      return { ...await state(saved), selectedId: receipt.id };
    }
    let selectedId = payload.id;
    if(action==='create-application'){
      const candidate=await profiles.bootstrap();if(!candidate)fail('CANDIDATE_REQUIRED','Create a candidate profile in Settings before adding applications.');
      const input=payload.fields||{},company=text(input.company,300,'a company name',true),role=text(input.role,500,'a role',true),jobLink=input.url?url(input.url):'';
      const meta={candidateId:candidate.id,candidateName:candidate.document.candidate.name,notes:text(input.notes||'',10000,'notes'),description:text(input.description||'',160000,'a job description'),conversationUrl:conversation(input.conversationUrl||''),revision:1,updatedAt:now(),events:[{label:'Application added manually',at:now()}]};
      const raw=await rawApplications(),entry={id:crypto.randomUUID(),jobTitle:role,companyName:company,jobLink,companyLink:jobLink?new URL(jobLink).origin:'',date:new Date(now()).toString(),status:'applied',profileName:candidate.profile.profileName};
      await browser.storage.local.set({appliedList:[entry,...raw]});
      try{await syncApplication(entry);}catch{meta.syncWarning='Saved locally. Remote sync could not complete.';}
      const record=applications(saved,[entry])[0];selectedId=record.id;saved.applications[record.id]={...meta,sourceAnchor:anchor(entry)};saved.aliases[record.alias]=record.id;
    } else if (action === 'create') {
      if (saved.jobs.filter(item => !item.isMock&&!item.deletedAt && !item.applicationId).length >= 500) fail('QUEUE_LIMIT', 'The queue supports up to 500 active jobs.');
      const candidate = await profiles.bootstrap();
      if (!candidate) fail('CANDIDATE_REQUIRED', 'Create a candidate profile in Settings before adding jobs.');
      const input = payload.fields || {}, jobUrl = url(input.url);
      const duplicate = saved.jobs.find(item => !item.isMock&&!item.deletedAt && !item.applicationId && item.candidateId === candidate.id && item.url === jobUrl);
      if (duplicate) fail('DUPLICATE_JOB', 'This job is already in the candidate’s queue.');
      const library = await prompts.read(), templateId = candidate.document.applicationPreferences?.assignedPromptTemplateId || library.selectedId;
      const record = { id: crypto.randomUUID(), type: 'queue', candidateId: candidate.id, candidateName: candidate.document.candidate.name, candidateRevision: candidate.revision,
        company: text(input.company,300,'a company name',true), role: text(input.role,500,'a role',true), salary:text(input.salary||'',200,'a salary'),url: jobUrl,
        description: text(input.description,160000,'a job description',true), notes: text(input.notes || '',10000,'notes'), conversationUrl: conversation(input.conversationUrl || ''),
        promptTemplateId: templateId, promptSnapshot: structuredClone(library.templates.find(item => item.id === templateId) || library.templates.find(item => item.id === library.selectedId)),
        status: 'Queued', revision: 1, inputRevision: 1, attempt: 0, resume: null, resumeHistory: [], createdAt: now(), updatedAt: now(), events: [{ label: 'Job added to queue', at: now() }] };
      saved.jobs.unshift(record); selectedId = record.id;
    } else if (action === 'delete-all') {
      const candidate=await profiles.bootstrap();
      if(!candidate||payload.candidateId!==candidate.id)fail('CANDIDATE_CONFLICT','Select the same candidate before clearing the queue.');
      const targets=saved.jobs.filter(record=>record.candidateId===candidate.id&&!record.deletedAt&&!record.applicationId);
      if(!Array.isArray(payload.jobs)||payload.jobs.length!==targets.length||targets.some(record=>!payload.jobs.some(item=>item.id===record.id&&item.revision===record.revision)))fail('CONFLICT','The queue changed. Refresh it before deleting all jobs.');
      for(const record of targets){record.deletedAt=now();touch(record,'Job removed');}
      selectedId=null;
    } else if (payload.type === 'applications') {
      if (action !== 'update') fail('INVALID_REQUEST', 'Only application updates are supported here.');
      const raw = await rawApplications(), record = applications(saved, raw).find(item => item.id === payload.id);
      if (!record) fail('NOT_FOUND', 'This application is no longer available.');
      if (record.revision !== payload.expectedRevision) fail('CONFLICT', 'The application changed. Your edits are retained; reload the saved record before trying again.');
      const input = payload.fields || {}, status = input.status;
      if (!APPLICATION_STAGES.includes(status)) fail('INVALID_STATUS', 'Choose an available application stage.');
      const previous = saved.applications[record.id] || {},attachments=await documents(record,input);
      const meta = { ...previous, sourceAnchor:anchor(raw[record.sourceIndex]), notes: text(input.notes || '',10000,'notes'), conversationUrl: conversation(input.conversationUrl || ''), revision: (previous.revision || 0) + 1, updatedAt: now(),
        ...attachments,events: [{ label: status === record.status ? 'Record updated' : `Status changed to ${status}`, at: now() }, ...record.events] };
      const nextRaw = { ...raw[record.sourceIndex], status };
      // Re-read before committing; a stale dock must never replace web edits.
      const latest = await rawApplications();
      if (signature(latest[record.sourceIndex] || {}) !== signature(raw[record.sourceIndex])) fail('CONFLICT', 'The application changed. Reload it before saving.');
      latest[record.sourceIndex] = nextRaw;
      await browser.storage.local.set({ appliedList: latest });
      try { await syncApplication(nextRaw); meta.syncWarning = ''; } catch { meta.syncWarning = 'Saved locally. Remote sync could not complete; save again to retry.'; }
      saved.applications[record.id] = meta;
      saved.aliases[record.alias] = record.id;
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
        record.deletedAt = now(); touch(record, record.isMock?'Job removed':'Job removed'); selectedId = null;
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
        if(record.isMock)fail('SAMPLE_JOB','Preview jobs cannot be used for applications. Add a real job before recording an application.');
        if (record.status !== 'Ready' || !record.resume || record.resume.inputRevision !== record.inputRevision) fail('INVALID_STATE', 'Save a current, validated resume before marking this job applied.');
        const candidate = await profiles.get(record.candidateId);
        if (!candidate) fail('CANDIDATE_REQUIRED', 'The candidate profile is no longer available.');
        if(payload.expectedCandidateRevision!==undefined&&(candidate.revision!==payload.expectedCandidateRevision||record.resume.version!==payload.expectedResumeVersion||record.inputRevision!==payload.expectedInputRevision))fail('RUN_STALE','The profile, job or prepared resume changed. Review a new application run.');
        if ((await profiles.bootstrap())?.id !== record.candidateId) fail('CANDIDATE_CONFLICT', 'Select this job’s candidate in the dock before recording its application.');
        record.submission ||= { at: now() };
        // Keep the fixed submission time before crossing into SpeedyApply storage.
        // Its duplicate check and this receipt make interrupted retries safe.
        await write(saved);
        const input = { jobTitle: record.role, jobLink: record.url, companyName: record.company, companyLink: new URL(record.url).origin, appliedDate: new Date(record.submission.at), profileDetails: { profileName: candidate.profile.profileName }, duplicateCheck: true };
        let warning = '';
        try { await saveApplication(input); } catch { warning = 'The application was saved locally; remote sync may need another attempt.'; }
        const raw = await rawApplications(), expectedDate = input.appliedDate.toString();
        const applicationsNow = applications(saved, raw), created = applicationsNow.find(item => {
          const source = raw[item.sourceIndex]; return source.jobLink === record.url && source.jobTitle === record.role && source.profileName === candidate.profile.profileName && source.date.slice(0,15) === expectedDate.slice(0,15);
        });
        if (!created) fail('SAVE_FAILED', 'The application could not be saved. Your ready job is retained; try again.');
        record.applicationId = created.id; record.status = 'Applied'; touch(record, 'Submission manually recorded as Applied'); selectedId = created.id;
        saved.applications[created.id] = { sourceAnchor:anchor(raw[created.sourceIndex]), candidateId: record.candidateId, candidateName: record.candidateName, queueId: record.id, description: record.description, notes: record.notes,
          conversationUrl: record.conversationUrl, resume: record.resume, events: record.events, revision: 1, updatedAt: now(), syncWarning: warning };
      } else fail('INVALID_REQUEST', 'Unsupported queue action.');
    }
    saved.receipts[payload.mutationId] = { signature: requestSignature, id: selectedId };
    const ids = Object.keys(saved.receipts); for (const id of ids.slice(0, Math.max(0,ids.length - 100))) delete saved.receipts[id];
    await write(saved);
    return { ...await state(saved), selectedId };
  }
  return { handle: (operation, payload, sender) => serial(async () => {
    const saved = await read();
    if (operation === 'DOCK_RECORDS_STATE') return state(saved);
    if(operation==='DOCK_RECORDS_SEED_SAMPLES'){
      const candidate=await profiles.bootstrap();if(!candidate||saved.sampleCandidates?.[candidate.id])return state(saved);
      const current=await drafts.bootstrap(candidate.id),base=current.record.draft;
      const samples=QUEUE_SAMPLES.map(sample=>{
        const id=`sample:${candidate.id}:${sample.key}`,url=`https://example.com/sample-jobs/${sample.key}`,cv=sampleResume(candidate,sample),cvJsonRaw=JSON.stringify(cv);
        const parsed=validateResume(cvJsonRaw);if(!parsed.value)fail('INVALID_CV','The resume could not be prepared.');
        const draft={...base,jobInputRaw:`${url}\n${sample.description}`,cvJsonRaw,coverLetterRaw:'',coverLetterEnabled:false,bindings:{experience:[],education:[]}};
        const snapshot=makeSnapshot(candidate,draft,`sample:${candidate.id}`,1).snapshot;
        return {id,type:'queue',isMock:true,candidateId:candidate.id,candidateName:candidate.document.candidate.name,candidateRevision:candidate.revision,
          company:sample.company,role:sample.role,url,description:sample.description,notes:'Job for previewing the queue interface.',conversationUrl:'',status:'Ready',revision:1,inputRevision:1,attempt:0,
          resume:{cvJsonRaw,coverLetterRaw:'',coverLetterEnabled:false,documentTemplate:draft.documentTemplate,snapshot,inputRevision:1,candidateRevision:candidate.revision,version:1,savedAt:now()},
          resumeHistory:[],createdAt:now(),updatedAt:now(),events:[{label:'Job added',at:now()}]};
      });
      saved.jobs.push(...samples);saved.sampleCandidates={...saved.sampleCandidates,[candidate.id]:true};await write(saved);return state(saved);
    }
    if (operation === 'DOCK_RECORDS_MUTATE') return mutate(saved, payload);
    const record = job(saved, payload);
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
    if(record.isMock)fail('SAMPLE_JOB','Preview jobs cannot be used for applications. Add a real job to prepare a resume.');
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
