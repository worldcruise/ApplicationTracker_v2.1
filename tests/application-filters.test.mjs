import assert from 'node:assert/strict';
import test from 'node:test';
import { createApplicationFilters } from '../extension/studio/application-filters.js';
function nodes(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)]; }
test('search combines with status/date filters and clear resets the whole filter set', () => {
  let filters = { query: '', view: 'list', status: 'interview', startDate: '2026-11-01', endDate: '2026-11-30', timezone: 'America/New_York' };
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const Filters = createApplicationFilters(React, { useApplications: () => ({ filters, onFiltersChange: next => { filters = next; } }), Manage: 'Manage' });
  let tree = Filters(), input = nodes(tree).find(node => node.props?.type === 'search');
  assert.equal(input.props.placeholder, ''); input.props.onChange({ target: { value: 'engineer' } });
  assert.equal(filters.status, 'interview'); assert.equal(filters.startDate, '2026-11-01'); assert.equal(filters.endDate, '2026-11-30'); assert.equal(filters.query, 'engineer');
  tree = Filters(); nodes(tree).find(node => node.props?.['aria-label'] === 'Applied from').props.onChange({ target: { value: '2026-12-10' } });
  assert.equal(filters.endDate, '2026-12-10');
  tree = Filters(); nodes(tree).find(node => node.type === 'button').props.onClick();
  assert.equal(filters.status, 'all'); assert.equal(filters.query, ''); assert.equal(filters.startDate, undefined); assert.equal(filters.endDate, undefined); assert.equal(filters.timezone, 'America/New_York');
});

test('Meetings filters offer only the five application stages on its board', () => {
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) };
  const Filters = createApplicationFilters(React, { useApplications: () => ({ filters: { query: '', view: 'list', status: 'all' }, allowedStatuses: ['screen','interview','offer','rejected','archived'], statusLabels: { archived: 'Archived' } }), Manage: 'Manage' });
  const options = nodes(Filters()).filter(node => node.type === 'option');
  assert.deepEqual(options.map(node => node.props.value), ['all','screen','interview','offer','rejected','archived']);
  assert.equal(options.at(-1).props.children[0], 'Archived');
});
