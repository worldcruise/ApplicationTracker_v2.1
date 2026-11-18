import {savedPDFPreview} from './saved-pdf-preview.mjs';
import {matchesApplicationSession,sameApplicationUrl} from './application-identity.mjs';
import { icon } from './icons.mjs';
import { prompts, connectPromptSettings } from './studio-prompts.mjs';
import { savedChatUrl, requestChatUrl } from './saved-chat.mjs';
import { resumeTemplates, resumeTemplate } from './resume-templates.mjs';
import { metadataProvenance, provenanceLabel } from './job-metadata.mjs';
import { requestJobPageAccess } from './job-page-access.mjs';
import { canCaptureJobUrl } from './job-capture-url.mjs';
import { duplicateCheckStorageKey, duplicateJobUrl, jobUrlInList } from './job-duplicates.mjs';
import { createQueueDocuments } from './queue-documents.mjs';
import {createManualRetrieval} from './manual-retrieval.mjs';
import { createManualJobForm } from './manual-job-form.mjs';
import {isJobReady} from './job-readiness.mjs';
import { phaseLabel, runningPhases } from './generation-data.mjs';
import {selectedDocumentSettings,sameGenerationSelection} from './generation-selection.mjs';
import { readDocumentSettings, DOCUMENT_SETTINGS_KEY, normalizeDocumentSettings } from './document-settings.mjs';
import { cleanupInput,isHiringCafe } from './job-cleanup.mjs';
import { companyMonogram, createApplyJobs } from './apply-jobs.mjs';
import { batchKey } from './resume-batch.mjs';
import { importJobCsv } from './job-csv.mjs';
import {requestDocumentExportAccess} from '../../studio/document-export-directory.js';

export function createStudio({ openDialog, showStudio, showChat, syncChat = async () => {}, moveTab, queue,
  generations, openApplication, getChatProvider = () => 'chatgpt', getCurrentChat = () => null,onApplySelection=()=>{} }) {
  const q = selector => document.querySelector(selector);
  let requests = [], generationSettings={},applicationSession=null,applicationSessionSignature='';
  const generationSettingsReady=readDocumentSettings().then(value=>{generationSettings=value;});
  const generationSettingsChanged=(changes,area)=>{if(area==='local'&&changes[DOCUMENT_SETTINGS_KEY]){generationSettings=normalizeDocumentSettings(changes[DOCUMENT_SETTINGS_KEY].newValue);renderQueue();}};
  chrome.storage.onChanged.addListener(generationSettingsChanged);
  window.addEventListener('pagehide',()=>chrome.storage.onChanged.removeListener(generationSettingsChanged),{once:true});
  const documents = createQueueDocuments({ queue, openDialog,
    getRequest: id => requests.find(item => item.id === id && item.input.candidateId === candidateId()),
    onSaved: () => { clearPreview(); showStudio(q('#apply-tab').getAttribute('aria-selected') === 'true' ? 'apply' : 'results'); status('Resume and cover letter saved.'); }
  });
  const manualRetrieval=createManualRetrieval({openDialog,getRequest:id=>requests.find(item=>item.id===id&&item.input.candidateId===candidateId()),
    saveResult:async(id,payload)=>{const value=await generations.importResult(id,payload);await queue.refresh();return value;},
    onSaved:()=>{clearPreview();showStudio(q('#apply-tab').getAttribute('aria-selected')==='true'?'apply':'results');status('JSON result saved.');}
  });
  const manualJob = createManualJobForm({ openDialog, saveRequest });
  let profiles = {};
  let initialized = false;
  const pendingActions = new Set();
  const awaitingReview = new Set();
  const captureFallbacks = new Set();
  let noticeTimer, duplicateOptionSaving = false;
  function showNotice(title, message) {
    clearTimeout(noticeTimer);
    q('#queue-notice-title').textContent = title;
    q('#queue-notice-message').textContent = message;
    q('#queue-notice').hidden = false;
    q('.queue-bar').title = `${title}. ${message}`;
    noticeTimer = setTimeout(() => { q('#queue-notice').hidden = true; }, 7000);
  }
  q('#queue-notice-dismiss').addEventListener('click', () => { clearTimeout(noticeTimer); q('#queue-notice').hidden = true; });
  const duplicateOptionReady = chrome.storage.local.get(duplicateCheckStorageKey)
    .then(value => { q('#check-existing-jobs').checked = value[duplicateCheckStorageKey] !== false; })
    .catch(() => { q('#check-existing-jobs').checked = true; })
    .finally(() => { q('#check-existing-jobs').disabled = false; });
  q('#check-existing-jobs').addEventListener('change', () => {
    if (duplicateOptionSaving) return;
    duplicateOptionSaving = true; q('#check-existing-jobs').disabled = true;
    void chrome.storage.local.set({ [duplicateCheckStorageKey]: q('#check-existing-jobs').checked }).catch(() => {
      q('#check-existing-jobs').checked = true;
      showNotice('Check option could not be saved', 'Duplicate checking stays on. Try changing the option again.');
    }).finally(() => { duplicateOptionSaving = false; q('#check-existing-jobs').disabled = false; });
  });
  const duplicateOptionChanged = (changes, area) => {
    if (area === 'local' && changes[duplicateCheckStorageKey] && !duplicateOptionSaving) q('#check-existing-jobs').checked = changes[duplicateCheckStorageKey].newValue !== false;
  };
  chrome.storage.onChanged.addListener(duplicateOptionChanged);
  let selectionLoaded = false;
  let currentTabId = null;
  let currentTabUrl = '', currentTabBusy = false;
  let previewId = null;
  let expandedCard = null;
  let batchState = null;
  const batchChanged = (changes, area) => { if (area === 'local' && changes[batchKey]) { batchState = changes[batchKey].newValue; renderQueue(); } };
  chrome.storage.onChanged.addListener(batchChanged);
  void chrome.storage.local.get(batchKey).then(saved => { batchState = saved[batchKey]; renderQueue(); }).catch(() => {});
  const applyJobs = createApplyJobs({ onSelectionChange: request => {
    onApplySelection(request);
    clearPreview();
    if (q('#apply-tab').getAttribute('aria-selected') === 'true') syncApplyChat(request);
  } });
  function syncApplyChat(request = applyJobs.selected(), options) {
    const url = request && (generations.forJob(request.id)?.url || requestChatUrl(request));
    return syncChat(url, options).catch(error => {
      if (request && applyJobs.selected()?.id === request.id) q('#apply-feedback').textContent = error.message;
    });
  }
  q('#apply-tab').addEventListener('click', () => syncApplyChat());
  let detailRequestId = null;
  let queueSearch = '', queueFilter = 'all';
  let reading = null;
  const readFeedback = new Map();
  const jobDrafts = new Map();
  const provenanceDrafts = new Map();
  function rememberSource(key, value, descriptor) {
    const current = provenanceDrafts.get(currentTabId) || {};
    provenanceDrafts.set(currentTabId, { ...current, [key]: { ...descriptor, value: value.trim() } });
  }
  const manualUrls = new Set();
  const releaseTabDraft = id => {
    jobDrafts.delete(id);provenanceDrafts.delete(id);readFeedback.delete(id);manualUrls.delete(id);
    if(currentTabId===id){currentTabId=null;for(const selector of Object.values(jobFields))q(selector).value='';}
  };
  chrome.tabs.onRemoved.addListener(releaseTabDraft);
  const jobFields = { company: '#job-company', role: '#job-title', url: '#job-url', description: '#job-description' };
  const jobDraft = () => Object.fromEntries(Object.entries(jobFields).map(([key, selector]) => [key, q(selector).value]));
  const status = text => { q('#workspace-status').textContent = text; q('.queue-bar').title = text; };
  const candidateId = () => q('#candidate').value;
  const profile = () => profiles[candidateId()] || {name:'Upload your resume',role:'No profile yet',summary:'Open Application Tracker Settings to create your profile from a resume.',skills:[],experience:[],education:[],isExample:false,filename:''};
  let csvInput = null, csvBusy = false, csvCheckExisting = true;
  for (const id of ['import-job-csv','manual-job-import']) q('#'+id).addEventListener('click', () => {
    if (csvBusy) return;
    csvInput = q('#manual-job-dialog').open ? manualJob.context() : structuredClone({ candidateId:candidateId(),profile:profile(),resumeTemplate:q('#resume-template').value,promptTemplate:q('#prompt-template').value,prompt:prompts[q('#prompt-template').value].text });
    csvCheckExisting = q('#check-existing-jobs').checked;
    q('#job-csv-file').value = ''; q('#job-csv-file').click();
  });
  q('#job-csv-dialog').addEventListener('cancel', event => { if (csvBusy) event.preventDefault(); });
  q('#job-csv-file').addEventListener('change', async event => {
    const file = event.target.files?.[0], input = csvInput;
    if (!file || !input || csvBusy) return;
    csvBusy = true;
    q('#job-csv-context').textContent = `Adding jobs for ${input.profile.name}`;
    q('#job-csv-status').textContent = 'Reading and adding jobs…'; q('#job-csv-errors').textContent = '';
    openDialog('job-csv-dialog');
    for (const button of q('#job-csv-dialog').querySelectorAll('button')) button.disabled = true;
    for (const id of ['import-job-csv','manual-job-import']) q('#'+id).disabled = true;
    try {
      if (file.size > 2000000) throw new Error('Choose a CSV file under 2 MB.');
      const result = await importJobCsv(await file.text(), input, queue, {checkExisting:csvCheckExisting});
      q('#job-csv-status').textContent = `${result.added} added · ${result.duplicates} duplicates skipped · ${result.invalid} invalid rows`;
      q('#job-csv-errors').textContent = result.errors.slice(0,20).join('\n') + (result.errors.length > 20 ? '\nMore invalid rows omitted.' : '');
    } catch (error) { q('#job-csv-status').textContent = error.message || 'The CSV could not be imported.'; }
    finally {
      csvBusy = false;
      for (const button of q('#job-csv-dialog').querySelectorAll('button')) button.disabled = false;
      for (const id of ['import-job-csv','manual-job-import']) q('#'+id).disabled = false;
    }
  });
  async function perform(task, key = 'general') {
    if (pendingActions.has(key)) return;
    const reflectPending = () => { document.documentElement.dataset.studioBusy = String(pendingActions.size > 0); };
    pendingActions.add(key); reflectPending(); renderQueue();
    try { return await task(); }
    catch (error) {
      if (error.code === 'already-applied') {
        const field = error.duplicate.matchedBy.includes('company') ? 'Company' : 'Job URL';
        showNotice('Already applied', `${field} already exists in this candidate’s ${error.duplicate.location}. Nothing was added.`);
      } else { status(error.message); q('#profile-import-status').textContent = error.message; }
    }
    finally { pendingActions.delete(key); reflectPending(); renderQueue(); }
  }
  function renderCandidate() {
    const current = profile();
    q('#profile-filename').textContent = `${current.filename}${current.isExample !== false ? ' · Example profile' : ''}`;
    q('#profile-name').textContent = current.name;
    q('#profile-role').textContent = current.role;
    q('#profile-summary').textContent = current.summary;
    q('#profile-skills').replaceChildren(...current.skills.map(text => element('span', '', text)));
    q('#profile-kind').textContent = current.isExample !== false ? 'Example profile' : 'Imported profile';
  }
  function updateQueue(value) {
    requests = value.requests;
    const selected = selectionLoaded ? candidateId() : value.control.selectedCandidateId || candidateId();
    selectionLoaded = true;
    const options = queue.profileOptions();
    profiles = Object.fromEntries(options.map(item => [item.id, item]));
    const groups = [element('optgroup'), element('optgroup')]; groups[0].label = 'Your profiles'; groups[1].label = 'Example profiles';
    for (const item of options) {
      const option = element('option', '', item.name); option.value = item.id;
      groups[item.isExample ? 1 : 0].append(option);
    }
    q('#candidate').replaceChildren(...groups.filter(group => group.children.length));
    q('#candidate').value = profiles[selected] ? selected : options.find(item => !item.isExample)?.id || options[0]?.id;
    document.documentElement.dataset.hasProfile=String(options.length>0);
    renderCandidate(); renderQueue();
    if (q('#request-dialog').open) {
      const current = requests.find(request => request.id === detailRequestId && request.input.candidateId === candidateId() && request.state !== 'cancelled');
      if (current) requestDetails(current, false); else q('#request-dialog').close();
    }
  }
  q('#resume-template').replaceChildren(...resumeTemplates.map(template => {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = template.name;
    return option;
  }));

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function action(text, glyph, name, id) {
    const button = element('button', 'button');
    button.type = 'button';
    button.dataset.action = name;
    button.dataset.request = String(id);
    if (glyph) button.append(icon(glyph));
    button.append(document.createTextNode(text));
    button.disabled = pendingActions.has(`${name}:${id}`);
    return button;
  }
  function clearPreview() {
    previewId = null;
    if (q('#resume-preview-dialog').open) q('#resume-preview-dialog').close();
    q('#resume-paper').replaceChildren();
    if (q('#cover-letter-dialog').open) q('#cover-letter-dialog').close();
    q('#cover-letter-copy').replaceChildren();
  }
  function renderQueue() {
    q('#studio-dock-toggle .preview-label').textContent = 'Saved jobs';
    const all = requests.filter(request => request.input.candidateId === candidateId() && request.state !== 'cancelled' && !request.capturePending);
    const own = all.map(job=>{if(isJobReady(job))return {...job,state:'ready',needsAction:false,error:''};const run=generations.forJob(job.id);return run&&(['attention','invalid','stopped'].includes(run.phase)||run.trackingState==='suspended'||['failed','partial'].includes(run.downloads?.state)) ? {...job,state:'attention'} : job;});
    const batchActive = batchState?.active;
    const queued = own.filter(job => job.state === 'queued' && !job.resume && !job.isExample && !generations.forJob(job.id));
    q('#generate-all-resumes').disabled = pendingActions.has('batch') || !batchActive && (!initialized || !queued.length);
    q('#batch-button-label').textContent = batchActive ? 'Stop after current job' : 'Generate all resumes';
    q('#batch-status').textContent = batchState?.candidateId === candidateId() ? batchState.message || '' : batchActive ? 'Resume generation is running for another candidate.' : '';
    const overlay = q('#batch-overlay');
    if (batchActive && !overlay.open) openDialog('batch-overlay');
    if (!batchActive && overlay.open) overlay.close();
    q('#batch-overlay-stop').disabled = pendingActions.has('batch-stop');
    q('#batch-overlay-progress').textContent = pendingActions.has('batch-stop') ? 'Stopping the remaining queue…' : batchState?.message || '';
    const batchJob = requests.find(job => job.id === batchState?.currentJobId);
    q('#batch-overlay-company').textContent = batchJob ? `${batchJob.input.job.company} · ${batchJob.input.job.role}` : '';
    const matches = request => {
      const text = `${request.input.job.company} ${request.input.job.role}`.toLocaleLowerCase();
      return text.includes(queueSearch) && (queueFilter === 'all' || request.state === queueFilter);
    };
    const visible = own.filter(matches);
    q('#queue-no-matches').hidden = !all.length || visible.length > 0;
    q('#add-request').disabled = !initialized || pendingActions.has('add');
    q('#discard-job').disabled = !initialized || pendingActions.has('add');
    q('#review-count').textContent = own.length;
    q('#queue-owner').textContent = profile().name;
    q('#empty-queue').hidden = all.length > 0;
    const renderCard = request => {
      const { input } = request;
      const company = input.tailor ? input.job.company || 'Company not provided' : 'Base resume';
      const card = element('li', 'job-request');
      card.dataset.requestId = String(request.id);
      const top = action('', null, 'toggle-card', request.id);
      top.className = 'request-top request-title-button';
      top.setAttribute('aria-label', `Expand or collapse ${input.job.role} at ${company}`);
      top.setAttribute('aria-expanded', String(expandedCard === String(request.id)));
      top.setAttribute('aria-controls', `job-actions-${request.id}`);
      const title = element('span', 'request-title');
      title.append(element('strong', '', company), element('span', 'request-role', input.job.role));
      if (input.tailor && typeof input.job.salary === 'string' && input.job.salary.trim()) {
        const salary = element('span','request-salary', input.job.salary.trim());
        if (input.job.salaryBasis) salary.title = input.job.salaryBasis;
        title.append(salary);
      }
      const stamp = element('span', 'request-stamp');
      const pill = element('span', 'state-pill');
      pill.dataset.state = request.state;
      const labels = { ready: 'Ready', queued: 'Queued', attention: 'Need action' };
      pill.append(icon(request.state === 'ready' ? 'check' : 'clock'), document.createTextNode(labels[request.state] || request.state));
      stamp.append(pill);
      const chevron = icon('chevron-down'); chevron.classList.add('card-chevron'); stamp.append(chevron);
      if (request.updatedAt) {
        const date = new Date(request.updatedAt);
        if (Number.isFinite(date.getTime())) {
          const time = element('time', 'request-updated', `Updated ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`);
          time.dateTime = date.toISOString(); time.title = date.toLocaleString(); stamp.append(time);
        }
      }
      if (request.isExample) stamp.append(element('span', 'example-saved', 'Example'));
      const logo = element('span', 'company-monogram', companyMonogram(company));
      logo.setAttribute('aria-hidden', 'true');
      const identity = element('span', 'request-identity'); identity.append(logo, title);
      top.append(identity, stamp); card.append(top);
      const controls = element('div', 'request-controls');
      const details = action('Details', 'info', 'details', request.id); details.classList.add('request-detail-button');
      const toolsBody = element('div', 'request-tools-body'); toolsBody.id = `job-actions-${request.id}`;
      toolsBody.hidden = expandedCard !== String(request.id);
      if(request.state==='attention') {
        const run=generations.forJob(request.id),fetch=action('Fetch result again','refresh','refetch-generation',request.id);
        fetch.disabled=!run?.sendIntentAt || pendingActions.has(`refetch-generation:${request.id}`);
        fetch.title=run?.sendIntentAt ? 'Read the existing AI reply again without sending a new prompt' : 'No submission was recorded. Use Resume to prepare the prompt first.';
        toolsBody.append(fetch);
      }
      const updated = stamp.querySelector('time'); if (updated) toolsBody.append(updated);
      const links = element('div', 'request-links');
      const jobUrl = safeJobUrl(input.job.url);
      if (jobUrl) {
        const link = element('a', 'button');
        link.append(icon('external'), document.createTextNode('Go to apply'));
        link.dataset.action = 'apply'; link.dataset.request = String(request.id);
        if (pendingActions.has(`apply:${request.id}`)) link.setAttribute('aria-busy', 'true');
        link.href = jobUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
      }
      if (request.state === 'ready' || requestChatUrl(request)) {
        const review = action('Open chat', 'chat', 'review', request.id);
        review.disabled = !requestChatUrl(request);
        review.title = review.disabled ? 'No originating conversation is recorded. Open Details to inspect this result.' : 'Open this result’s originating conversation';
        links.append(review);
      }
      if (links.children.length) toolsBody.append(links);
      if (request.state === 'ready' && request.resume) {
        const apply = action('Apply to job', 'external', 'prepare-application', request.id);
        apply.classList.add('primary', 'request-main-action'); controls.append(apply);
      }
      if (!request.isExample) {
        const generation = element('div', 'request-generation');
        const actions = element('div', 'generation-actions');
        const run = generations.forJob(request.id);
        const complete = run && ['complete', 'invalid'].includes(run.phase);
        const stopped = run && (['attention', 'stopped'].includes(run.phase) || run.provider === 'deepseek' && run.trackingState === 'suspended');
        const fetchable=request.state==='attention'&&run?.sendIntentAt;
        let changed=false,emptySelection=false;
        try{changed=!!run&&(complete||stopped)&&!sameGenerationSelection(run.documentSettings,selectedDocumentSettings(null,generationSettings));}catch{emptySelection=true;}
        const name = changed?'generate':fetchable ? 'refetch-generation' : !run ? 'generate' : complete ? 'manual-retrieval' : stopped ? 'resume-generation' : 'open-generation';
        const label = {'generate':'Generate documents','refetch-generation':'Fetch result again','manual-retrieval':'Manual retrieval','resume-generation':'Resume','open-generation':'Open AI tab'}[name];
        const primary = action(label, name==='generate'?'file':'sparkles', name, request.id); primary.classList.add('generation-action');if(name==='generate'&&emptySelection)primary.disabled=true;
        if (request.state === 'ready' && request.resume) actions.append(primary);
        else { primary.classList.add('primary', 'request-main-action'); controls.append(primary); }
        if (run) {
          const note = element('p', 'generation-status', isJobReady(request)&&['invalid','attention','stopped'].includes(run.phase)?'Documents ready':`${run.provider === 'deepseek' ? 'DeepSeek' : 'ChatGPT'} · ${phaseLabel(run)}${run.error ? '. ' + run.error : ''}`);
          note.setAttribute('role', 'status'); note.title = note.textContent;
          if (request.state === 'ready' && !run.error) generation.append(note); else card.append(note);
          if (complete || stopped) actions.append(action('Open AI tab', 'external', 'open-generation', request.id));
          if (run.phase === 'complete') {
            const download = action('Download files', 'download', 'download-generation', request.id);
            download.disabled = ['pending', 'starting', 'downloading'].includes(run.downloads?.state); actions.append(download);
          }
          if (run.downloads && run.downloads.state !== 'skipped') {
            const downloadText = ({ pending: 'Preparing downloads…', starting: run.downloads.autoSave && !run.downloads.savedAt ? 'Saving documents…' : 'Preparing downloads…', downloading: 'Downloading documents…', complete: run.downloads.savedAt ? 'Documents saved and downloaded.' : 'Documents downloaded.', partial: 'Downloads need attention.', failed: 'Documents could not be downloaded. Use Download files to retry.' })[run.downloads.state] || '';
            const message = [...(run.downloads.errors || []).map(item => item.message), ...(run.downloads.files || []).filter(item => item.error).map(item => item.error)].join(' ');
            const note = element('p', 'generation-status', [downloadText, message].filter(Boolean).join(' '));
            if (['partial', 'failed'].includes(run.downloads.state)) card.append(note); else generation.append(note);
          }
          if (runningPhases.includes(run.phase)) actions.append(action('Stop tracking', 'close', 'stop-generation', request.id));
        }
        if(name!=='manual-retrieval')actions.append(action('Manual retrieval','file-json','manual-retrieval',request.id));
        generation.append(actions); toolsBody.append(generation);
      }
      const actions = element('div', 'request-actions');
      actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', `Documents and actions for ${company}`);
      const resume = action('Resume', 'file', 'preview', request.id);
      resume.disabled = !request.resume || request.documentsStale;
      resume.title = resume.disabled ? 'Generate documents or use Update to save a resume first.' : 'View saved resume';
      const letter = action('Cover letter', 'mail', 'cover-letter', request.id);
      letter.disabled = !request.coverLetterEnabled || !request.coverLetter?.trim();
      letter.title = letter.disabled ? 'Use Update to save and include a cover letter first.' : 'View saved cover letter';
      const remove = action('Delete', 'trash', 'cancel', request.id); remove.classList.add('danger');
      remove.title = `Remove ${company} from the queue`;
      actions.append(resume, letter, action('Update', 'file-pen', 'documents', request.id), remove);
      toolsBody.prepend(actions); controls.append(action('Copy','copy','copy-prompt',request.id),details);
      for(const button of controls.children){
        button.setAttribute('aria-label',button.textContent.trim());button.title=button.textContent.trim();
        for(const node of [...button.childNodes])if(node.nodeType===3){const label=element('span','request-control-label',node.textContent);node.replaceWith(label);}
      }
      card.append(controls, toolsBody);
      return card;
    };
    q('#resume-queue').replaceChildren(...visible.map(renderCard));
    applyJobs.render({ jobs: own, candidate: { id: candidateId(), name: profile().name },
      currentTabUrl,currentTabId,applicationSession,pending: pendingActions });
    const counts = own.reduce((total, request) => { total[request.state] = (total[request.state] || 0) + 1; return total; }, {});
    const parts = [];
    if (counts.ready) parts.push(`${counts.ready} ready`);
    if (counts.queued) parts.push(`${counts.queued} queued`);
    if (counts.attention) parts.push(`${counts.attention} need attention`);
    q('#queue-summary').textContent = parts.join(' · ') || 'Queue empty';
    renderCurrentJob(); renderCaptures();
  }

  function safeJobUrl(value) {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
    catch { return null; }
  }
  function renderCurrentJob() {
    const button = q('#capture-current-job');
    button.hidden = !canCaptureCurrentJob();
    const busy = pendingActions.has('add') || Boolean(reading) || currentTabBusy;
    button.disabled = busy || button.hidden;
    button.setAttribute('aria-busy', String(busy));
    q('#capture-current-job-label').textContent = pendingActions.has('add')
      ? reading?.phase === 'permission' ? 'Allow website access…' : reading ? 'Reading job…' : 'Saving job…'
      : 'Add This Job in One Click';
  }
  function canCaptureCurrentJob() {
    return initialized && Number.isInteger(currentTabId) && currentTabId >= 0 && canCaptureJobUrl(currentTabUrl) &&
      !jobUrlInList(currentTabUrl, candidateId(), requests)&&!matchesApplicationSession(applicationSession,currentTabUrl,currentTabId);
  }
  q('#queue-search').addEventListener('input', event => { queueSearch = event.target.value.trim().toLocaleLowerCase(); renderQueue(); });
  q('#queue-filter').addEventListener('change', event => { queueFilter = event.target.value; renderQueue(); });
  q('#capture-current-job').addEventListener('click', () => {
    if (!canCaptureCurrentJob() || reading || currentTabBusy || pendingActions.has('add')) return;
    const tabId = currentTabId, url = currentTabUrl;
    const input = structuredClone({ candidateId: candidateId(), profile: profile(), tailor: true,
      resumeTemplate: q('#resume-template').value, promptTemplate: q('#prompt-template').value,
      prompt: prompts[q('#prompt-template').value].text });
    const checkExisting = q('#check-existing-jobs').checked;
    const options = { checkExisting, checkExistingUrl: true };
    let extracted = {};
    const manual = reason => {
      q('#queue-notice').hidden = true; clearTimeout(noticeTimer);
      const applyUrl = extracted.cleanupEvidence?.applyUrls?.[0];
      manualJob.open({ ...input, job: { ...extracted, url: isHiringCafe(url) ? applyUrl || '' : url, tabId } }, options, reason);
    };
    void perform(async () => {
      try {
        // Request site access in this click's gesture, before any other await.
        const response = await readPage(tabId, { askAccess: true, showErrorDialog: false });
        if (!response) {
          manual(readFeedback.get(tabId)?.message || 'The page could not be read. Enter the job details manually.');
          return;
        }
        if (duplicateJobUrl(response.fields?.url) === duplicateJobUrl(url)) extracted = { ...response.fields, provenance: response.provenance };
        const latest = await chrome.tabs.get(tabId).catch(() => null);
        if (tabId !== currentTabId || currentTabUrl !== url || latest?.url !== url || candidateId() !== input.candidateId ||
            duplicateJobUrl(response.fields?.url) !== duplicateJobUrl(url)) {
          manual('The page or selected profile changed. Review the original job details below before saving.');
          return;
        }
        if (jobUrlInList(url, input.candidateId, queue.snapshot().requests)) return;
        const fields = response.fields;
        if (!fields.description?.trim()) {
          manual('This page did not provide a job description. Paste it below to add the job.');
          return;
        }
        // Use the freshly read page, never a manually entered URL or another tab's draft.
        input.job = { company: fields.company?.trim() || '', role: fields.role?.trim() || '',
          url: fields.url, description: fields.description.trim(), ...(fields.salary?.trim() ? {salary:fields.salary.trim()} : {}),tabId, provenance: response.provenance };
        status('Finding the application link…');
        const applyUrls = await generations.applyUrls(tabId,url);
        const capturedInput = cleanupInput(input,{...response.cleanupEvidence,applyUrls});
        extracted = capturedInput.job;
        if (isHiringCafe(url)) capturedInput.job.url = capturedInput.job.cleanupEvidence.applyUrls[0];
        await saveRequest(capturedInput,options);
      } catch (error) { manual(error.message || 'The job could not be added automatically. Review its details below.'); }
    }, 'add');
  });

  function editCapture(request, reason) {
    const input = structuredClone(request.input);
    input.job.url = input.job.cleanupEvidence?.applyUrls?.[0] || (isHiringCafe(input.job.url) ? '' : input.job.url);
    manualJob.open(input,{captureJobId:request.id},reason || 'Review the job details and employer Apply URL.');
  }
  function renderCaptures() {
    const container = q('#job-capture-progress');
    const pending = requests.filter(request=>request.capturePending && request.state !== 'cancelled' && request.input.candidateId === candidateId());
    container.hidden = !pending.length;
    container.replaceChildren(...pending.map(request=>{
      const run = generations.captures().find(run=>run.jobId === request.id), row = element('div','job-capture-progress-row');
      const label = run ? run.phase === 'generating' ? 'Cleaning job details with AI…' : run.phase === 'validating' ? 'Validating job JSON…' : phaseLabel(run) : 'AI job cleanup is waiting';
      const message = element('p','generation-status', `${request.input.job.company || 'Job capture'} · ${label}${run?.error ? '. '+run.error : ''}`);
      message.setAttribute('role','status'); row.append(message);
      const active = run && (runningPhases.includes(run.phase) && run.trackingState !== 'suspended' || ['complete','invalid'].includes(run.phase));
      for (const [text,name] of [[active ? 'Open AI tab' : 'Resume',active ? 'open' : 'resume'],['Enter manually','manual'],['Cancel','cancel']]) {
        const button = element('button','button',text); button.type='button'; button.dataset.captureAction=name; button.dataset.captureJob=request.id; row.append(button);
      }
      return row;
    }));
  }
  q('#job-capture-progress').addEventListener('click',event=>{
    const button = event.target.closest('button[data-capture-action]'); if (!button) return;
    const request = requests.find(request=>request.id === button.dataset.captureJob && request.capturePending && request.state !== 'cancelled');
    if (!request) return;
    const run = generations.captures().find(run=>run.jobId === request.id), name = button.dataset.captureAction;
    if (name === 'manual') {editCapture(request,run?.error);return;}
    void perform(async()=>{
      if (name === 'cancel') {if (run) await generations.stop(run.id);await queue.cancel(request.id);}
      else if (run) await generations.open(run.id,name === 'resume');
      else await generations.capture(request.id,getChatProvider());
    },`capture:${request.id}`);
  });

  function updateTabs({ count, index, tabId, url, busy }) {
    currentTabUrl = url || ''; currentTabBusy = Boolean(busy);
    if (tabId !== currentTabId) {
      jobDrafts.set(currentTabId, jobDraft());
      currentTabId = tabId;
      const draft = jobDrafts.get(currentTabId);
      for (const [key, selector] of Object.entries(jobFields)) {
        q(selector).value = draft?.[key] || ''; q(selector).setCustomValidity('');
      }
    }
    if (!manualUrls.has(currentTabId) && /^https?:\/\//i.test(url || '')) {
      q('#job-url').value = url;
      jobDrafts.set(currentTabId, jobDraft());
    }
    q('#job-position').textContent = `${index} / ${count}`;
    renderCurrentJob();
    q('#job-position').title = `${count} open tab${count === 1 ? '' : 's'} in this browser window`;
    q('#previous-job').disabled = q('#next-job').disabled = busy || count < 2;
    renderReadButton();
    if(initialized)renderQueue();
  }
  function renderReadButton() {
    renderCurrentJob();
  }
  function readMessage(tabId, state, message) {
    readFeedback.set(tabId, { state, message });
    if (tabId === currentTabId) renderReadButton();
  }
  async function readPage(tabId = currentTabId, { askAccess = false, showErrorDialog = true } = {}) {
    if (!Number.isInteger(tabId) || reading?.tabId === tabId || reading?.phase === 'permission') return;
    const before = tabId === currentTabId ? jobDraft() : jobDrafts.get(tabId) ||
      Object.fromEntries(Object.keys(jobFields).map(key => [key, '']));
    const request = {id:crypto.randomUUID(),tabId,before,phase:askAccess ? 'permission' : 'extracting'};
    if (reading) readMessage(reading.tabId, 'notice', 'This read was interrupted. Click Read page to try again.');
    reading = request;
    readMessage(tabId, 'pending', askAccess ? 'Waiting for website access.' : 'Reading job details from this page…');
    renderReadButton();
    let timeout;
    try {
      if (askAccess) {
        // No awaits may precede this request: Chrome must receive the click's
        // user gesture. Approval resumes this same read, not a second click.
        await requestJobPageAccess(request.tabId);
        if (reading !== request) return;
        request.phase = 'extracting';
        readMessage(tabId, 'pending', 'Reading job details from this page…');
        renderReadButton();
      }
      const response = await Promise.race([
        chrome.runtime.sendMessage({type:'job.extract',requestId:request.id,tabId:request.tabId}),
        new Promise((_,reject) => { timeout=setTimeout(()=>reject(new Error('The page is taking too long to respond. Try Read page again.')),12000); })
      ]);
      if (reading!==request) return;
      if (!response || response.requestId!==request.id) throw new Error('The page did not respond. Try Read page again.');
      if (!response.ok) throw Object.assign(new Error(response.error?.message || 'Could not read this job page.'), { code: response.error?.code });
      const active = currentTabId===request.tabId;
      const current = active ? jobDraft() : jobDrafts.get(request.tabId) || request.before;
      const merged = {...current};
      let filled=0;
      for (const [key,selector] of Object.entries(jobFields)) {
        const value = response.fields?.[key];
        if (!value || current[key]!==request.before[key]) continue;
        merged[key] = value; filled++;
        if (active) { q(selector).value=value; q(selector).setCustomValidity(''); }
        if (['company', 'role'].includes(key)) {
          const currentSource = provenanceDrafts.get(request.tabId) || {};
          provenanceDrafts.set(request.tabId, { ...currentSource, [key]: { ...(response.provenance?.[key] || { kind: 'page', source: response.source || 'Page extraction' }), value: value.trim() } });
        }
        if (key==='url') manualUrls.delete(request.tabId);
      }
      jobDrafts.set(request.tabId,merged);
      if (active) renderCurrentJob();
      const missing = response.missing?.filter(key=>key!=='url') || [];
      const names = {company:'company name',role:'job title',description:'Job Description'};
      const message = missing.length ? `Read ${filled} fields. Review missing ${missing.map(key=>names[key] || key).join(', ')}.` : 'Job details read. Review the fields before adding to queue.';
      readMessage(request.tabId, missing.length ? 'warning' : 'success', message);
      status(active ? message : 'Job details saved to the source tab’s draft.');
      return response;
    } catch (error) {
      if (reading===request) {
        const message = error.message;
        readMessage(request.tabId, 'error', message);
        if (currentTabId===request.tabId) {
          status(message);
          if (showErrorDialog && error.code !== 'access-denied') {
            q('#read-page-error-message').textContent = message;
            if (!q('#read-page-error-dialog').open) openDialog('read-page-error-dialog');
          }
        }
      }
    } finally {
      clearTimeout(timeout);
      if (reading===request) { reading=null; renderReadButton(); }
    }
  }
  q('#discard-job').addEventListener('click', () => {
    if(reading?.tabId===currentTabId) reading=null;
    for(const field of Object.values(jobFields).map(selector=>q(selector))) {field.value='';field.setCustomValidity('');}
    if(/^https?:\/\//i.test(currentTabUrl))q('#job-url').value=currentTabUrl;
    manualUrls.delete(currentTabId);provenanceDrafts.delete(currentTabId);readFeedback.delete(currentTabId);
    jobDrafts.set(currentTabId,jobDraft());
    q('#queue-notice').hidden=true;clearTimeout(noticeTimer);
    renderCurrentJob();status('Unsaved job details discarded.');q('#job-company').focus();
  });
  function tabError(message) {
    q('#previous-job').disabled = q('#next-job').disabled = true;
    status(message);
  }
  function renderTemplate(kind = 'resume') {
    const resume = kind === 'resume' || !q('#tailor').checked;
    const selection = q('#resume-template');
    const prompt = prompts[q('#prompt-template').value];
    q('#resume-thumbnail').hidden = !resume;
    q('#prompt-preview').hidden = resume;
    q('#resume-thumbnail').dataset.template = selection.value;
    const template = resumeTemplate(selection.value);
    q('#resume-thumbnail').src = template.thumbnail;
    q('#resume-thumbnail').alt = `${template.name} resume template preview`;
    q('#template-caption').textContent = resume ? `Resume · ${template.name}` : 'Prompt preview';
    q('#prompt-name').textContent = prompt.name;
    q('#prompt-text').textContent = prompt.text;
  }
  function renderSource(request) {
    const source = requestChatUrl(request);
    const current = savedChatUrl(getCurrentChat());
    const savedCompany = request.input.tailor;
    q('#request-source-note').textContent = source ? `Connected chat · ${request.input.job.company}`
      : savedCompany ? 'Open this job’s conversation in Chat, then connect it here to reopen it from the queue.'
      : 'Connect conversations from a job with a company attached.';
    q('#request-open-chat').disabled = !source;
    const connect = q('#request-connect-chat');
    connect.disabled = !savedCompany || !current || source === current;
    connect.title = !current ? 'Open a conversation in Chat first' : 'Connect the current conversation to this saved company';
    connect.replaceChildren(icon('link'), document.createTextNode(source ? 'Replace with current chat' : 'Connect current chat'));
  }
  function renderRetrievalStatus(request){
    const section=q('#request-retrieval-status');if(!section)return;
    const run=generations.forJob(request.id);section.hidden=!run;if(!run)return;
    q('#request-retrieval-label').textContent=(run.provider==='deepseek'?'DeepSeek':'ChatGPT')+' · '+phaseLabel(run);
    const status={phase:run.phase,...run.error?{error:run.error}:{},capture:run.captureDiagnostics||null};
    q('#request-retrieval-data').textContent=JSON.stringify(status,null,2);
    q('#request-copy-retrieval').onclick=async()=>{
      try{await navigator.clipboard.writeText(JSON.stringify(status,null,2));q('#request-retrieval-label').textContent='Retrieval status copied.';}
      catch{q('#request-retrieval-label').textContent='Select and copy the status below.';}
    };
  }
  function requestDetails(request, reveal = true) {
    detailRequestId = request.id;
    const mark=q('#request-mark-applied');mark.disabled=!!request.capturePending||!safeJobUrl(request.input.job.url)||!request.input.job.company?.trim()||!request.input.job.role?.trim()||pendingActions.has(`mark-applied:${request.id}`);
    q('#request-edit').disabled=pendingActions.has(`mark-applied:${request.id}`);
    mark.title=request.capturePending?'Finish saving this job before marking it applied.':'Record this job in Applications with its saved documents';
    if(reveal){q('#request-application-status').textContent='';q('#request-application-status').dataset.state='';}
    const { input } = request;
    q('#request-dialog-title').textContent = `${input.tailor ? input.job.company : 'Base resume'} · #${String(request.id).padStart(3, '0')}`;
    const metadata = [
      ['Candidate', input.profile.name], ['Job title', input.job.role],
      ['Resume template', resumeTemplate(input.resumeTemplate).name],
      ['Prompt template', prompts[input.promptTemplate]?.name || 'Saved prompt'], ['Mode', input.tailor ? 'Tailored resume' : 'Base resume']
    ];
    const provenance = metadataProvenance(input.job);
    metadata.push(['Company source', provenanceLabel(provenance.company)], ['Job title source', provenanceLabel(provenance.role)]);
    if (input.job.salary) metadata.push(['Salary',input.job.salary],['Salary source',input.job.salarySource === 'estimated' ? 'AI estimate (not listed)' : input.job.salarySource === 'listed' ? 'Listed in the job' : 'Entered or extracted']);
    if (input.job.salaryBasis) metadata.push(['Estimate assumptions',input.job.salaryBasis]);
    if (input.tailor && input.job.url) metadata.push(['Source URL', input.job.url]);
    q('#request-metadata').replaceChildren(...metadata.flatMap(([label, value]) => [element('dt', '', label), element('dd', '', value)]));
    q('#request-prompt').textContent = input.prompt;
    q('#request-job').textContent = input.tailor ? input.job.description : 'No job description attached to this base resume.';
    q('#request-job').value=q('#request-job').textContent;
    for(const key of ['company','role','salary','url']) q('#request-field-'+key).value=input.job[key] || '';
    const listing = q('#request-job-link'), listingUrl = safeJobUrl(input.job.url);
    listing.hidden = !listingUrl;
    if (listingUrl) listing.href = listingUrl; else listing.removeAttribute('href');
    q('#request-output-section').hidden = !request.resume && !request.rawOutput;
    q('#request-output').textContent = request.resume ? JSON.stringify(request.resume, null, 2) : request.rawOutput || '';
    renderRetrievalStatus(request);
    renderSource(request);
    if (reveal) openDialog('request-dialog');
  }
  async function preview(request) {
    if(request.state !== 'ready' || !request.resume) return;
    const ticket=crypto.randomUUID();q('#resume-preview-dialog').dataset.previewTicket=ticket;
    previewId=request.id;
    q('#resume-preview-title').textContent=(request.input.job.company||'Base resume')+' · Resume';
    const paper=q('#resume-paper');paper.replaceChildren(element('p','','Loading PDF…'));
    openDialog('resume-preview-dialog');
    try{
      const url=await savedPDFPreview(request);
      if(previewId!==request.id||!q('#resume-preview-dialog').open||q('#resume-preview-dialog').dataset.previewTicket!==ticket)return;
      const frame=document.createElement('iframe');frame.title='Resume Studio PDF preview';frame.className='studio-pdf-frame';frame.src=url;paper.replaceChildren(frame);
    }catch(error){if(previewId===request.id&&q('#resume-preview-dialog').open&&q('#resume-preview-dialog').dataset.previewTicket===ticket)paper.replaceChildren(element('p','',error.message));}
  }

  async function previewOnPage(request,kind){
    const windowId=Number(new URL(location.href).searchParams.get('windowId'))||(await chrome.windows.getCurrent()).id;
    const reply=await chrome.runtime.sendMessage({type:'ai-apply.tools',payload:{action:'document.preview',jobId:request.id,kind,windowId,tabId:currentTabId}});
    if(!reply?.ok)throw Error(reply?.error||'The document preview could not open.');
  }

  async function previewCoverLetter(request) {
    const dialog=q('#cover-letter-dialog'),paper=q('#cover-letter-copy'),ticket=crypto.randomUUID();
    dialog.dataset.previewTicket=ticket;
    q('#cover-letter-context').textContent=`${request.input.job.company||'Base resume'} · ${request.input.job.role}`;
    paper.replaceChildren(element('p','','Loading PDF…'));openDialog('cover-letter-dialog');
    try{
      const url=await savedPDFPreview(request,{kind:'cover-letter'});
      if(!dialog.open||dialog.dataset.previewTicket!==ticket)return;
      const frame=document.createElement('iframe');frame.title='Cover letter PDF preview';frame.className='studio-pdf-frame';frame.src=url;paper.replaceChildren(frame);
    }catch(error){if(dialog.open&&dialog.dataset.previewTicket===ticket)paper.replaceChildren(element('p','',error.message));}
  }
  for(const [selector,paper]of [['#resume-preview-dialog','#resume-paper'],['#cover-letter-dialog','#cover-letter-copy']])q(selector).addEventListener('close',()=>{q(paper).replaceChildren();});
  for(const selector of ['#resume-preview-dialog','#cover-letter-dialog'])q(selector).addEventListener('click',event=>{
    const dialog=event.currentTarget;if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();
    if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.close();
  });

  function requestAction(event) {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    const request = requests.find(item => String(item.id) === button.dataset.request && item.input.candidateId === candidateId());
    if (!request) return;
    if (button.dataset.action === 'toggle-card') {
      expandedCard = expandedCard === String(request.id) ? null : String(request.id);
      for (const card of q('#resume-queue').children) {
        const expanded = card.dataset.requestId === expandedCard;
        card.querySelector('.request-title-button').setAttribute('aria-expanded', String(expanded));
        card.querySelector('.request-tools-body').hidden = !expanded;
      }
      return;
    }
    if (button.dataset.action === 'prepare-application') {
      applyJobs.select(request.id); showStudio('apply'); syncApplyChat(request); return;
    }
    if (button.dataset.action === 'copy-prompt') {
      void perform(async()=>{
        try{await generations.copyPrompt(request.id);showNotice('Prompt copied','Paste it into AI chat, then use Manual retrieval to paste the complete JSON reply.');}
        catch(error){showNotice('Could not copy prompt',error.message);throw error;}
      },`copy-prompt:${request.id}`);
      return;
    }
    if (['generate', 'manual-retrieval', 'resume-generation', 'open-generation', 'stop-generation', 'download-generation','refetch-generation'].includes(button.dataset.action)) {
      const name = button.dataset.action;
      void perform(async () => {
        const run = generations.forJob(request.id);
        if (name === 'generate') {
          awaitingReview.add(request.id);
          try { await generations.start(request.id, getChatProvider()); status('Document generation connected to the AI tab. Progress is saved while the dock is closed.'); }
          catch (error) { awaitingReview.delete(request.id); throw error; }
        } else if (name === 'refetch-generation') { awaitingReview.add(request.id);await generations.refetch(run.id); }
        else if (name === 'manual-retrieval') await openManualRetrieval(request.id, run?.id);
        else if (name === 'download-generation') await generations.download(run.id);
        else if (name === 'stop-generation') { awaitingReview.delete(request.id); await generations.stop(run.id); status('Tracking stopped. Any response already generating stays in the AI tab.'); }
        else { if (name === 'resume-generation') awaitingReview.add(request.id); await generations.open(run.id, name === 'resume-generation'); }
      }, `${name}:${request.id}`);
      return;
    }
    if (button.dataset.action === 'details') requestDetails(request);
    if (button.dataset.action === 'review') {
      const url = requestChatUrl(request);
      if (url) showChat(url);
    }
    if (button.dataset.action === 'preview') {
      if(button.closest('#apply-panel, #resume-queue'))void perform(()=>previewOnPage(request,'resume'),`preview-resume:${request.id}`);
      else void preview(request);
    }
    if (button.dataset.action === 'cover-letter' && request.coverLetterEnabled && request.coverLetter?.trim()) {
      if(button.closest('#apply-panel, #resume-queue'))void perform(()=>previewOnPage(request,'cover-letter'),`preview-cover-letter:${request.id}`);
      else void previewCoverLetter(request);
    }
    if (button.dataset.action === 'documents') documents.open(request.id);
    if (button.dataset.action === 'documents-letter') documents.open(request.id, { focus: 'cover-letter' });
    if (['download-resume', 'download-cover-letter'].includes(button.dataset.action)) {
      const name = button.dataset.action;
      void perform(async () => {
        await downloadDocument(request,name === 'download-resume' ? 'resume' : 'cover-letter');
      }, `${name}:${request.id}`);
    }
    if (button.dataset.action === 'cancel') {
      void perform(async () => {
        const run = generations.forJob(request.id);
        if (run) await generations.stop(run.id);
        awaitingReview.delete(request.id);
        await queue.cancel(request.id); if (previewId === request.id) clearPreview(); status(`Removed from queue · ${request.input.job.company}`);
      }, `cancel:${request.id}`);
    }
  }
  async function downloadDocument(request,kind){
    const title=kind==='resume'?'Resume':'Cover letter';
    function report(message,error=false){
      status(message);
      const feedback=q('#apply-download-status');
      if(feedback.dataset.request===String(request.id)){feedback.textContent=message;feedback.dataset.level=error?'error':'info';feedback.setAttribute('role',error?'alert':'status');}
    }
    report(`Preparing ${title.toLowerCase()} PDF…`);
    try{
      await requestDocumentExportAccess(request.input.candidateId);
      const delivery=await generations.downloadSaved(request.id,kind);
      if(!delivery?.files?.length||['failed','partial'].includes(delivery.state))throw Error(delivery?.errors?.map(error=>error.message).join(' ')||'No document was downloaded. Try again.');
      const file=delivery.files.find(file=>file.kind===kind&&file.format==='pdf');
      if(!file)throw Error('The PDF was not returned. Try downloading again.');
      report(file.destination?`${title} saved: ${file.destination.rootName}/${file.destination.relativePath}`:`${title} ${file.state==='complete'?'downloaded':'download started'}: ${file.filename}`);
      return delivery;
    }catch(error){report(`${title} could not download: ${error.message}`,true);throw error;}
  }
  function applyFromLink(event, request) {
    if (!request || typeof openApplication !== 'function' || event.defaultPrevented || event.button !== 0 ||
        event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    void perform(async () => {
      try {
        await openApplication(request);
        status('Job listing opened.');
        if (q('#apply-feedback').dataset.request === String(request.id)) q('#apply-feedback').textContent = 'Application page opened. Your documents are ready to use.';
      } catch (error) {
        if (q('#apply-feedback').dataset.request === String(request.id)) q('#apply-feedback').textContent = error.message;
        throw error;
      }
    }, `apply:${request.id}`);
  }
  q('#resume-queue').addEventListener('click', event => {
    const link = event.target.closest('a[data-action="apply"]');
    if (!link) return;
    const request = requests.find(item => String(item.id) === link.dataset.request && item.input.candidateId === candidateId());
    applyFromLink(event, request);
  });
  q('#request-job-link').addEventListener('click', event => {
    const request = requests.find(item => item.id === detailRequestId && item.input.candidateId === candidateId());
    applyFromLink(event, request);
  });
  q('#resume-queue').addEventListener('click', requestAction);
  q('#apply-panel').addEventListener('click', requestAction);
  q('#apply-open-chat').addEventListener('click',()=>{
    const selected=applyJobs.selected();if(!selected)return;
    void chrome.runtime.sendMessage({type:'ai-apply.tools',payload:{action:'chat.open',jobId:selected.id,conversationUrl:generations.forJob(selected.id)?.url||requestChatUrl(selected),windowId:Number(new URL(window.location.href).searchParams.get('windowId'))}}).then(reply=>{if(!reply?.ok)throw Error(reply?.error||'ChatGPT could not open.');}).catch(error=>q('#apply-feedback').textContent=error.message);
  });
  q('#apply-go-queue').addEventListener('click', () => showStudio('results'));
  q('#apply-open-job').addEventListener('click', event => {
    if (event.currentTarget.getAttribute('aria-disabled') === 'true') { event.preventDefault(); return; }
    const request = requests.find(item => String(item.id) === event.currentTarget.dataset.request && item.input.candidateId === candidateId());
    applyFromLink(event, request);
  });
  q('#candidate').addEventListener('change', () => {
    renderCandidate();
    void queue.selectCandidate(candidateId()).catch(error => status(error.message));
    clearPreview(); renderQueue(); renderTemplate();
    status(`Selected candidate · ${profile().name}`);
  });
  q('#profile-details')?.addEventListener('click', () => {
    renderCandidate();
    openDialog('profile-dialog');
  });
  q('#tailor').addEventListener('change', () => {
    const checked = q('#tailor').checked;
    q('#prompt-template-field').hidden = true;
    q('#prompt-template').disabled = !checked;
    q('#tailor-description').textContent = checked ? 'Use the profile and job description.' : 'Prepare a base resume from this profile.';
    renderTemplate();
  });
  for (const [key, selector] of Object.entries(jobFields)) q(selector).addEventListener('input', () => {
    if (['company', 'role'].includes(key)) rememberSource(key, q(selector).value, { kind: q(selector).value.trim() ? 'user' : 'missing' });
    if (selector === '#job-url') { manualUrls.add(currentTabId); q(selector).setCustomValidity(''); }
    if (selector === '#job-description') q(selector).setCustomValidity('');
    jobDrafts.set(currentTabId, jobDraft());
    renderCurrentJob();
  });
  for (const [id, delta] of [['previous-job', -1], ['next-job', 1]]) {
    document.getElementById(id).addEventListener('click', () => { void moveTab(delta); });
  }
  for (const [id, kind] of [['resume-template', 'resume'], ['prompt-template', 'prompt']]) {
    document.getElementById(id).addEventListener('focus', () => renderTemplate(kind));
    document.getElementById(id).addEventListener('change', () => renderTemplate(kind));
  }
  q('#add-request').addEventListener('click', () => { void perform(async () => {
    q('#queue-notice').hidden = true; clearTimeout(noticeTimer);
    const description = q('#job-description').value.trim();
    if (q('#tailor').checked && !description) {
      status('Add a job description before preparing a tailored resume.');
      q('#job-description').setCustomValidity('Add a job description before preparing a tailored resume.');
      q('#job-description').reportValidity();
      return;
    }
    const tailor = q('#tailor').checked;
    let url = '';
    if (tailor && q('#job-url').value.trim()) {
      try {
        const parsed = new URL(q('#job-url').value.trim());
        if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
        url = parsed.href;
      } catch {
        q('#job-url').setCustomValidity('Enter an http:// or https:// job URL.');
        q('#job-url').reportValidity(); return;
      }
    }
    const promptTemplate = tailor ? q('#prompt-template').value : 'base';
    const provenance = {};
    for (const key of ['company', 'role']) {
      const value = q(jobFields[key]).value.trim(), remembered = provenanceDrafts.get(currentTabId)?.[key];
      provenance[key] = value ? remembered?.value === value ? { kind: remembered.kind, source: remembered.source } : { kind: 'user' }
        : { kind: key === 'role' ? 'profile-fallback' : 'missing' };
    }
    const input = structuredClone({ candidateId: candidateId(), profile: profile(),
      job: { company: tailor ? q('#job-company').value.trim() : 'Base resume',
        role: tailor ? q('#job-title').value.trim() || profile().role : profile().role, url, tabId: currentTabId, description, provenance }, tailor,
      resumeTemplate: q('#resume-template').value, promptTemplate, prompt: prompts[promptTemplate].text });
    await saveRequest(input, { checkExisting: q('#check-existing-jobs').checked });
  }, 'add'); });

  async function saveRequest(input, options) {
    q('#queue-notice').hidden = true; clearTimeout(noticeTimer);
    if (options?.editJobId) {
      await queue.updateJob(options.editJobId,input,options.expectedUpdatedAt,{checkExisting:q('#check-existing-jobs').checked});
    } else if (options?.captureJobId) {
      const run = generations.captures().find(run=>run.jobId === options.captureJobId);
      if (run && runningPhases.includes(run.phase)) await generations.stop(run.id);
      await queue.completeCapture(options.captureJobId,input);
    } else await queue.add(input, options);
    clearPreview(); renderQueue();
    if (q('#chat-view').hidden) showStudio('results');
    status('Job saved to the queue.');
  }

  q('#empty-prepare').addEventListener('click', () => showStudio('job'));
  q('#request-edit').addEventListener('click',()=>{
    const request=requests.find(job=>job.id===detailRequestId&&job.input.candidateId===candidateId());
    if(!request)return;
    q('#request-dialog').close();
    manualJob.open(request.input,{editJobId:request.id,expectedUpdatedAt:request.updatedAt},'Update the job details below. Existing documents are retained; changes to the company, title or description require updated documents.');
  });
  q('#request-mark-applied').addEventListener('click',()=>{
    const request=requests.find(job=>job.id===detailRequestId&&job.input.candidateId===candidateId());
    if(!request||q('#request-mark-applied').disabled)return;
    const button=q('#request-mark-applied'),feedback=q('#request-application-status');button.disabled=true;q('#request-edit').disabled=true;feedback.textContent='Recording application…';feedback.dataset.state='';
    void perform(async()=>{
      try{
        const windowId=Number(new URL(location.href).searchParams.get('windowId'))||(await chrome.windows.getCurrent()).id;
        const reply=await chrome.runtime.sendMessage({type:'ai-apply.tools',payload:{action:'job.mark-applied',windowId,jobId:request.id,expectedRevision:request.canonicalRevision,mutationId:crypto.randomUUID()}});
        if(!reply?.ok)throw Error(reply?.error||'The application could not be recorded.');
        q('#request-dialog').close();await queue.refresh();showNotice('Application recorded',`${request.input.job.company} was moved to Applications with its saved documents.`);status('Application recorded in Applications.');
      }catch(error){feedback.textContent=error.message;feedback.dataset.state='error';}
      finally{button.disabled=false;q('#request-edit').disabled=false;}
    },`mark-applied:${request.id}`);
  });
  q('#generate-all-resumes').addEventListener('click', () => {
    void perform(async () => {
      const reply = await chrome.runtime.sendMessage(batchState?.active ? { type: 'generation.batch-stop' } : { type: 'generation.batch-start', candidateId: candidateId(), provider: getChatProvider() });
      if (!reply?.ok) { showNotice('Resume queue needs attention', reply?.error || 'Could not start queued resumes.'); return; }
      batchState = (await chrome.storage.local.get(batchKey))[batchKey]; renderQueue();
    }, 'batch');
  });
  function stopBatchFromOverlay() {
    if (!batchState?.active) return;
    void perform(async () => {
      const reply = await chrome.runtime.sendMessage({type:'generation.batch-stop'});
      if (!reply?.ok) { showNotice('Could not stop the queue',reply?.error || 'Try clicking again.'); return; }
      batchState = (await chrome.storage.local.get(batchKey))[batchKey]; renderQueue();
      status('Automatic generation stopped. The current job can finish; remaining jobs stay queued.');
    },'batch-stop');
  }
  q('#batch-overlay-stop').addEventListener('click',stopBatchFromOverlay);
  q('#batch-overlay').addEventListener('cancel',event=>{event.preventDefault();stopBatchFromOverlay();});
  for (const id of ['view-queue', 'open-queue']) document.getElementById(id).addEventListener('click', () => showStudio('results'));
  q('#request-open-chat').addEventListener('click', () => {
    const request = requests.find(item => item.id === detailRequestId && item.input.candidateId === candidateId());
    const url = requestChatUrl(request);
    if (!url) return;
    q('#request-dialog').close(); showChat(url);
  });
  q('#request-connect-chat').addEventListener('click', () => {
    const request = requests.find(item => item.id === detailRequestId && item.input.candidateId === candidateId());
    const url = savedChatUrl(getCurrentChat());
    if (!request || !request.input.tailor || !url) return;
    void perform(async () => { await queue.connect(request.id, url); renderSource(requests.find(item => item.id === request.id)); status(`Chat connected · ${request.input.job.company}`); });
  });
  q('#copy-json').addEventListener('click', async () => {
    const request = requests.find(item => item.id === previewId && item.input.candidateId === candidateId());
    if (!request?.resume) return;
    try { await navigator.clipboard.writeText(JSON.stringify(request.resume, null, 2)); status('Resume JSON copied.'); }
    catch { status('Could not copy. Open Review to select the JSON.'); }
  });
  q('#export-resume').addEventListener('click', () => {
    const request = requests.find(item => item.id === previewId && item.input.candidateId === candidateId());
    if (request) void perform(() => downloadDocument(request,'resume'), `download-resume:${request.id}`);
  });
  q('#import-profile').addEventListener('click', () => chrome.tabs.create({url:chrome.runtime.getURL('options.html#/settings/profile')}));
  const unsubscribe = queue.subscribe(updateQueue);
  async function openManualRetrieval(jobId, runId) {
    const generated = runId?await generations.read(runId):null;
    const request = requests.find(item => item.id === jobId && item.state !== 'cancelled' && item.input.candidateId === candidateId());
    if (!request || generated&&generated.jobId !== jobId) return;
    if (q('dialog[open]')) { showNotice('Manual retrieval', 'Close the current dialog, then choose Manual retrieval on this job.'); return; }
    manualRetrieval.open(jobId,{run:generated,selectedModules:generated?undefined:selectedDocumentSettings(null,generationSettings).selectedModules});
  }
  const unsubscribeRuns = generations.subscribe(runs => {
    renderQueue();
    if(detailRequestId&&q('#request-dialog')?.open){const request=requests.find(item=>item.id===detailRequestId);if(request)renderRetrievalStatus(request);}
    for (const run of runs) if (run.kind === 'job-cleanup' && ['invalid','attention'].includes(run.phase) && !captureFallbacks.has(run.id)) {
      const pending = requests.find(request=>request.id === run.jobId && request.capturePending && request.state !== 'cancelled' && request.input.candidateId === candidateId());
      if (pending && !q('dialog[open]')) {captureFallbacks.add(run.id);editCapture(pending,run.error);}
    }
    for (const run of runs) if (awaitingReview.has(run.jobId) && ['complete', 'invalid'].includes(run.phase)) {
      awaitingReview.delete(run.jobId);
      if (normalizeDocumentSettings(run.documentSettings).autoDownload) continue;
      void openManualRetrieval(run.jobId, run.id).catch(error => status(error.message));
    }
  });
  void generations.ready.catch(error => status(error.message));
  const promptSettings = connectPromptSettings({onChange(value){
    const select=q('#prompt-template');
    select.replaceChildren(...Object.entries(value.templates).map(([id,item])=>{const option=document.createElement('option');option.value=id;option.textContent=item.name;return option;}));
    select.value=value.selectedId; renderTemplate();
  }});
  window.addEventListener('pagehide',()=>promptSettings.dispose(),{once:true});
  const ready = Promise.all([queue.ready, duplicateOptionReady, promptSettings.ready,generationSettingsReady]).then(() => {
    initialized = true; updateQueue(queue.snapshot());
    document.documentElement.dataset.studioReady = 'true';
  }).catch(error => { status(error.message); q('#empty-queue p').textContent = error.message; });
  window.addEventListener('pagehide', unsubscribe, { once: true });
  window.addEventListener('pagehide', unsubscribeRuns, { once: true });
  window.addEventListener('pagehide', () => { clearTimeout(noticeTimer);chrome.tabs.onRemoved.removeListener(releaseTabDraft); chrome.storage.onChanged.removeListener(duplicateOptionChanged); chrome.storage.onChanged.removeListener(batchChanged); }, { once: true });
  renderQueue(); renderTemplate();
  return { ready, updateTabs, tabError, readPage,
    updateApplicationSession(run){const value=run?{id:run.id,jobId:run.jobId,tabId:run.tabId,phase:run.phase,listingUrl:run.listingUrl,applicationUrl:run.applicationUrl,visitedUrls:run.visitedUrls}:null,signature=JSON.stringify(value);if(signature!==applicationSessionSignature){applicationSessionSignature=signature;applicationSession=value;renderQueue();}},
    selectJob(id){applyJobs.select(id);}, selectedJob(){return applyJobs.selected();},
    viewState(){return {jobId:applyJobs.selected()?.id||null,search:q('#queue-search').value,filter:queueFilter,pageUrl:currentTabUrl};},
    restoreViewState(saved){queueSearch=typeof saved.search==='string'?saved.search.slice(0,500).trim().toLocaleLowerCase():'';queueFilter=['all','queued','ready','attention'].includes(saved.filter)?saved.filter:'all';q('#queue-search').value=typeof saved.search==='string'?saved.search.slice(0,500):'';q('#queue-filter').value=queueFilter;renderQueue();if(typeof saved.jobId==='string'&&(!saved.pageUrl||sameApplicationUrl(saved.pageUrl,currentTabUrl)))applyJobs.select(saved.jobId);},
    prepareApplyChat(){return syncApplyChat(applyJobs.selected(), {preload:true});},
    applyChatUrl(){const selected=applyJobs.selected();return selected&&(generations.forJob(selected.id)?.url||requestChatUrl(selected));},
    chatError(message) { status(message); showNotice('Chat could not open', message); }
  };
}
