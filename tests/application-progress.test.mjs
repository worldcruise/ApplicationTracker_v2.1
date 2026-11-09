import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationProgress } from '../extension/studio/application-progress.js';

test('progress periods use local day, Monday-based week, month and total boundaries', () => {
  const now = new Date(2026, 10, 8, 12);
  const record = (status, date) => ({ status, timestamp: date === null ? null : new Date(...date).getTime() });
  const rows = [record('applied', [2026,10,8,1]), record('screen', [2026,10,8,2]), record('interview', [2026,10,2,3]), record('offer', [2026,10,1,4]), record('rejected', [2026,9,30,5]), record('archived', null), record('screen', [2026,10,9,1])];
  const today = applicationProgress(rows, 'today', now);
  assert.equal(today.total, 2); assert.equal(today.counts.screen, 1); assert.equal(today.pending, 1);
  assert.equal(applicationProgress(rows, 'week', now).total, 3);
  assert.equal(applicationProgress(rows, 'month', now).total, 4);
  const total = applicationProgress(rows, 'total', now); assert.equal(total.total, 7); assert.equal(total.counts.archived, 1);
  assert.equal(Object.values(total.counts).reduce((sum,count) => sum + count, 0) + total.pending, total.total);
  assert.throws(() => applicationProgress(rows, 'year', now), /valid progress period/);
});
