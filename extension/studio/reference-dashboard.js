import { ACTIVITY_MARKUP } from './reference-dashboard-markup.js';
import { referenceDashboardData, activityTime, safeJobUrl } from './reference-dashboard-data.js';
import { openDashboard } from './dock.js';

export function mountReferenceDashboard(root, browser = globalThis.chrome, { onApplications, onApply } = {}) {
  const document=root.ownerDocument;
  let alive = true, revision = 0, selecting = false;
  const feedback = root.querySelector('#rd-feedback'), picker = root.querySelector('#rd-candidate');
  const show = message => { if (alive) { feedback.textContent = message; feedback.hidden = !message; } };
  async function request(operation, payload = {}) {
    const reply = await browser.runtime.sendMessage({ version: 1, operation, requestId: crypto.randomUUID(), payload });
    if (!reply?.ok) throw new Error(reply?.error?.message || 'The dashboard could not load. Please refresh.');
    return reply.result;
  }
  async function refresh() {
    const current = ++revision;
    try {
      const [state, saved, session] = await Promise.all([request('DASHBOARD_STATE'), browser.storage.local.get(['appliedList']), browser.storage.session.get(null)]);
      if (!alive || current !== revision) return;
      const data = referenceDashboardData(saved, session, new Date(), state.candidate?.document.candidate.id);
      const name = state.candidate?.document.candidate.name || 'Create your profile';
      root.querySelector('#rd-name').textContent = name;
      root.querySelector('#rd-avatar').textContent = state.candidate ? name.charAt(0).toUpperCase() : '–';
      picker.replaceChildren();
      if (!state.candidate) { const option = document.createElement('option'); option.value = ''; option.textContent = 'Candidate'; picker.append(option); }
      for (const candidate of state.candidates) { const option = document.createElement('option'); option.value = candidate.id; option.textContent = candidate.name; picker.append(option); }
      picker.value = state.candidate?.document.candidate.id || ''; picker.disabled = selecting || !state.candidates.length;
      picker.title=name;
      root.querySelector('.rd-stat-resume strong').textContent = String(data.resumes);
      root.querySelector('.rd-stat-applications strong').textContent = String(data.applications);
      root.querySelector('.rd-stat-meetings strong').textContent = '—';
      root.querySelector('.rd-stat-meetings').title = 'Calendar is not connected.';
      const recent = root.querySelector('.rd-recent'); recent.replaceChildren(); recent.setAttribute('aria-label', 'Recent activity');
      for (const record of data.activity) {
        const row = document.createElement('button'); row.type = 'button'; row.className = 'rd-activity application cursor-interaction'; row.innerHTML = ACTIVITY_MARKUP;
        row.dataset.url = record.url || ''; row.title = `${record.title} · ${record.company}`;
        row.querySelector('.rd-activity-title').textContent = record.title;
        row.querySelector('.rd-activity-company').textContent = record.company;
        row.querySelector('.rd-time').textContent = activityTime(record.timestamp);
        recent.append(row);
      }
      if (!data.activity.length) { const empty = document.createElement('p'); empty.className = 'rd-empty'; empty.textContent = 'No recent activity'; recent.append(empty); }
    } catch (error) { if (alive && current === revision) show(error.message); }
  }
  async function select() {
    selecting = true; picker.disabled = true; show('');
    try { await request('DASHBOARD_SELECT_PROFILE', { candidateId: picker.value }); }
    catch (error) { show(error.message); }
    finally { selecting = false; if (alive) await refresh(); }
  }
  async function click(event) {
    if (event.target.closest('#job-records-design,#apply-ready-queue-design')) return;
    const button = event.target.closest('button');
    if (!button || !root.contains(button) || button.disabled) return;
    if (button.id === 'rd-refresh') { root.querySelectorAll('button[aria-pressed]').forEach(item => item.setAttribute('aria-pressed', 'false')); show(''); await refresh(); return; }
    const action = button.dataset.action;
    if (action) root.querySelectorAll('.rd-action').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    else if (button.classList.contains('rd-activity')) root.querySelectorAll('.rd-activity').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
    button.disabled = true; show('');
    try {
      if (action === 'Browse Jobs') await browser.tabs.create({ url: 'https://www.linkedin.com/jobs/', active: true });
      else if (action === 'Applications') { if (onApplications) await onApplications('applications'); else await openDashboard('/', browser); }
      else if (action === 'Profile settings') await openDashboard('/settings/profile', browser);
      else if (action === 'Meetings') await openDashboard('/meetings', browser);
      else if (action === 'Apply to Job') {
        if(onApply){await onApply();return;}
        const window = await browser.windows.getCurrent(), tabs = await browser.tabs.query({ windowId: window.id });
        const eligible = tabs.filter(tab => Number.isSafeInteger(tab.id) && safeJobUrl(tab.url));
        const tab = eligible.find(tab => tab.active) || eligible.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0];
        if (!tab) throw new Error('Open a job listing before applying.');
        await browser.tabs.update(tab.id, { active: true });
        const capture = await request('CAPTURE_COMMAND', { command: 'capture-job', sourceTabId: tab.id });
        if (!capture?.captureId) throw new Error('The job could not be captured. Review the listing in Resume Studio.');
      } else if (button.classList.contains('rd-activity')) {
        if (onApplications) { await onApplications('applications',button.dataset.url); return; }
        const url = safeJobUrl(button.dataset.url);
        if (url) await browser.tabs.create({ url, active: true }); else await openDashboard('/', browser);
      }
    } catch (error) { show(error.message || 'The action could not open. Please try again.'); }
    finally { if (alive) button.disabled = false; }
  }
  const changed = (changes, area) => { if (area === 'local' && (changes.profile || changes.appliedList) || area === 'session' && Object.keys(changes).some(key => key.startsWith('pdf-export:'))) refresh(); };
  picker.addEventListener('change', select); root.addEventListener('click', click);
  browser.storage.onChanged.addListener(changed); refresh();
  const timer = setInterval(refresh, 60000);
  return () => { alive = false; revision++; clearInterval(timer); picker.removeEventListener('change', select); root.removeEventListener('click', click); browser.storage.onChanged.removeListener(changed); };
}

