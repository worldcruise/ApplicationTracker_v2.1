import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {setTimeout as delay} from 'node:timers/promises';
import {dockFixture} from './helpers/dock-records-fixture.mjs';
import {resumeRenderer} from './helpers/resume-renderer.mjs';
import {applicationsJson,parseApplicationImport,APPLICATION_TRANSFER_TYPE} from '../extension/studio/application-transfer.js';
import {downloadRecordsCsv,recordsCsv} from '../extension/studio/record-export.js';
import {openQueueImport} from '../extension/studio/queue-import-dialog.js';
import {mountJobRecords} from '../extension/studio/job-records-view.js';

const basic=(url='https://example.test/imported')=>({company:'Example, Inc.',role:'Engineer',url,description:'Build products.\nReview designs.',salary:'USD 100000'});
const importRows=(app,rows,mutationId=crypto.randomUUID())=>app.request('DOCK_RECORDS_MUTATE',{action:'import',type:'applications',rows,mutationId});

test('application export off contains only the five CSV fields; full export preserves application documents and dates',async t=>{
  const studio=await resumeRenderer(),snapshot=studio.fixture('rendercv-classic');
  const record={...basic(),status:'interview',createdAt:'2026-11-10T09:15:00Z',updatedAt:'2026-11-12T10:00:00Z',notes:'My note',candidateName:'Jordan Taylor',conversationUrl:'https://chatgpt.com/c/abc',
    resume:{cvJsonRaw:JSON.stringify(snapshot.resume),snapshot,documentTemplate:snapshot.documentTemplate,version:1},coverLetterRaw:'My letter.',coverLetterEnabled:true,events:[{label:'Interview scheduled',at:'2026-11-12T10:00:00Z'}]};
  const original=structuredClone(record),page=new Window();t.after(()=>page.happyDOM.abort());let blob;const files=[];
  const urlApi={createObjectURL:value=>{blob=value;return'blob:export';},revokeObjectURL(){}};page.HTMLAnchorElement.prototype.click=function(){files.push(this.download);};
  downloadRecordsCsv([record],{type:'applications',document:page.document,urlApi});assert.match(files[0],/^applications-.*\.csv$/);assert.deepEqual(parseApplicationImport(await blob.text()),[basic()]);
  assert.doesNotMatch(await blob.text(),/created_at|interview|My letter/);
  downloadRecordsCsv([record],{type:'applications',includeApplicationData:true,document:page.document,urlApi});assert.match(files[1],/\.json$/);
  const exported=JSON.parse(await blob.text());assert.equal(exported.type,APPLICATION_TRANSFER_TYPE);assert.equal(exported.applications[0].created_at,'2026-11-10T09:15:00.000Z');
  assert.deepEqual(exported.applications[0].resume,record.resume);assert.equal(exported.applications[0].coverLetterRaw,'My letter.');assert.deepEqual(record,original);
});

test('full JSON import round-trips the frozen CV snapshot, status, history, dates and optional cover letter without changing profile or Studio',async t=>{
  const studio=await resumeRenderer(),snapshot=studio.fixture('rendercv-classic'),app=await dockFixture(t),before=structuredClone(app.draft),profile=await app.deps.profiles.bootstrap();
  const record={...basic(),status:'interview',createdAt:'2026-10-01T13:00:00Z',updatedAt:'2026-11-01T14:00:00Z',notes:'Keep this note',conversationUrl:'https://chat.deepseek.com/a/chat/saved',
    resume:{cvJsonRaw:JSON.stringify(snapshot.resume),snapshot,documentTemplate:snapshot.documentTemplate,version:2,savedAt:'2026-09-30T13:00:00Z'},coverLetterRaw:'A saved cover letter.',coverLetterEnabled:true,events:[{label:'Interview scheduled',at:'2026-11-01T14:00:00Z'}]};
  const rows=parseApplicationImport(applicationsJson([record])),result=await importRows(app,rows),saved=result.applications.find(r=>r.url===record.url);
  assert.equal(result.importReport.imported,1);assert.equal(saved.status,'interview');assert.equal(saved.createdAt,'2026-10-01T13:00:00.000Z');assert.equal(saved.updatedAt,'2026-11-01T14:00:00.000Z');
  assert.deepEqual(saved.resume,record.resume);assert.equal(saved.coverLetterRaw,record.coverLetterRaw);assert.equal(saved.coverLetterEnabled,true);assert.deepEqual(saved.events,[{label:'Interview scheduled',at:'2026-11-01T14:00:00.000Z'}]);
  assert.equal(saved.notes,record.notes);assert.equal(saved.conversationUrl,record.conversationUrl);assert.deepEqual(app.draft,before);assert.deepEqual(await app.deps.profiles.bootstrap(),profile);
  app.restart();const repeated=await importRows(app,rows);assert.equal(repeated.importReport.skipped,1);assert.equal(repeated.importReport.imported,0);assert.deepEqual(repeated.applications,result.applications);
});

test('basic application import defaults to Applied and created_at now, skips duplicates across applications and queue, and safely retries',async t=>{
  const app=await dockFixture(t),queued=await app.create('queued'),mutationId=crypto.randomUUID();
  const rows=[basic('https://example.test/existing?utm_source=file'),basic(queued.url),basic(),basic('https://example.test/imported#details'),basic('javascript:alert(1)'),null];
  const result=await importRows(app,rows,mutationId);assert.deepEqual({...result.importReport,errors:[]},{imported:1,skipped:3,failed:2,errors:[]});
  const saved=result.applications.find(row=>row.url===basic().url);assert.equal(saved.status,'applied');assert.equal(saved.createdAt,app.deps.now());assert.equal(saved.resume,null);assert.equal(saved.coverLetterRaw,'');assert.equal(result.jobs.length,1);
  app.restart();assert.deepEqual((await importRows(app,rows,mutationId)).importReport,result.importReport);assert.equal((await app.request('DOCK_RECORDS_STATE')).applications.length,2);
  const stored=(await app.storage.get('dock-job-records:v1'))['dock-job-records:v1'];assert.match(stored.receipts[mutationId].signature,/^applications:sha256:[a-f0-9]{64}$/);
});

test('a receipt storage failure cannot erase imported documents or create duplicate applications on retry',async t=>{
  const app=await dockFixture(t),set=app.storage.set.bind(app.storage);let fail=true;
  app.storage.set=async patch=>{if(fail&&patch['dock-job-records:v1']){fail=false;throw Error('Storage unavailable');}return set(patch);};
  const rows=parseApplicationImport(applicationsJson([{...basic(),status:'offer',createdAt:'2026-11-01T00:00:00Z',coverLetterRaw:'Saved letter.',coverLetterEnabled:true}]));
  await assert.rejects(()=>importRows(app,rows),/Storage unavailable/);app.restart();const result=await importRows(app,rows);assert.equal(result.importReport.skipped,1);assert.equal(result.applications.length,2);assert.equal(result.applications.find(row=>row.status==='offer').coverLetterRaw,'Saved letter.');
});

test('invalid full rows are reported without changing good rows or existing applications',async t=>{
  const app=await dockFixture(t),original=await app.request('DOCK_RECORDS_STATE');
  const rows=[{...basic('https://example.test/status'),fullApplication:true,status:'not-real'},
    {...basic('https://example.test/date'),fullApplication:true,created_at:'invalid'},
    {...basic('https://example.test/resume'),fullApplication:true,resume:{cvJsonRaw:'bad'}},
    {...basic('https://example.test/conversation'),fullApplication:true,conversationUrl:'javascript:alert(1)'},basic()];
  const result=await importRows(app,rows);assert.equal(result.importReport.failed,4);assert.equal(result.importReport.imported,1);assert.equal(result.importReport.errors.length,4);assert.deepEqual(result.applications.find(row=>row.id===original.applications[0].id),original.applications[0]);
  for(const source of ['{bad','{}','[]',JSON.stringify({type:APPLICATION_TRANSFER_TYPE,schemaVersion:2,applications:[basic()]})])assert.throws(()=>parseApplicationImport(source));
});

test('full imports preserve applications without a URL and independent cover letters, and skip a re-import',async t=>{
  const app=await dockFixture(t),record={...basic(),url:'',status:'offer',createdAt:'2026-11-01T00:00:00Z',coverLetterRaw:'Letter without a resume.',coverLetterEnabled:true};
  const rows=parseApplicationImport(applicationsJson([record]));const result=await importRows(app,rows);assert.equal(result.importReport.imported,1);const saved=result.applications.find(r=>r.status==='offer');assert.equal(saved.url,null);assert.equal(saved.resume,null);assert.equal(saved.coverLetterRaw,record.coverLetterRaw);
  assert.equal((await importRows(app,rows)).importReport.skipped,1);
});

test('Applications import dialog accepts full JSON and keeps completion counts visible',async t=>{
  const page=new Window();t.after(()=>page.happyDOM.abort());let message;
  const browser={runtime:{sendMessage:async value=>{message=value;return{ok:true,result:{applications:[],jobs:[],importReport:{imported:1,skipped:2,failed:0,errors:[]}}};}}};
  const dialog=openQueueImport(page.document.body,{type:'applications',browser}),file=dialog.querySelector('input[type=file]');
  Object.defineProperty(file,'files',{value:[new page.File([applicationsJson([{...basic(),status:'applied',createdAt:new Date().toISOString()}])],'applications.json')]});
  file.dispatchEvent(new page.Event('change'));await delay(10);dialog.querySelector('footer button:last-child').click();await delay(10);
  assert.equal(message.payload.type,'applications');assert.equal(message.payload.rows[0].fullApplication,true);assert.equal(dialog.open,true);assert.match(dialog.querySelector('[role=status]').textContent,/Imported 1 applications. Skipped 2 duplicates/);assert.equal(dialog.querySelector('footer button').textContent,'Done');
});

test('dock Applications Manage exposes Import and Export while preserving queue actions',async t=>{
  const page=new Window(),app=await dockFixture(t);t.after(()=>page.happyDOM.abort());
  const browser={...app.browser,runtime:{...app.browser.runtime,sendMessage:async message=>({ok:true,result:await app.request(message.operation,message.payload)})}};
  const view=mountJobRecords(page.document.body,{browser});t.after(()=>view.close());await view.show('applications');
  assert.equal(view.root.querySelector('[data-command=import-records]').hidden,false);assert.equal(view.root.querySelector('[data-command=export-records]').hidden,false);
  view.root.querySelector('[data-command=import-records]').click();await delay(0);assert.match(page.document.querySelector('.queue-import-dialog[open] h2').textContent,/Import applications/);page.document.querySelector('.queue-import-dialog[open]').close();
  await view.show('queue');view.root.querySelector('[data-command=import-records]').click();await delay(0);assert.match(page.document.querySelector('.queue-import-dialog[open] h2').textContent,/Import queue jobs/);
});
