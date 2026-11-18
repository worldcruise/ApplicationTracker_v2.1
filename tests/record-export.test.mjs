import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {recordsCsv,recordApplicationLink} from '../extension/studio/record-export.js';
import {parseQueueCsv} from '../extension/studio/queue-import.js';
import {openRecordExport} from '../extension/studio/record-delete-dialog.js';

test('CSV exports exactly five fields, preserves multiline JD and escapes quotes and spreadsheet formulas',()=>{
  const records=[{company:'Acme, Inc.',role:'Engineer "II"',description:'Build products.\nWork with a team.',salary:'$100,000',url:'https://example.test/job?x=1&y=2',notes:'Private notes',resume:{private:true},status:'interview',createdAt:'2026-11-12T10:00:00Z'},
    {company:'=HYPERLINK("https://example.test")',role:'@SUM(1,2)',description:'Unicode: \u4f60\u597d',salary:null,url:''}];
  const original=structuredClone(records),csv=recordsCsv(records);
  assert.equal(csv,'\uFEFF"Company","Role","Application link","Salary","JD"\r\n"Acme, Inc.","Engineer ""II""","https://example.test/job?x=1&y=2","$100,000","Build products.\nWork with a team."\r\n"\'=HYPERLINK(""https://example.test"")","\'@SUM(1,2)","","","Unicode: \u4f60\u597d"\r\n');
  assert.deepEqual(records,original);assert.ok(!csv.includes('Private notes'));assert.ok(!csv.includes('interview'));
});

test('CSV keeps links visible before multiline JD and recovers supported legacy link fields',()=>{
  const base={company:'Company',role:'Engineer',description:'About the role\n'+('Job description details.\n'.repeat(50)),salary:'$100,000'};
  const records=[{...base,url:'https://example.test/current?a=1&b=2'},
    {...base,url:'',jobLink:'https://example.test/legacy'},
    {...base,url:'about:blank',applicationLink:'https://example.test/application'},
    {...base,sourceUrl:'https://example.test/captured'}];
  const csv=recordsCsv(records),parsed=parseQueueCsv(csv);
  assert.match(csv.split('\r\n')[1],/"Company","Engineer","https:\/\/example.test\/current\?a=1&b=2","\$100,000","About the role/);
  assert.deepEqual(parsed.map(row=>row.url),records.map(recordApplicationLink));assert.ok(parsed.every(row=>row.description===base.description));
  assert.equal(recordApplicationLink({...base,url:'javascript:alert(1)',jobLink:'https://example.test/safe'}),'https://example.test/safe');
  assert.equal(recordApplicationLink({...base,companyLink:'https://company.test'}),'');
});

test('export picker supports Shift-click range selection, clears hidden selections and never mutates records',async t=>{
  const page=new Window(),requests=[],exports=[],now=Date.now();t.after(()=>page.happyDOM.abort());
  const records=[.05,.1,.8,8,20].map((days,index)=>({id:String(index),company:`Company ${index}`,role:'Engineer',description:`Job description ${index}`,salary:'$100,000',url:`https://example.test/${index}`,createdAt:new Date(now-days*86400000).toISOString(),updatedAt:new Date(now).toISOString(),status:'Queued',revision:1}));
  const original=structuredClone(records),browser={runtime:{sendMessage:async message=>{requests.push(message);return{ok:true,result:{applications:[],jobs:records}};}}};
  const dialog=await openRecordExport(page.document.body,{browser,onExport:async(rows,options)=>exports.push({rows,options})}),q=selector=>dialog.querySelector(selector);
  assert.equal(q('select').value,'24hours');assert.equal(dialog.querySelectorAll('tbody tr').length,3);assert.equal(q('.record-export-confirm').disabled,true);
  assert.deepEqual([...q('select').options].map(option=>option.value),['24hours','7days','90days','custom']);
  assert.equal(q('[aria-label="Created from"]').disabled,true);assert.equal(q('[aria-label="Created to"]').disabled,true);
  const checks=[...dialog.querySelectorAll('tbody input')];checks[0].click();checks[2].dispatchEvent(new page.MouseEvent('click',{bubbles:true,shiftKey:true}));
  assert.equal(dialog.querySelectorAll('tbody input:checked').length,3);
  q('select').value='custom';q('select').dispatchEvent(new page.Event('change'));assert.equal(q('[aria-label="Created from"]').disabled,false);assert.equal(q('[aria-label="Created to"]').disabled,false);
  q('select').value='90days';q('select').dispatchEvent(new page.Event('change'));assert.equal(q('[aria-label="Created from"]').disabled,true);assert.equal(q('.record-export-confirm').disabled,true);assert.equal(dialog.querySelectorAll('tbody tr').length,5);
  q('[aria-label="Select all shown records"]').click();assert.equal(dialog.querySelectorAll('tbody input:checked').length,5);
  q('input[type=search]').value='company 1';q('input[type=search]').dispatchEvent(new page.Event('input'));assert.equal(q('.record-export-confirm').disabled,true);assert.equal(dialog.querySelectorAll('tbody tr').length,1);
  q('tbody input').click();q('.record-export-confirm').click();await delay(10);
  assert.equal(exports.length,1);assert.deepEqual(exports[0].rows.map(row=>row.id),['1']);assert.equal(exports[0].options.type,'queue');
  assert.equal(dialog.isConnected,false);assert.deepEqual(records,original);assert.deepEqual(requests.map(request=>request.operation),['DOCK_RECORDS_STATE']);
});

test('application export offers an unchecked full-data option and retains the date and range picker',async t=>{
  const page=new Window();t.after(()=>page.happyDOM.abort());let exported;
  const record={id:'application',company:'Company',role:'Engineer',createdAt:new Date().toISOString(),status:'interview'};
  const browser={runtime:{sendMessage:async()=>({ok:true,result:{applications:[record],jobs:[]}})}};
  const dialog=await openRecordExport(page.document.body,{type:'applications',browser,onExport:(rows,options)=>{exported={rows,options};}});
  assert.equal(dialog.querySelector('[aria-label="Export the application data"]').checked,false);assert.equal(dialog.querySelector('select').value,'24hours');
  dialog.querySelector('[aria-label="Export the application data"]').click();dialog.querySelector('tbody input').click();dialog.querySelector('.record-export-confirm').click();await delay(0);
  assert.equal(exported.options.includeApplicationData,true);assert.equal(exported.options.type,'applications');assert.deepEqual(exported.rows,[record]);assert.equal(dialog.isConnected,false);
});

test('failed export retains the selection and allows retry without deleting anything',async t=>{
  const page=new Window();t.after(()=>page.happyDOM.abort());let attempts=0;
  const record={id:'queue-job',company:'Company',role:'Engineer',description:'JD',createdAt:new Date().toISOString(),status:'Ready',revision:1};
  const browser={runtime:{sendMessage:async message=>{assert.equal(message.operation,'DOCK_RECORDS_STATE');return{ok:true,result:{jobs:[record],applications:[]}};}}};
  const dialog=await openRecordExport(page.document.body,{type:'queue',browser,onExport:async()=>{if(++attempts===1)throw Error('Download could not start.');}});
  dialog.querySelector('tbody input').click();dialog.querySelector('.record-export-confirm').click();await delay(10);
  assert.equal(dialog.open,true);assert.equal(dialog.querySelector('[role=alert]').textContent,'Download could not start.');assert.equal(dialog.querySelector('tbody input').checked,true);
  assert.equal(dialog.querySelector('.record-export-confirm').disabled,false);dialog.querySelector('.record-export-confirm').click();await delay(10);assert.equal(attempts,2);assert.equal(dialog.isConnected,false);
});
