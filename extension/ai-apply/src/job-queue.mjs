import { createQueueStore } from './queue-store.mjs';
import { normalizeProfile } from './resume-data.mjs';
import { savedChatUrl } from './saved-chat.mjs';
import { parseManualResume,parseManualDocuments } from './manual-documents.mjs';
import { metadataProvenance } from './job-metadata.mjs';
import { findExistingJob, jobUrlInList } from './job-duplicates.mjs';
import { normalizeDocumentSettings } from './document-settings.mjs';
import { isHiringCafe } from './job-cleanup.mjs';
import { cleanJobUrl } from './job-extraction-core.mjs';
import {generationResultKey} from './generation-selection.mjs';
import {isJobReady} from './job-readiness.mjs';

export function applyGeneratedJobMetadata(draft, run, details, timestamp) {
  const index = draft.requests.findIndex(job => job.id === run.jobId), current = draft.requests[index];
  if (!current || current.state === 'cancelled' || current.input.candidateId !== run.job.input.candidateId) throw new Error('This job is no longer available for the AI result.');
  const resultKey=generationResultKey(run);
  if (current.jobDetailsRunId === resultKey) { draft.requests[index]={...current,needsAction:false}; return { ...current,needsAction:false, updatedAt: current.jobDetailsUpdatedAt }; }
  if (current.updatedAt !== run.job.updatedAt) throw new Error('This job changed while AI was working. Its newer details and documents were preserved.');
  const stale = !!current.resume && ['company', 'role', 'description'].some(key => current.input.job[key] !== details[key]);
  return draft.requests[index] = { ...current, input: { ...current.input, job: { ...current.input.job, ...details } },
    ...(stale ? { documentsStale: true, state: 'attention' } : {}),
    ...(savedChatUrl(run.url) ? { manualChatUrl: savedChatUrl(run.url) } : {}),
    needsAction:false, jobDetailsRunId: resultKey, jobDetailsUpdatedAt: timestamp, updatedAt: timestamp };
}

// Local job/profile/document storage only. No chat connection or runner exists.
export function createJobQueue({ store = createQueueStore(),
  channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel('ai-agent-resume-queue') : null,
  uuid = () => crypto.randomUUID(), now = Date.now } = {}) {
  let state = { requests: [], profiles: [], control: {} }, disposed = false;
  const listeners = new Set();
  const visibleJob = job => ({ ...job,...isJobReady(job)?{state:'ready',needsAction:false,error:''}:{state:job.state === 'cancelled' ? 'cancelled' : job.needsAction ? 'attention' : job.resume && !job.documentsStale ? 'ready' : job.state === 'queued' ? 'queued' : 'attention'} });
  const snapshot = () => ({ ...state, requests: state.requests.map(visibleJob) });
  const notify = () => { if (!disposed) for (const listener of listeners) listener(snapshot()); };
  async function refresh() { if (!disposed) { state = await store.read(); notify(); } }
  async function edit(mutator) {
    const result = await store.change(mutator); state = result.state; notify();
    if (!disposed) channel?.postMessage('changed');
    return result.value;
  }
  function replace(draft, id, patch) {
    const index = draft.requests.findIndex(job => job.id === id);
    if (index < 0) throw new Error('This job no longer exists.');
    draft.requests[index] = { ...draft.requests[index], ...patch, updatedAt: now() };
    return draft.requests[index];
  }
  const ready = refresh().then(snapshot);
  const sharedChanged=(changes,area)=>{if(area==='local'&&(changes['ai-apply-queue-revision']||changes.profile))void refresh().catch(()=>{});};
  globalThis.chrome?.storage?.onChanged?.addListener(sharedChanged);
  channel?.addEventListener('message', () => { void refresh().catch(() => {}); });
  async function importProfile(){throw Error('Replace your resume in Application Tracker Settings to update this profile.');}
  async function add(input, { checkExisting = false, checkExistingUrl = false, capturePending = false } = {}) {
    await ready;
    const copy = structuredClone(input); copy.profile = normalizeProfile(copy.profile);
    if (!copy.candidateId || !copy.job || typeof copy.job.company !== 'string' || typeof copy.job.role !== 'string' ||
      typeof copy.job.description !== 'string' || copy.tailor && !copy.job.description.trim()) throw new Error('Choose a candidate and provide the job description.');
    copy.job.provenance = metadataProvenance(copy.job);
    if (JSON.stringify(copy).length > 300000) throw new Error('This job is too large. Shorten the job description.');
    const id = uuid();
    await edit(draft => {
      if (!draft.profiles.some(profile => profile.id === copy.candidateId)) throw new Error('Import or select a candidate first.');
      if (checkExistingUrl && jobUrlInList(copy.job.url, copy.candidateId, draft.requests)) {
        throw Object.assign(new Error('Already applied'), { code: 'already-applied', duplicate: { matchedBy: ['url'], location: 'job list' } });
      }
      const duplicate = checkExisting && !capturePending && findExistingJob(copy, draft.requests);
      if (duplicate) throw Object.assign(new Error('Already applied'), { code: 'already-applied', duplicate });
      draft.requests.push({ id, input: copy, state: 'queued', resume: null, ...(capturePending ? {capturePending:true,captureOptions:{checkExisting},captureSourceUrl:copy.job.url} : {}),createdAt: now(), updatedAt: now(),
        sequence: Math.max(0, ...draft.requests.map(item => item.sequence || 0)) + 1 });
    });
    return id;
  }
  async function completeCapture(id, input, { runId, sourceUrl, expectedUpdatedAt } = {}) {
    await ready;
    return edit(draft=>{
      const current = draft.requests.find(job=>job.id === id);
      if (!current || current.state === 'cancelled') throw new Error('This pending capture is no longer available.');
      if (runId && current.captureRunId === runId && !current.capturePending) return current;
      if (!current.capturePending || current.input.candidateId !== input.candidateId || expectedUpdatedAt != null && current.updatedAt !== expectedUpdatedAt) throw new Error('The pending capture changed. Review its details before saving.');
      if (!input.job.company?.trim() || !input.job.role?.trim() || !input.job.description?.trim()) throw new Error('Provide the employer, advertised title and job description.');
      if (!cleanJobUrl(input.job.url) || isHiringCafe(input.job.url)) throw new Error('Provide the employer or ATS Apply URL, not a HiringCafe page.');
      const other = draft.requests.filter(job=>job.id !== id && !job.capturePending);
      const duplicate = findExistingJob(input,other);
      if (duplicate && (current.captureOptions?.checkExisting || duplicate.matchedBy.includes('url'))) throw Object.assign(new Error('Already applied'),{code:'already-applied',duplicate});
      const copy = structuredClone(input); delete copy.job.cleanupEvidence;
      return replace(draft,id,{input:copy,capturePending:false,...(runId ? {captureRunId:runId} : {}),
        ...(savedChatUrl(sourceUrl) ? {manualChatUrl:savedChatUrl(sourceUrl)} : {}),state:'queued',error:''});
    });
  }
  async function selectCandidate(id) {
    await ready;
    await edit(draft => { if (draft.profiles.some(profile => profile.id === id)) draft.control = { ...draft.control, selectedCandidateId: id }; });
  }
  async function cancel(id) { await ready; await edit(draft => replace(draft, id, { state: 'cancelled', error: '' })); }
  async function connect(id, value) {
    const url = savedChatUrl(value);
    if (!url) throw new Error('Open the job conversation in Chat first.');
    await ready; await edit(draft => replace(draft, id, { manualChatUrl: url }));
  }
  async function updateJob(id,input,expectedUpdatedAt,{checkExisting=true}={}) {
    await ready;
    return edit(draft=>{
      const current=draft.requests.find(job=>job.id===id);
      if(!current||current.state==='cancelled'||current.input.candidateId!==input.candidateId) throw new Error('This job is no longer available.');
      if(current.updatedAt!==expectedUpdatedAt) throw new Error('This job changed. Reopen its details before editing.');
      const job=structuredClone(input.job);
      if(!job.company?.trim()||!job.role?.trim()||!job.description?.trim()) throw new Error('Provide the company, job title and job description.');
      if(job.url&&(!cleanJobUrl(job.url)||isHiringCafe(job.url))) throw new Error('Use the employer or ATS Apply URL.');
      if(JSON.stringify(input).length>300000) throw new Error('This job is too large. Shorten its description.');
      const duplicate=checkExisting&&findExistingJob(input,draft.requests.filter(item=>item.id!==id));
      if(duplicate) throw Object.assign(new Error('Already applied'),{code:'already-applied',duplicate});
      const stale=!!current.resume&&['company','role','description'].some(key=>current.input.job[key]!==job[key]);
      if(['company','role','description','url'].some(key=>current.input.job[key]!==job[key])) delete job.cleanupEvidence;
      if(job.salary!==current.input.job.salary){delete job.salaryDetails;job.salarySource='user';job.salaryEvidence='';job.salaryBasis='';}
      return replace(draft,id,{input:{...current.input,job},...(stale?{documentsStale:true,state:'attention'}:{})});
    });
  }
  function documentChange(draft, id, { json, resume: raw, coverLetter = '', coverLetterEnabled = false, expectedUpdatedAt, expectedRevision, generationId, sourceUrl }, source = 'manual') {
    if (typeof coverLetter !== 'string' || coverLetter.length > 50000 || coverLetterEnabled && !coverLetter.trim()) throw new Error('Add a cover letter under 50,000 characters or turn it off.');
    const current = draft.requests.find(job => job.id === id);
    if (!current || current.state === 'cancelled') throw new Error('This job is no longer in the queue.');
    // A worker can stop after the job transaction commits but before its run
    // metadata is updated. Repeating that save must preserve later manual edits.
    if (source === 'automatic' && current.documentRunId === generationId) return current;
    if (current.updatedAt !== expectedUpdatedAt || expectedRevision!==undefined&&current.canonicalRevision!==expectedRevision) throw new Error('This job changed in another view. Reopen its document form before saving.');
    const parsed=json===undefined?null:parseManualDocuments(json,current);
    const resume=parsed?.resume||(raw?.trim()?parseManualResume(raw,current):coverLetterEnabled?current.resume||null:parseManualResume(raw,current)),savedAt=now();
    if(parsed){coverLetter=parsed.coverLetter;coverLetterEnabled=!!coverLetter;}
    return replace(draft, id, { resume, coverLetter: coverLetter.trim(), coverLetterEnabled: Boolean(coverLetterEnabled),
      ...(parsed?.job?{input:{...current.input,job:{...current.input.job,...parsed.job}}}:{}),
      ...(typeof generationId === 'string' ? { documentRunId: generationId } : {}),
      ...(savedChatUrl(sourceUrl) ? { manualChatUrl: savedChatUrl(sourceUrl) } : {}),
      state: resume?'ready':'queued', needsAction:false, documentsStale: raw?.trim()?false:!!current.documentsStale, error: '', documentSaveSource: source, documentSavedAt: savedAt,
      ...(source === 'manual' ? { manualDocumentUpdatedAt: savedAt } : {}), completedAt: savedAt });
  }
  async function saveDocuments(id, documents) {
    await ready;
    await edit(draft => documentChange(draft, id, documents));
  }
  async function saveRetrievedDocuments(id,{result,settings,expectedUpdatedAt,expectedRevision,generationId,sourceUrl}){
    await ready;
    return edit(draft=>{
      const current=draft.requests.find(job=>job.id===id&&job.state!=='cancelled');
      if(!current)throw Error('This job is no longer in the queue.');
      if(current.updatedAt!==expectedUpdatedAt||expectedRevision!==undefined&&current.canonicalRevision!==expectedRevision)throw Error('This job changed in another view. Reopen Manual retrieval before saving.');
      const changed=result.job&&['company','role','description'].some(key=>current.input.job[key]!==result.job[key]);
      const stale=settings.includeResume?false:!!current.documentsStale||!!(changed&&current.resume);
      const resume=settings.includeResume?result.resume:current.resume;
      const savedAt=now();
      return replace(draft,id,{
        ...(result.job?{input:{...current.input,job:{...current.input.job,...result.job}},jobDetailsRunId:generationId,jobDetailsUpdatedAt:savedAt}:{}),
        ...(settings.includeResume?{resume:result.resume}:{}),
        ...(settings.includeCoverLetter?{coverLetter:result.coverLetter,coverLetterEnabled:true}:{}),
        ...(savedChatUrl(sourceUrl)?{manualChatUrl:savedChatUrl(sourceUrl)}:{}),
        state:resume&&!stale?'ready':'queued',needsAction:false,error:'',documentsStale:stale,
        documentRunId:generationId,documentSaveSource:'manual',documentSavedAt:savedAt,manualDocumentUpdatedAt:savedAt,completedAt:savedAt
      });
    });
  }
  async function saveGeneratedDocuments(run) {
    await ready;
    if (run?.phase !== 'complete' || !run.result || !run.id || run.jobId !== run.job?.id || !Number.isFinite(run.job.updatedAt)) {
      throw new Error('Only validated documents with a saved job snapshot can be saved automatically.');
    }
    const { includeCoverLetter,includeResume=true } = normalizeDocumentSettings(run.documentSettings);
    const resultKey=generationResultKey(run);
    if(!includeResume)return edit(draft=>{
      const current=draft.requests.find(job=>job.id===run.jobId&&job.state!=='cancelled');
      if(!current)throw Error('This job is no longer in the queue.');
      if(current.documentRunId===resultKey)return current;
      if(current.updatedAt!==run.job.updatedAt)throw Error('This job changed while AI was working.');
      if(!includeCoverLetter)return current;
      return replace(draft,current.id,{coverLetter:run.result.coverLetter,coverLetterEnabled:true,documentRunId:resultKey,documentSavedAt:now(),documentSaveSource:'automatic'});
    });
    if(!run.result.resume)throw Error('A validated resume is required.');
    return edit(draft => documentChange(draft, run.jobId, {
      resume: JSON.stringify(run.result.resume), coverLetter: includeCoverLetter ? run.result.coverLetter : draft.requests.find(job=>job.id===run.jobId)?.coverLetter||'', coverLetterEnabled: includeCoverLetter||draft.requests.find(job=>job.id===run.jobId)?.coverLetterEnabled===true,
      expectedUpdatedAt: run.job.updatedAt, generationId: resultKey, sourceUrl: run.url
    }, 'automatic'));
  }
  return { ready, snapshot, refresh, add, completeCapture, importProfile, selectCandidate, cancel, connect, updateJob, saveDocuments, saveRetrievedDocuments, saveGeneratedDocuments,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    profileOptions: () => state.profiles.map(record => ({ ...record.data, id: record.id, filename: record.filename, isExample: record.isExample,
      initials: record.data.name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() })),
    dispose() { disposed = true; globalThis.chrome?.storage?.onChanged?.removeListener(sharedChanged); channel?.close(); listeners.clear(); } };
}
