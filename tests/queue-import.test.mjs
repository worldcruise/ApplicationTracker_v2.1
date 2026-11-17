import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {dockFixture} from './helpers/dock-records-fixture.mjs';
import {recordsCsv} from '../extension/studio/record-export.js';
import {parseQueueCsv,queueJobKey,queueImportMessage} from '../extension/studio/queue-import.js';
import {openQueueImport} from '../extension/studio/queue-import-dialog.js';

test('queue CSV parser round-trips commas, quotes and multiline JD and rejects malformed files',()=>{
  const rows=[{company:'Company, Inc.',role:'Engineer "II"',description:'Build products.\r\nReview designs.\nCollaborate.',salary:'$100,000',url:'https://example.test/job'}];
  assert.deepEqual(parseQueueCsv(recordsCsv(rows)),rows);
  for(const source of ['', 'Company,Role,JD,Salary,Application link\r\n', 'Company,Role,JD,Salary,Application link\r\n"unfinished', 'Company,Role,JD,Salary,Application link\nA,B,C,D', 'Company,Role,JD,Salary,Application link\n"A"garbage,B,C,D,E'])assert.throws(()=>parseQueueCsv(source));
  assert.equal(queueJobKey('https://EXAMPLE.test/job?utm_source=csv#details'),queueJobKey('https://example.test/job'));
  assert.notEqual(queueJobKey('https://example.test/job?id=1'),queueJobKey('https://example.test/job?id=2'));
});

test('queue import skips saved jobs, submitted applications and duplicate file rows, reports invalid rows and retries safely',async t=>{
  const f=await dockFixture(t),existing=await f.ready(await f.create('queued')),before=structuredClone(existing);
  const row=(url,company='Imported')=>({company,role:'Engineer',description:'Build reliable products.',salary:'$100,000',url});
  const rows=[row(existing.url+'?utm_source=csv'),row('https://example.test/existing'),row('https://example.test/new'),row('https://example.test/new#details'),row('javascript:alert(1)'),{...row('https://example.test/no-jd'),description:''},row('https://example.test/second')];
  const payload={action:'import',type:'queue',rows,mutationId:crypto.randomUUID()},result=await f.request('DOCK_RECORDS_MUTATE',payload);
  assert.deepEqual({...result.importReport,errors:[]},{imported:2,skipped:3,failed:2,errors:[]});assert.deepEqual(result.importReport.errors.map(error=>error.row),[6,7]);
  assert.equal(result.jobs.length,3);assert.deepEqual(result.jobs.find(job=>job.id===existing.id),before);assert.equal(result.applications.length,1);
  const imported=result.jobs.find(job=>job.url==='https://example.test/new');assert.equal(imported.status,'Queued');assert.equal(imported.resume,null);assert.equal(imported.salary,'$100,000');assert.equal(imported.createdAt,f.deps.now());
  f.restart();const retry=await f.request('DOCK_RECORDS_MUTATE',payload);assert.deepEqual(retry.importReport,result.importReport);assert.equal(retry.jobs.length,3);
  const again=await f.request('DOCK_RECORDS_MUTATE',{...payload,mutationId:crypto.randomUUID()});assert.equal(again.importReport.imported,0);assert.equal(again.importReport.skipped,5);assert.equal(again.jobs.length,3);
  assert.equal(queueImportMessage(result.importReport),'Imported 2 jobs. Skipped 3 duplicates. 2 could not be imported.');
  await assert.rejects(f.request('DOCK_RECORDS_MUTATE',{...payload,type:'applications',mutationId:crypto.randomUUID()}),{code:'INVALID_REQUEST'});
});

test('re-importing an exported queue skips every existing row without changing documents',async t=>{
  const f=await dockFixture(t),seeded={jobs:[await f.ready(await f.create('first')),await f.ready(await f.create('second'))]},rows=parseQueueCsv(recordsCsv(seeded.jobs));
  const result=await f.request('DOCK_RECORDS_MUTATE',{action:'import',type:'queue',rows,mutationId:crypto.randomUUID()});
  assert.deepEqual(result.importReport,{imported:0,skipped:seeded.jobs.length,failed:0,errors:[]});assert.deepEqual(result.jobs,[...seeded.jobs].reverse());
});

test('import dialog reports results after completion and retains them until Done',async t=>{
  const page=new Window();t.after(()=>page.happyDOM.abort());let request,reported;
  const report={imported:1,skipped:2,failed:1,errors:[{row:4,message:'Enter a job description.'}]};
  const browser={runtime:{sendMessage:async message=>{request=message;return{ok:true,result:{jobs:[],applications:[],importReport:report}};}}};
  const dialog=openQueueImport(page.document.body,{browser,onImported:(result,message)=>reported=message}),file=dialog.querySelector('input[type=file]');
  Object.defineProperty(file,'files',{value:[new page.File([recordsCsv([{company:'A',role:'Engineer',description:'JD',salary:'$1',url:'https://example.test/a'}])],'jobs.csv',{type:'text/csv'})]});
  file.dispatchEvent(new page.Event('change'));await delay(10);assert.equal(dialog.querySelector('footer button:last-child').disabled,false);
  dialog.querySelector('footer button:last-child').click();await delay(10);
  assert.equal(request.payload.type,'queue');assert.equal(request.payload.action,'import');assert.equal(dialog.open,true);
  assert.equal(dialog.querySelector('[role=status]').textContent,reported);assert.match(reported,/Imported 1 jobs. Skipped 2 duplicates/);assert.match(dialog.querySelector('li').textContent,/Row 4/);
  assert.equal(dialog.querySelector('footer button:last-child').disabled,true);assert.equal(dialog.querySelector('footer button').textContent,'Done');dialog.querySelector('footer button').click();assert.equal(dialog.isConnected,false);
});
