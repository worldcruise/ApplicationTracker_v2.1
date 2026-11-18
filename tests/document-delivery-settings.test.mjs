import test from 'node:test';
import assert from 'node:assert/strict';
import {setTimeout as delay} from 'node:timers/promises';
import {createDocumentDownloads} from '../extension/ai-apply/src/document-downloads.mjs';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

function fixture(t,settings={autoDownload:true,autoPreview:false}){
  const run={id:'run',phase:'complete',documentContractVersion:4,jobId:'job',job:{input:{job:{company:'Employer'}}},result:{resume:{}},documentSettings:{selectedModules:['resume'],autoDownload:true,autoPreview:true,formats:['pdf']}},files=new Map(),downloads=[],previews=[],exports=[];
  const browser={runtime:{getURL:path=>'chrome-extension://test/'+path,sendMessage:async()=>({})},storage:{local:memoryStorage({documentSettings:{...settings,selectedModules:[]}})},downloads:{onChanged:event(),download:async value=>{downloads.push(value);return downloads.length;},search:async()=>[{state:state.completion}]},tabs:{query:async()=>[],create:async value=>previews.push(value)}};
  const state={completion:'complete',saves:0,export:async value=>{exports.push(value);return {files:[{kind:'resume',format:'pdf',filename:'Candidate.pdf',mime:'application/pdf',bytes:new TextEncoder().encode('%PDF-1.7 test')}],errors:[]};},write:async()=>null};
  const delivery=createDocumentDownloads({browser,store:{get:async()=>structuredClone(run),summaries:async()=>[structuredClone(run)],update:async(id,edit)=>{Object.assign(run,edit(structuredClone(run)));return {value:structuredClone(run)};}},jobs:{},files:{put:async value=>files.set(value.key,value),get:async key=>files.get(key)},saveGenerated:async()=>{state.saves++;},exportFiles:value=>state.export(value),writeToDirectory:(...args)=>state.write(...args)});
  t.after(()=>delivery.dispose());return {run,browser,state,downloads,previews,exports,files,delivery};
}

test('automatic delivery uses current preview preference while preserving the request selection',async t=>{
  const f=fixture(t);await f.delivery.start('run');assert.equal(f.downloads.length,1);assert.equal(f.previews.length,0);assert.equal(f.run.downloads.state,'complete');assert.deepEqual(f.exports[0].documentSettings.selectedModules,['resume']);
});

test('disabling automatic downloads affects runs that were already generated',async t=>{
  const f=fixture(t,{autoDownload:false,autoPreview:true});await f.delivery.start('run');assert.equal(f.run.downloads.state,'skipped');assert.equal(f.exports.length,0);assert.equal(f.downloads.length,0);assert.equal(f.previews.length,0);assert.equal(f.state.saves,1);
});

test('disabling previews while a Chrome download is pending prevents its completion preview',async t=>{
  const f=fixture(t,{autoDownload:true,autoPreview:true});f.state.completion='in_progress';await f.delivery.start('run');assert.equal(f.run.downloads.state,'downloading');
  await f.browser.storage.local.set({documentSettings:{autoDownload:true,autoPreview:false}});f.state.completion='complete';f.browser.downloads.onChanged.emit({id:1,state:{current:'complete'}});
  for(let i=0;i<100&&f.run.downloads.state!=='complete';i++)await delay(2);
  assert.equal(f.run.downloads.state,'complete');assert.equal(f.previews.length,0);assert.equal(f.downloads.length,1);
});

test('folder exports respect a preview preference changed while writing the file',async t=>{
  const f=fixture(t,{autoDownload:true,autoPreview:true});f.state.write=async()=>{await f.browser.storage.local.set({documentSettings:{autoDownload:true,autoPreview:false}});return {filename:'Candidate.pdf',relativePath:'Employer/Candidate.pdf'};};
  await f.delivery.start('run');assert.equal(f.run.downloads.state,'complete');assert.equal(f.files.size,1);assert.equal(f.downloads.length,0);assert.equal(f.previews.length,0);
});

test('turning off automatic downloads during PDF preparation stops file delivery',async t=>{
  const f=fixture(t,{autoDownload:true,autoPreview:true}),prepare=f.state.export;f.state.export=async run=>{await f.browser.storage.local.set({documentSettings:{autoDownload:false,autoPreview:false}});return prepare(run);};
  await f.delivery.start('run');assert.equal(f.run.downloads.state,'skipped');assert.equal(f.downloads.length,0);assert.equal(f.files.size,0);assert.equal(f.previews.length,0);assert.equal(f.state.saves,1);
});
