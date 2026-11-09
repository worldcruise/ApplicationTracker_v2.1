export const PROGRESS_STAGES = [
  { id: 'screen', name: 'Screening' }, { id: 'interview', name: 'Interview' }, { id: 'offer', name: 'Offer' },
  { id: 'rejected', name: 'Rejected' }, { id: 'archived', name: 'Archived' },
];
export const PROGRESS_PERIODS = [['today', 'Today'], ['week', 'This week'], ['month', 'This month'], ['total', 'Total']];

export function applicationProgress(records, period = 'today', now = new Date()) {
  if (!PROGRESS_PERIODS.some(([value]) => value === period)) throw new Error('Choose a valid progress period.');
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  if (period === 'month') start.setDate(1);
  const selected = records.filter(record => period === 'total' || record.timestamp !== null && record.timestamp >= start.getTime() && record.timestamp <= now.getTime());
  const counts = Object.fromEntries(PROGRESS_STAGES.map(stage => [stage.id, 0]));
  for (const record of selected) {
    const status = String(record.status || '').trim().toLowerCase();
    const canonical = status === 'screening' ? 'screen' : status === 'failed' ? 'archived' : status;
    if (Object.hasOwn(counts, canonical)) counts[canonical]++;
  }
  const total = selected.length, progressed = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { total, counts, pending: total - progressed };
}

export function createApplicationProgress(React) {
  const h = React.createElement;
  return function ApplicationProgress({ records, loading = false }) {
    const [period, setPeriod] = React.useState('today');
    const data = applicationProgress(records, period);
    const summary = `Total applied: ${data.total}. ${PROGRESS_STAGES.map(stage => `${stage.name}: ${data.counts[stage.id]}`).join('. ')}. Awaiting response: ${data.pending}.`;
    return h('section', { className: 'web-card application-progress', 'aria-labelledby': 'application-progress-title' },
      h('header', { className: 'web-card-heading' }, h('div', null, h('h2', { id: 'application-progress-title' }, 'Application progress'), h('p', null, 'Current status of applications submitted in the selected period.')),
        h('label', { className: 'application-progress-period' },
          h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('path', { d: 'M4 5h16v16H4zM8 2v6m8-6v6M4 11h16' })),
          h('span', { className: 'visually-hidden' }, 'Progress period'), h('select', { 'aria-label': 'Progress period', value: period, onChange: event => setPeriod(event.target.value) }, PROGRESS_PERIODS.map(([value, label]) => h('option', { key: value, value }, label))))),
      loading ? h('p', { role: 'status', className: 'web-dashboard-empty' }, 'Loading application progress…') : h('div', { className: 'application-progress-figure' },
        h('svg', { className: 'application-progress-svg', viewBox: '0 0 850 292', role: 'img', 'aria-label': summary },
          h('rect', { x: 18, y: 97, width: 174, height: 100, rx: 14, className: 'progress-source-panel' }),
          h('text', { x: 105, y: 129, textAnchor: 'middle', className: 'progress-source-label' }, 'Total applied'),
          h('text', { x: 105, y: 171, textAnchor: 'middle', className: 'progress-source-count' }, data.total),
          h('text', { x: 105, y: 220, textAnchor: 'middle', className: 'progress-pending' }, `${data.pending} awaiting response`),
          PROGRESS_STAGES.map((stage, index) => {
            const count = data.counts[stage.id], fraction = data.total ? count / data.total : 0, y = 30 + index * 55;
            return h('g', { key: stage.id, className: `progress-stage progress-stage-${stage.id}`, 'data-count': count },
              h('path', { d: `M192 147 C340 147 345 ${y} 500 ${y}`, className: `progress-branch${count ? '' : ' progress-branch-empty'}`, strokeWidth: count ? 3 + fraction * 12 : 2 }),
              h('circle', { cx: 500, cy: y, r: 4, className: 'progress-stage-dot' }),
              stage.id === 'archived' && h('g', { transform: `translate(520 ${y - 17}) scale(.6667)`, className: 'progress-archive-icon', 'aria-hidden': true },
                h('rect', { x: 3, y: 3, width: 18, height: 4, rx: 1 }), h('path', { d: 'M5 7v13a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V7M10 11h4' })),
              h('text', { x: stage.id === 'archived' ? 544 : 520, y: y - 4, className: 'progress-stage-name' }, stage.name),
              h('text', { x: 810, y: y - 4, textAnchor: 'end', className: 'progress-stage-value' }, `${count} · ${Math.round(fraction * 100)}%`),
              h('rect', { x: 520, y: y + 9, width: 290, height: 6, rx: 3, className: 'progress-stage-track' }),
              h('rect', { x: 520, y: y + 9, width: fraction * 290, height: 6, rx: 3, className: 'progress-stage-fill' }));
          }))));
  };
}
