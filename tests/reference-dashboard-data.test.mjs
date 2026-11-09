import assert from 'node:assert/strict';
import test from 'node:test';
import { referenceDashboardData, safeJobUrl } from '../extension/studio/reference-dashboard-data.js';

test('reference dashboard counts saved submissions and completed CVs for the local day', () => {
  const now = new Date(2026, 10, 8, 12), today = new Date(2026, 10, 8, 0).getTime();
  const saved = { appliedList: [
    { jobTitle: 'Today', companyName: 'Example', date: today },
    { jobTitle: 'Yesterday', date: today - 1 },
    { jobTitle: 'Future', date: now.getTime() + 1 },
    { jobTitle: 'Undated', date: 'invalid', jobLink: 'javascript:alert(1)' },
  ] };
  const ticket = { candidateId: 'one', createdAt: today, files: [{ kind: 'cv', state: 'complete' }] };
  const session = { 'pdf-export:done': ticket, 'pdf-export:pending': { ...ticket, files: [{ kind: 'cv', state: 'prepared' }] }, 'pdf-export:other': { ...ticket, candidateId: 'two' } };
  const data = referenceDashboardData(saved, session, now, 'one');
  assert.equal(data.applications, 1); assert.equal(data.resumes, 1);
  assert.equal(data.activity.at(-1).url, null);
  assert.equal(safeJobUrl('https://example.test/job'), 'https://example.test/job');
  assert.equal(safeJobUrl('chrome-extension://test/options.html'), null);
  assert.throws(() => referenceDashboardData({ appliedList: {} }), /could not be read/);
});
