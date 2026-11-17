import {duplicateJobUrl} from './job-duplicates.mjs';
import {sameApplicationUrl,matchesApplicationSession} from './application-identity.mjs';
import {canDownloadSavedDocument} from './job-readiness.mjs';

export function companyMonogram(name) {
  const words = String(name || '?').trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase();
}

function listingUrl(value) {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

// Connect the reference's prepared-job picker to this workspace's saved queue.
export function createApplyJobs({ root = document, onSelectionChange = () => {} } = {}) {
  const q = selector => root.querySelector(selector), selectedByCandidate = new Map(), manualPages = new Map(), lastPages = new Map();
  let current, jobs = [], candidateId, choicesKey = '', selectionKey = '';
  const text = (selector, value) => { const node = q(selector); if (node.textContent !== value) node.textContent = value; };
  function select(id) {
    if (!jobs.some(job => String(job.id) === String(id))) return;
    selectedByCandidate.set(candidateId, String(id));manualPages.set(candidateId,duplicateJobUrl(current?.currentTabUrl));render(current);
  }
  q('#apply-job-select').addEventListener('change', event => select(event.target.value));
  q('#apply-previous').addEventListener('click', () => select(jobs[jobs.findIndex(job => String(job.id) === q('#apply-job-select').value) - 1]?.id));
  q('#apply-next').addEventListener('click', () => select(jobs[jobs.findIndex(job => String(job.id) === q('#apply-job-select').value) + 1]?.id));
  function render(value) {
    current = value;
    if (!value) return;
    candidateId = value.candidate.id;
    jobs = value.jobs.filter(job => job.state !== 'cancelled' && !job.capturePending)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    let id = selectedByCandidate.get(candidateId);
    const page=duplicateJobUrl(value.currentTabUrl),matched=page&&jobs.find(job=>value.applicationSession?.jobId===job.id&&matchesApplicationSession(value.applicationSession,value.currentTabUrl,value.currentTabId)||[job.input.job.url,job.captureSourceUrl].some(url=>sameApplicationUrl(url,value.currentTabUrl)));
    if(lastPages.has(candidateId)&&lastPages.get(candidateId)!==page)manualPages.delete(candidateId);
    lastPages.set(candidateId,page);
    if(matched&&manualPages.get(candidateId)!==page){id=String(matched.id);selectedByCandidate.set(candidateId,id);}
    if (!jobs.some(job => String(job.id) === id)) { id = String(jobs[0]?.id ?? ''); selectedByCandidate.set(candidateId, id); }
    const job = jobs.find(job => String(job.id) === id);
    const prepared=job?.state==='ready'&&!!job.resume;
    const hasResume=canDownloadSavedDocument(job,'resume'),hasLetter=canDownloadSavedDocument(job,'cover-letter');
    const nextSelection = JSON.stringify([candidateId, id]);
    if (selectionKey !== nextSelection) {
      selectionKey = nextSelection; onSelectionChange(job);
    }
    text('#apply-candidate', value.candidate.name);
    q('.apply-job-picker').hidden=false;
    text('.apply-context > :first-child',matched&&String(matched.id)===id?'On this page':'Your queued jobs');
    q('#apply-setup').hidden = !job; q('#apply-empty').hidden = !!job;
    const nextKey = JSON.stringify([candidateId, jobs.map(job => [job.id, job.input.job.company, job.input.job.role, job.isExample])]);
    if (choicesKey !== nextKey) {
      choicesKey = nextKey;
      q('#apply-job-select').replaceChildren(...jobs.map(job => {
        const option = root.createElement('option'); option.value = String(job.id);
        option.textContent = `${job.input.job.company || 'Base resume'} · ${job.input.job.role}${job.isExample ? ' (Example)' : ''}`;
        return option;
      }));
    }
    q('#apply-job-select').value = id;
    if (!job) return;
    const index = jobs.indexOf(job), input = job.input.job;
    text('#apply-job-count', `· ${index + 1} of ${jobs.length}`);
    q('#apply-previous').disabled = index === 0; q('#apply-next').disabled = index === jobs.length - 1;
    text('#apply-company-logo', companyMonogram(input.company)); text('#apply-company', input.company || 'Base resume');
    text('#apply-role', input.role);
    const salary = typeof input.salary === 'string' ? input.salary.trim() : '';
    text('#apply-salary', salary);
    q('#apply-salary').hidden = !salary; q('#apply-salary').title = input.salaryBasis || '';
    text('#apply-resume-name', hasResume?'Saved for this job':'Prepare a resume in Queue');
    q('#apply-job-card .state-pill').dataset.state=prepared?'ready':job.state;
    q('#apply-job-card .state-pill').textContent=prepared?'Ready':job.state==='queued'?'Queued':'Needs review';
    q('#apply-letter-row').hidden = !job.coverLetterEnabled || !job.coverLetter?.trim();
    q('#apply-download').disabled = !hasResume||value.pending.has(`download-resume:${job.id}`);
    q('#apply-letter-download').disabled = !hasLetter||value.pending.has(`download-cover-letter:${job.id}`);
    q('#apply-resume').disabled=!hasResume;q('#apply-letter').disabled=!hasLetter;
    q('#apply-update').disabled=false;
    q('#apply-copy').disabled=value.pending.has(`copy-prompt:${job.id}`);
    for (const button of q('#apply-panel').querySelectorAll('button[data-action]')) button.dataset.request = String(job.id);
    const url = listingUrl(input.url), link = q('#apply-open-job'), busy = value.pending.has(`apply:${job.id}`);
    link.dataset.request = String(job.id); link.toggleAttribute('href', !!url);
    if (url) link.href = url;
    link.setAttribute('aria-disabled', String(!url || busy)); link.setAttribute('aria-busy', String(busy));
    text('#apply-site', url ? new URL(url).hostname.replace(/^www\./, '') : 'No application link saved');
    text('#apply-tab-state', !url ? 'This job has no saved listing URL.' : listingUrl(value.currentTabUrl) === url ? 'Current browser tab' : 'Opens or reuses the job tab');
    if (q('#apply-feedback').dataset.request !== String(job.id)) {
      q('#apply-feedback').dataset.request = String(job.id); text('#apply-feedback', '');
    }
    if(q('#apply-download-status').dataset.request!==String(job.id)){
      const feedback=q('#apply-download-status');feedback.dataset.request=String(job.id);feedback.textContent='';delete feedback.dataset.level;feedback.setAttribute('role','status');
    }
  }
  return { render, select, selected: () => jobs.find(job => String(job.id) === q('#apply-job-select').value) };
}
