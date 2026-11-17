import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplicationFilters } from '../extension/studio/application-filters.js';
import {applicationDateBounds,matchesApplicationDate} from '../extension/studio/application-filter-model.js';
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
test('search combines with status/date filters and clear resets the whole filter set', () => {
  let filters = { query: '', view: 'list', status: 'interview', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'America/New_York' };
  const React = { useRef:value=>({current:value}),useEffect:()=>{},createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const Filters = createApplicationFilters(React, { useApplications: () => ({ filters, onFiltersChange: next => { filters = next; } }), Manage: 'Manage' });
  let tree = Filters(), input = nodes(tree).find(node => node.props?.type === 'search');
  assert.equal(input.props.placeholder, 'Search company or role'); input.props.onChange({ target: { value: 'engineer' } });
  assert.equal(filters.status, 'interview'); assert.equal(filters.startDate, '2026-11-01'); assert.equal(filters.endDate, '2026-11-30'); assert.equal(filters.query, 'engineer');
  tree = Filters(); nodes(tree).find(node => node.props?.['aria-label'] === 'Applied from').props.onChange({ target: { value: '2026-12-10' } });
  assert.equal(filters.endDate, '2026-12-10');
  tree = Filters(); nodes(tree).find(node => node.type === 'button').props.onClick();
  assert.equal(filters.status, 'all'); assert.equal(filters.query, ''); assert.equal(filters.startDate, undefined); assert.equal(filters.endDate, undefined); assert.equal(filters.timezone, 'America/New_York');
});

test('period shortcuts use exact rolling hours, calendar month in the selected timezone, and inclusive custom dates',()=>{
  const now=Date.parse('2026-11-02T17:00:00Z'),timezone='America/New_York';
  for(const [period,hours]of [['week',168],['3days',72],['24hours',24]]){
    const filters={period,timezone},start=now-hours*3600000;
    assert.deepEqual(applicationDateBounds(filters,now),{from:start,to:now});
    assert.equal(matchesApplicationDate(new Date(start).toISOString(),filters,now),true);
    assert.equal(matchesApplicationDate(new Date(start-1).toISOString(),filters,now),false);
    assert.equal(matchesApplicationDate(new Date(now+1).toISOString(),filters,now),false);
  }
  assert.equal(applicationDateBounds({period:'month',timezone},now).from,Date.parse('2026-11-01T04:00:00Z'));
  const custom={startDate:'2026-11-01',endDate:'2026-11-01',timezone};
  assert.deepEqual(applicationDateBounds(custom,now),{from:Date.parse('2026-11-01T04:00:00Z'),to:Date.parse('2026-11-02T04:59:59.999Z')});
  assert.equal(matchesApplicationDate('2026-11-02T04:59:59Z',custom,now),true);
  assert.equal(matchesApplicationDate('2026-11-02T05:00:00Z',custom,now),false);
  assert.equal(matchesApplicationDate('',{period:'24hours'},now),false);
  assert.equal(matchesApplicationDate('',{period:'all'},now),true);
});

test('changing period preserves search and status, custom dates replace the preset, and clear resets it',()=>{
  let filters={query:'designer',status:'interview',timezone:'UTC',startDate:'2026-10-01'};
  const React={useRef:value=>({current:value}),useEffect:()=>{},createElement:(type,props,...children)=>({type,props:{...props,children}})};
  const Filters=createApplicationFilters(React,{useApplications:()=>({filters,onFiltersChange:next=>{filters=next;}}),Manage:'Manage'});
  const control=label=>nodes(Filters()).find(node=>node.props?.['aria-label']===label);
  control('Date period').props.onChange({target:{value:'24hours'}});
  assert.equal(filters.period,'24hours');assert.equal(filters.startDate,undefined);assert.equal(filters.query,'designer');assert.equal(filters.status,'interview');
  control('Applied from').props.onChange({target:{value:'2026-11-01'}});
  assert.equal(filters.period,'all');assert.equal(control('Date period').props.value,'custom');
  control('Date period').props.onChange({target:{value:'month'}});
  nodes(Filters()).find(node=>node.type==='button').props.onClick();
  assert.equal(filters.period,'all');assert.equal(filters.query,'');assert.equal(filters.startDate,undefined);
});

test('Meetings filters offer only the five application stages on its board', () => {
  const React = { useRef:value=>({current:value}),useEffect:()=>{},createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const Filters = createApplicationFilters(React, { useApplications: () => ({ filters: { query: '', view: 'list', status: 'all' }, allowedStatuses: ['screen','interview','offer','rejected','archived'], statusLabels: { archived: 'Archived' } }), Manage: 'Manage' });
  const select=nodes(Filters()).find(node=>node.props?.['aria-label']==='Application status');
  const options = nodes(select).filter(node => node.type === 'option');
  assert.deepEqual(options.map(node => node.props.value), ['all','screen','interview','offer','rejected','archived']);
  assert.equal(options.at(-1).props.children[0], 'Archived');
});
