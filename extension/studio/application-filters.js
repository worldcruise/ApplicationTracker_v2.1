import {APPLICATION_PERIODS} from './application-filter-model.js';
import {createWorkflowTools} from './meeting-workflow-view.js';
import {ATTENTION_FOCUS_EVENT,attentionFocusRequest} from './meeting-attention.js';

export const APPLICATION_STATUSES = [
  ['all', 'All statuses'], ['applied', 'Applied'], ['screen', 'Screening'], ['interview', 'Interview'],
  ['offer', 'Offer'], ['rejected', 'Rejected'], ['archived', 'Failed'],
];

export function createApplicationFilters(React, { useApplications, Manage }) {
  const h = React.createElement;
  const WorkflowTools=createWorkflowTools(React);
  return function ApplicationFilters({trailingControl=null}={}) {
    const app = useApplications(), filters = app.filters;
    const handledFocus=React.useRef(0);
    React.useEffect(()=>{if(location.hash.startsWith('#/meetings'))return;const params=new URLSearchParams(location.hash.split('?')[1]||''),status=params.get('status'),query=params.get('query');if(status||query)app.onFiltersChange({...filters,status:APPLICATION_STATUSES.some(([id])=>id===status)?status:'all',query:query||'',period:'all',startDate:undefined,endDate:undefined});},[]);
    React.useEffect(()=>{const reveal=()=>{const request=attentionFocusRequest();if(!request||request===handledFocus.current||!location.hash.startsWith('#/meetings'))return;handledFocus.current=request;app.onFiltersChange({...filters,query:'',status:'all',period:'all',startDate:undefined,endDate:undefined});};window.addEventListener(ATTENTION_FOCUS_EVENT,reveal);reveal();return()=>window.removeEventListener(ATTENTION_FOCUS_EVENT,reveal);},[filters,app.onFiltersChange]);
    function change(key, value) {
      const next = { ...filters, [key]: value || (key === 'query' ? '' : undefined), view: filters.view || 'list' };
      if(key==='period'){next.startDate=undefined;next.endDate=undefined;}
      if(key==='startDate'||key==='endDate')next.period='all';
      if (key === 'startDate' && value && next.endDate && value > next.endDate) next.endDate = value;
      if (key === 'endDate' && value && next.startDate && value < next.startDate) next.startDate = value;
      app.onFiltersChange(next);
    }
    return h('div', { className: 'application-filters' },
      h('div', { className: 'application-list-tools' },
        h('label', { className: 'web-search' },
          h('svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, 'aria-hidden': true }, h('circle', { cx: 10.5, cy: 10.5, r: 6.5 }), h('path', { d: 'm16 16 5 5' })),
          h('input', { type: 'search', 'data-test': 'applications-table-filter-input', 'aria-label': 'Filter by role or company', placeholder: 'Search company or role', value: filters.query, onChange: event => change('query', event.target.value) })),
        !globalThis.location?.hash?.startsWith('#/meetings')&&h(WorkflowTools,{applications:true}),h(Manage)),
      h('div', { className: 'application-filter-fields', 'aria-label': 'Application filters' },
        h('label', null, 'Period', h('select', { 'aria-label': 'Date period', value: filters.startDate||filters.endDate?'custom':filters.period||'all', onChange: event => change('period', event.target.value) }, ...APPLICATION_PERIODS.map(([value,label])=>h('option',{key:value,value},label)),(filters.startDate||filters.endDate)&&h('option',{value:'custom'},'Custom dates'))),
        h('label', null, 'Status', h('select', { 'aria-label': 'Application status', value: filters.status, onChange: event => change('status', event.target.value) }, APPLICATION_STATUSES.filter(([value]) => value === 'all' || !app.allowedStatuses || app.allowedStatuses.includes(value)).map(([value, label]) => h('option', { key: value, value }, app.statusLabels?.[value] || label)))),
        h('label', null, 'From', h('input', { type: 'date', 'aria-label': 'Applied from', value: filters.startDate || '', max: filters.endDate || undefined, onChange: event => change('startDate', event.target.value) })),
        h('label', null, 'To', h('input', { type: 'date', 'aria-label': 'Applied to', value: filters.endDate || '', min: filters.startDate || undefined, onChange: event => change('endDate', event.target.value) })),
        h('button', { type: 'button', className: 'web-button', disabled: !filters.query && filters.status === 'all' && !filters.startDate && !filters.endDate && (!filters.period||filters.period==='all'), onClick: () => app.onFiltersChange({ ...filters, query: '', status: 'all', period:'all', startDate: undefined, endDate: undefined }) }, 'Clear filters'),trailingControl));
  };
}
