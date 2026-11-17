import assert from 'node:assert/strict';
import test from 'node:test';
import {deletionRecords,applicationCreatedAt} from '../extension/studio/record-dates.js';

const now=Date.parse('2026-11-12T18:00:00Z'),hours=3600000;
const rows=[1,24,25,168,169,720,721,2160,2161].map(age=>({id:String(age),type:'applications',company:'Company',role:'Engineer',createdAt:new Date(now-age*hours).toISOString(),updatedAt:new Date(now+age*hours).toISOString()}));
test('deletion periods filter and sort creation time instead of last update, including exact boundaries',()=>{
  assert.deepEqual(deletionRecords(rows,{},now).map(row=>row.id),['1','24']);
  assert.deepEqual(deletionRecords(rows,{period:'7days'},now).map(row=>row.id),['1','24','25','168']);
  assert.deepEqual(deletionRecords(rows,{period:'24hours'},now).map(row=>row.id),['1','24']);
  assert.deepEqual(deletionRecords(rows,{period:'90days',type:'queue'},now).map(row=>row.id),['1','24','25','168','169','720','721','2160']);
  assert.equal(applicationCreatedAt({date:'November 1, 2026 18:00:00 GMT+0000'}),'2026-11-01T18:00:00.000Z');
});
test('custom deletion dates include the whole local end day and search both company and role',()=>{
  const make=(id,date,company,role)=>({id,createdAt:new Date(date).toISOString(),company,role});
  const records=[make('start','2026-11-01T00:00:00','Cedar Health','Product Designer'),make('end','2026-11-02T23:59:59','Cedar Health','Product Designer'),make('outside','2026-11-03T00:00:00','Cedar Health','Product Designer'),make('other','2026-11-02T12:00:00','Orbit','Engineer')];
  assert.deepEqual(deletionRecords(records,{period:'custom',from:'2026-11-01',to:'2026-11-02',query:'cedar designer'},now).map(row=>row.id),['end','start']);
});
