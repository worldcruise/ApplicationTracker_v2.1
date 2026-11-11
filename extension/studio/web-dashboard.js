import { normalizeProfile, profileName } from './profile-model.js';
import { openDashboard, openStudioPreview } from './dock.js';
import { readDashboard, applicationMetrics, applicationSeries, saveDailyGoal } from './web-dashboard-data.js';
import { createApplicationProgress } from './application-progress.js';

export function createWebDashboard(React, { Chart } = {}) {
  const h = React.createElement;
  const Progress = createApplicationProgress(React);
  const iconPaths = { document: 'M14 3H5v18h14V9l-5-6M14 3v6h5M9 13h6m-6 4h6', chart: 'M4 20h17M7 16v-5m5 5V5m5 11V8', calendar: 'M5 4h14v17H5zM8 2v4m8-4v4M5 9h14', arrow: 'M5 12h14m-5-5 5 5-5 5' };
  const icon = name => h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: iconPaths[name] }));
  return function WebDashboard() {
    const [snapshot, setSnapshot] = React.useState(null), [name, setName] = React.useState(''), [windowId, setWindowId] = React.useState(null);
    const [error, setError] = React.useState(''), [pending, setPending] = React.useState(''), [days, setDays] = React.useState(30), [editing, setEditing] = React.useState(false), [goalInput, setGoalInput] = React.useState('');
    const alive = React.useRef(true), busy = React.useRef(false), browser = globalThis.chrome;
    React.useEffect(() => {
      alive.current = true; let revision = 0, windowRevision = 0;
      async function refresh() {
        const current = ++revision;
        try {
          const [data, saved] = await Promise.all([readDashboard(browser), browser.storage.local.get('profile')]);
          if (alive.current && revision === current) { setSnapshot(data); try { setName(saved.profile ? profileName(normalizeProfile(saved.profile)) : ''); } catch { setName(''); } }
        } catch (cause) { if (alive.current && revision === current) setError(cause.message); }
      }
      async function refreshWindow() {
        const current = ++windowRevision;
        try { const window = await browser.windows.getCurrent(); if (alive.current && current === windowRevision) { setWindowId(window.type === 'normal' ? window.id : null); } }
        catch { if (alive.current && current === windowRevision) { setWindowId(null); } }
      }
      const changed = (changes, area) => { if (area === 'local' && (changes.appliedList || changes.dailyGoal || changes.profile)) refresh(); };
      refresh(); refreshWindow(); browser.storage.onChanged.addListener(changed);
      const timer = setInterval(() => { refresh(); refreshWindow(); }, 60000);
      return () => { alive.current = false; revision++; windowRevision++; clearInterval(timer); browser.storage.onChanged.removeListener(changed); };
    }, []);
    function run(label, action) {
      if (busy.current) return; busy.current = true; setPending(label); setError('');
      Promise.resolve().then(action).catch(cause => { if (alive.current) setError(cause.message || 'Please try again.'); }).finally(() => { busy.current = false; if (alive.current) setPending(''); });
    }
    const button = (label, action, primary = false, disabled = false) => h('button', { type: 'button', className: `web-button${primary ? ' web-button-primary' : ''}`, disabled: disabled || Boolean(pending), onClick: action }, label);
    const records = snapshot?.records || [], metrics = snapshot ? applicationMetrics(records) : null, series = applicationSeries(records, days), seriesTotal = series.reduce((sum, item) => sum + item.count, 0);
    const goal = snapshot?.goal, progress = goal && metrics ? Math.min(100, metrics.today / goal * 100) : 0;
    return h('section', { className: 'web-dashboard', 'aria-labelledby': 'web-dashboard-title' },
      h('header', { className: 'web-dashboard-hero' }, h('div', null, h('span', { className: 'web-eyebrow' }, 'Workspace overview'), h('h1', { id: 'web-dashboard-title' }, 'Dashboard'), h('p', null, 'Track your progress and prepare your next application.')),
        h('div', { className: 'web-dashboard-profile' }, h('span', { className: 'web-dashboard-avatar', 'aria-hidden': true }, name ? name.split(/\s+/).map(part => part[0]).slice(0, 2).join('') : '—'), h('div', null, h('small', null, 'Active profile'), h('strong', null, name || 'Create your profile')), button(name ? 'Edit profile' : 'Create profile', () => run('Opening profile', () => openDashboard('/settings/profile', browser))))),
      error && h('p', { className: 'web-message web-error', role: 'alert' }, error), pending && h('p', { className: 'web-message', role: 'status' }, `${pending}…`),
      h('div', { className: 'web-dashboard-stats', 'aria-label': 'Application summary' }, [['today', 'Today', 'calendar', 'Today’s submissions'], ['week', 'This week', 'chart', 'Since Monday'], ['month', 'This month', 'document', 'This calendar month'], ['total', 'Total applications', 'chart', 'Your saved history']].map(([key, label, symbol, note]) => h('article', { key, className: `web-dashboard-stat web-dashboard-stat-${key}` }, h('div', null, h('span', null, label), icon(symbol)), h('strong', { 'aria-label': `${label}: ${metrics ? metrics[key] : 'unavailable'}` }, metrics ? metrics[key].toLocaleString() : '—'), h('small', null, note)))),
      h('div', { className: 'web-dashboard-columns' },
        h('div', { className: 'web-dashboard-main' },
          h('section', { className: 'web-card web-dashboard-chart-card' }, h('header', { className: 'web-card-heading' }, h('div', null, h('h2', null, 'Application activity'), h('p', null, snapshot ? `${seriesTotal} saved applications in the last ${days} days` : 'Loading saved activity…')),
            h('label', { className: 'web-dashboard-range' }, h('span', { className: 'visually-hidden' }, 'Chart date range'), h('select', { value: days, onChange: event => setDays(Number(event.target.value)) }, [7, 30, 90].map(value => h('option', { key: value, value }, `Last ${value} days`))))),
            snapshot && Chart ? h('div', { className: 'web-dashboard-chart' }, h(Chart, { data: series, bucket: 'day' })) : h('p', { className: 'web-dashboard-empty' }, 'Saved application activity will appear here.')),
          h(Progress, { records, loading: !snapshot }),
          h('div', { className: 'web-dashboard-actions' }, [['Resume Studio', 'Preview your tailored document', 'document', () => openStudioPreview(windowId, browser)], ['Prompt settings', 'Tune templates and instructions', 'chart', () => openDashboard('/settings/prompts', browser)]].map(([label, detail, symbol, action]) => h('button', { key: label, type: 'button', className: 'web-card web-dashboard-action', disabled: Boolean(pending) || windowId === null, onClick: () => run(`Opening ${label}`, action) }, icon(symbol), h('span', null, h('strong', null, label), h('small', null, detail)), icon('arrow'))))),
        h('aside', { className: 'web-dashboard-side' },
          h('section', { className: 'web-card web-dashboard-goal' }, h('header', { className: 'web-card-heading' }, h('h2', null, 'Daily goal'), button(goal ? 'Edit' : 'Set goal', () => { setGoalInput(String(goal || 10)); setEditing(true); }, false, !snapshot)),
            h('div', { className: 'web-dashboard-goal-number' }, h('strong', null, metrics?.today ?? '—'), h('span', null, ` / ${goal || '—'} applications`)), h('div', { className: 'web-dashboard-progress', role: 'progressbar', 'aria-label': 'Daily application goal', 'aria-valuemin': 0, 'aria-valuemax': goal || undefined, 'aria-valuenow': goal && metrics ? Math.min(metrics.today, goal) : undefined, 'aria-valuetext': goal ? `${metrics?.today || 0} of ${goal}` : 'Set a daily goal' }, h('span', { style: { width: `${progress}%` } })),
            h('p', null, goal ? metrics?.today >= goal ? 'Daily goal reached.' : `${Math.max(0, goal - (metrics?.today || 0))} more to reach today’s goal.` : 'Set a target that fits your search.'),
            editing && h('form', { className: 'web-dashboard-goal-form', onSubmit: event => { event.preventDefault(); run('Saving goal', async () => { const saved = await saveDailyGoal(goalInput, browser); if (alive.current) { setSnapshot(value => ({ ...value, goal: saved })); setEditing(false); } }); } }, h('label', null, 'Applications per day', h('input', { type: 'number', min: 1, max: 999, step: 1, required: true, value: goalInput, onChange: event => setGoalInput(event.target.value) })), h('button', { type: 'submit', className: 'web-button web-button-primary', disabled: Boolean(pending) }, 'Save'), button('Cancel', () => setEditing(false)))),
          h('section', { className: 'web-card web-dashboard-recent' }, h('header', { className: 'web-card-heading' }, h('h2', null, 'Recent applications'), button('View all', () => run('Opening applications', () => openDashboard('/', browser)))), records.length ? h('ol', null, records.slice(0, 5).map(record => h('li', { key: record.id }, icon('document'), h('div', null, record.url ? h('a', { href: record.url, target: '_blank', rel: 'noopener noreferrer' }, record.title) : h('strong', null, record.title), h('span', null, record.company), h('small', null, record.timestamp === null ? 'Unknown date' : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(record.timestamp))), h('span', { className: 'web-dashboard-status' }, record.status)))) : h('p', { className: 'web-dashboard-empty' }, snapshot ? 'No applications yet' : 'Loading saved history…')))));
  };
}
