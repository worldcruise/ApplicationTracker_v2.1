import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import test from 'node:test';
const execute = promisify(execFile);

test('packaged web routes mount with their real providers without runtime errors', async () => {
  const cases = [['/', 'Applications'], ['/dashboard', 'Dashboard'], ['/meetings', 'Meetings'], ['/settings/profile', 'Settings'], ['/settings/autofill', 'Settings']];
  const results = await Promise.allSettled(cases.map(async ([route, heading]) => {
    const args = ['scripts/web-runtime-smoke.mjs', route];
    if (route === '/') args.push('filters');
    if (route === '/meetings') args.push('meetings');
    if (route === '/dashboard') args.push('progress');
    const { stderr } = await execute(process.execPath, args, { windowsHide: true, timeout: 15000 });
    const report = JSON.parse(stderr.trim().split('\n').find(line => line.startsWith('{"route"')));
    assert.deepEqual(report.errors, [], route); assert.ok(report.headings.includes(heading), `${route}: ${report.text}`);
    if (route === '/' || route === '/dashboard') assert.ok(report.text.includes('Runtime Engineer'), `${route} must read a saved application through its actual provider`);
    if(route==='/settings/profile'||route==='/meetings')assert.ok(report.text.includes('Runtime M Candidate'),`${route} shows the complete candidate name instead of Default`);
    if (route === '/dashboard') { assert.equal(report.applicationBoard, false); assert.equal(report.progress, true); }
    assert.equal(report.dbButton, true);
    if (route === '/meetings') { assert.equal(report.applicationBoard, true); assert.equal(report.progress, false); assert.ok(report.text.includes('Archived')); assert.ok(!report.text.includes('Add meeting')); }
    if (route === '/') { assert.equal(report.searchPlaceholder, ''); assert.ok(!report.text.includes('Search applications')); }
  }));
  for (const result of results) if (result.status === 'rejected') throw result.reason;
});

test('clicking web page tabs and dashboard shortcuts renders destinations in the current tab', async () => {
  const { stderr } = await execute(process.execPath, ['scripts/web-runtime-smoke.mjs','/dashboard','navigation'], { windowsHide: true, timeout: 15000 });
  const report = JSON.parse(stderr.trim().split('\n').find(line => line.startsWith('{"route"')));
  assert.deepEqual(report.errors, []);
  assert.ok(report.headings.includes('Settings'));
});
