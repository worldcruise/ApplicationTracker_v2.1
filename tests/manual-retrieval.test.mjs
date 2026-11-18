import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createManualRetrieval} from '../extension/ai-apply/src/manual-retrieval.mjs';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {createQueueStore,setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {dockFixture,event,memoryStorage} from './helpers/dock-records-fixture.mjs';
import {createGenerationStore} from '../extension/ai-apply/src/generation-store.mjs';
import {IDBFactory} from 'fake-indexeddb';
import {createDocumentDownloads} from '../extension/ai-apply/src/document-downloads.mjs';
import {exportDocuments} from '../extension/ai-apply/src/document-export.mjs';

const resume={company:'Employer',title:'Engineer',summary:'Manually retrieved resume.',skills:[],experience:[],education:[]};
const rawJob={company:'Employer',role:'Engineer',description:'Build reliable systems.',url:'https://employer.test/manual'};
const output={job:{company:'Employer',title:'Engineer',description:rawJob.description,applyUrl:rawJob.url,salary:{min:0,max:0,currency:'USD',period:'year',sourceText:''}},resume,coverLetter:'Manually retrieved letter.'};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('the newest manual result is selected by creation time rather than random run ID order',async()=>{
  const store=createGenerationStore({indexedDB:new IDBFactory()});
  await store.change(state=>{state.runs.push({id:'z-original',createdAt:1,phase:'invalid'},{id:'a-manual',createdAt:2,phase:'complete'});});
  assert.equal((await store.read()).runs.at(-1).id,'a-manual');assert.equal((await store.summaries()).at(-1).id,'a-manual');
});

async function server(t,selectedModules=['job','resume','coverLetter'],options={}){
  const app=await dockFixture(t);setQueueBackend((action,payload)=>app.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
  const queue=createJobQueue({channel:null}),jobs=createQueueStore();t.after(()=>queue.dispose());await queue.ready;
  const profile=queue.snapshot().profiles[0],id=await queue.add({candidateId:profile.id,profile:profile.data,tailor:true,job:rawJob});
  const job=await jobs.getJob(id),run={id:'source',jobId:id,phase:'invalid',provider:'chatgpt',raw:'{"resume":',job,inputSnapshot:job.input,documentContractVersion:DOCUMENT_CONTRACT_VERSION,documentSettings:{selectedModules},selectedModules};
  const state={runs:[run]},store={read:async()=>structuredClone(state),get:async id=>structuredClone(state.runs.find(run=>run.id===id)),change:async edit=>({value:edit(state),state:structuredClone(state)}),update:async(id,edit)=>{const index=state.runs.findIndex(run=>run.id===id);state.runs[index]=edit(structuredClone(state.runs[index]));return {value:structuredClone(state.runs[index])};}};
  const events=event(),calls=[],browser={runtime:{sendMessage:async()=>({})},storage:{local:memoryStorage({chatProvider:'deepseek'}),session:memoryStorage({})},tabs:{onUpdated:events,onRemoved:events,sendMessage:async(...args)=>calls.push(args),create:()=>{throw Error('Manual retrieval must not open AI');}}};
  let index=0;const service=createGenerationService({browser,store,jobs,uuid:()=> 'manual-'+(++index),...options});t.after(()=>service.dispose());
  const payload=(json,request=job)=>({json:typeof json==='string'?json:JSON.stringify(json),runId:'source',expectedUpdatedAt:request.updatedAt,expectedRevision:request.canonicalRevision,selectedModules:['coverLetter']});
  return {queue,jobs,id,job,run,state,store,browser,calls,service,payload};
}

function deliveryFixture(t,s,{failRender=false}={}){
  const downloads=[],previews=[],cached=new Map(),rendered=[];
  const browser={...s.browser,runtime:{...s.browser.runtime,getURL:path=>'chrome-extension://manual-test/'+path},
    downloads:{onChanged:event(),download:async options=>{downloads.push(options);return downloads.length;},search:async()=>[{state:'complete'}]},
    tabs:{query:async()=>[],create:async options=>previews.push(options)}};
  const delivery=createDocumentDownloads({browser,store:s.store,jobs:s.jobs,
    files:{put:async file=>cached.set(file.key,file),get:async key=>cached.get(key)},
    saveGenerated:async()=>{throw Error('Manual retrieval already saved these documents.');},
    exportFiles:run=>exportDocuments(run,{renderPDF:async(current,kind)=>{
      rendered.push(kind);assert.equal(current.job.documentRunId,current.id);
      if(failRender)throw Error('Studio renderer unavailable');
      return {base64:btoa('%PDF-1.7\n'+kind)};
    }})});t.after(()=>delivery.dispose());
  return {delivery,downloads,previews,rendered};
}

for(const keys of [['job','resume','coverLetter'],['resume'],['coverLetter'],['job']])test(`Save result downloads and previews only selected documents: ${keys.join(', ')}`,async t=>{
  let delivery,finished;
  const s=await server(t,keys,{onComplete:run=>{finished=delivery.start(run);return finished;}});
  Object.assign(s.run.documentSettings,{autoDownload:false,autoPreview:false,formats:['pdf']});
  await s.browser.storage.local.set({documentSettings:{autoDownload:true,autoPreview:true,formats:['pdf']}});
  const result=deliveryFixture(t,s);delivery=result.delivery;
  const saved=await s.service.importResult(s.id,s.payload(Object.fromEntries(keys.map(key=>[key,output[key]]))));
  await flush();await finished;
  const run=s.state.runs.at(-1),expected=keys.filter(key=>key!=='job').map(key=>key==='coverLetter'?'cover-letter':key);
  assert.equal(saved.phase,'complete');assert.equal(run.downloads.state,'complete');assert.ok(run.downloads.savedAt);
  assert.deepEqual(result.rendered,expected);assert.equal(result.downloads.length,expected.length);assert.equal(result.previews.length,expected.length);
  assert.ok(result.downloads.every(file=>file.filename.endsWith('.pdf')&&file.saveAs===false));
  assert.ok(result.downloads.every(file=>file.filename.startsWith('Employer/')&&file.conflictAction==='overwrite'));
  assert.ok(result.previews.every(tab=>tab.url.includes('/preview.html?aiFile=')&&tab.active));
  const revision=(await s.jobs.getJob(s.id)).canonicalRevision;
  await delivery.start(saved.id);await delivery.reconnect();
  assert.equal(result.downloads.length,expected.length,'Repeated delivery must not download twice');
  assert.equal((await s.jobs.getJob(s.id)).canonicalRevision,revision,'Delivery must not save the result twice');
});

test('Manual retrieval resumes exports after worker restart and keeps saved results if PDF rendering fails',async t=>{
  const s=await server(t,['resume']);
  const saved=await s.service.importResult(s.id,s.payload({resume}));
  assert.equal(s.state.runs.at(-1).downloads.state,'pending');
  const result=deliveryFixture(t,s,{failRender:true});await result.delivery.reconnect();
  const run=s.state.runs.at(-1);assert.equal(run.downloads.state,'failed');
  assert.match(run.downloads.errors[0].message,/Studio renderer unavailable/);
  assert.equal((await s.jobs.getJob(s.id)).resume.summary,resume.summary);assert.equal(run.phase,'complete');
  assert.equal(result.downloads.length,0);assert.equal(result.previews.length,0);
});

test('Copy-only Manual retrieval uses the current export formats without opening an AI tab',async t=>{
  let delivery,finished;
  const s=await server(t,['resume'],{onComplete:run=>{finished=delivery.start(run);return finished;}});
  await s.browser.storage.local.set({documentSettings:{autoDownload:true,autoPreview:false,formats:['json']}});
  const result=deliveryFixture(t,s);delivery=result.delivery;
  await s.service.importResult(s.id,{...s.payload({resume}),runId:undefined,selectedModules:['resume']});
  await flush();await finished;
  assert.equal(result.downloads.length,1);assert.ok(result.downloads[0].filename.endsWith('.json'));
  assert.deepEqual(JSON.parse(atob(result.downloads[0].url.split(',')[1])),{resume});
  assert.equal(result.previews.length,0);
  assert.equal(s.calls.length,0);
});

test('Manual retrieval saves the result without exporting when automatic downloads are off',async t=>{
  let delivery,finished;const s=await server(t,['resume'],{onComplete:run=>{finished=delivery.start(run);return finished;}});
  Object.assign(s.run.documentSettings,{autoDownload:true,autoPreview:true});
  await s.browser.storage.local.set({documentSettings:{autoDownload:false,autoPreview:false,formats:['pdf']}});
  const result=deliveryFixture(t,s);delivery=result.delivery;await s.service.importResult(s.id,s.payload({resume}));await flush();await finished;
  const run=s.state.runs.at(-1);assert.equal(run.documentSettings.autoDownload,false);assert.equal(run.documentSettings.autoPreview,false);assert.equal(run.downloads.state,'skipped');
  assert.deepEqual(result.rendered,[]);assert.deepEqual(result.downloads,[]);assert.deepEqual(result.previews,[]);assert.equal((await s.jobs.getJob(s.id)).resume.summary,resume.summary);
});

for(let mask=1;mask<8;mask++)test(`manual retrieval ${mask} saves exactly the request's selected sections`,async t=>{
  const keys=['job','resume','coverLetter'].filter((_,index)=>mask&(1<<index)),s=await server(t,keys);
  const value=Object.fromEntries(keys.map(key=>[key,output[key]]));
  const saved=await s.service.importResult(s.id,s.payload(value));
  const job=await s.jobs.getJob(s.id);assert.equal(saved.phase,'complete');assert.equal(saved.manualResult,true);assert.deepEqual(saved.selectedModules,keys);
  assert.equal(job.resume?.summary??null,keys.includes('resume')?resume.summary:null);
  assert.equal(job.coverLetter||'',keys.includes('coverLetter')?output.coverLetter:'');
  assert.deepEqual(s.state.runs.at(-1).result.document,value);assert.equal(s.calls.length,0);
});

test('manual retrieval preserves unselected documents and rejects invalid JSON before writing or stopping',async t=>{
  const s=await server(t,['job']);await s.queue.saveDocuments(s.id,{resume:JSON.stringify(resume),coverLetter:'Existing saved letter.',coverLetterEnabled:true,expectedUpdatedAt:s.job.updatedAt});
  const current=await s.jobs.getJob(s.id);s.run.phase='generating';s.run.tabId=7;
  await assert.rejects(()=>s.service.importResult(s.id,s.payload('{"job":',current)),/JSON is incomplete/);
  assert.equal(s.calls.length,0);assert.equal(s.state.runs.length,1);
  await s.service.importResult(s.id,s.payload({job:output.job},current));
  const saved=await s.jobs.getJob(s.id);assert.equal(saved.resume.summary,resume.summary);assert.equal(saved.coverLetter,'Existing saved letter.');assert.equal(s.calls[0][1].type,'generation.stop');
});

test('manual retrieval rejects stale or cross-job input without overwriting saved documents',async t=>{
  const s=await server(t);await assert.rejects(()=>s.service.importResult(s.id,{...s.payload(output),expectedUpdatedAt:0}),/changed in another view/);
  s.run.jobId='another-job';await assert.rejects(()=>s.service.importResult(s.id,s.payload(output)),/another job/);
  assert.equal((await s.jobs.getJob(s.id)).resume,null);
});

test('manual retrieval works after Copy without starting an AI generation',async t=>{
  const s=await server(t);const saved=await s.service.importResult(s.id,{...s.payload({resume}),runId:undefined,selectedModules:['resume']});
  assert.equal(saved.provider,'deepseek');assert.equal(saved.sendIntentAt,null);assert.equal((await s.jobs.getJob(s.id)).resume.summary,resume.summary);
});

async function popup(t,saveResult){
  const win=new Window(),previous=globalThis.document;t.after(()=>{globalThis.document=previous;win.happyDOM.abort();});
  win.document.body.innerHTML=(await readFile('extension/ai-apply/index.html','utf8')).match(/<dialog id="manual-retrieval-dialog"[\s\S]*?<\/dialog>/)[0];globalThis.document=win.document;
  const dialog=win.document.querySelector('dialog');dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new win.Event('close'));};
  const request={id:'job',updatedAt:1,input:{profile:{name:'Candidate',role:'Engineer',summary:'Builds systems.',skills:[],experience:[],education:[]},job:rawJob}};
  let saved=0;const view=createManualRetrieval({getRequest:()=>request,saveResult,openDialog:()=>dialog.open=true,onSaved:()=>saved++});
  view.open('job',{run:{id:'source',jobId:'job',raw:'{"resume":',inputSnapshot:request.input,selectedModules:['resume'],documentContractVersion:DOCUMENT_CONTRACT_VERSION}});
  const input=win.document.querySelector('textarea'),button=win.document.querySelector('[type=submit]'),status=win.document.querySelector('[role=status]');
  return {win,dialog,input,button,status,paste(text){input.value=text;input.dispatchEvent(new win.Event('input'));},submit(){win.document.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));},get saved(){return saved;}};
}

test('the separate manual retrieval popup edits the captured JSON and saves one complete object',async t=>{
  const writes=[],ui=await popup(t,async(id,payload)=>writes.push({id,payload}));assert.equal(ui.win.document.querySelectorAll('textarea').length,1);assert.equal(ui.input.value,'{"resume":');assert.equal(ui.button.disabled,true);
  ui.paste(JSON.stringify({resume}));assert.equal(ui.button.disabled,false);ui.submit();await flush();
  assert.equal(writes.length,1);assert.deepEqual(JSON.parse(writes[0].payload.json),{resume});assert.deepEqual(writes[0].payload.selectedModules,['resume']);assert.equal(ui.saved,1);assert.equal(ui.dialog.open,false);
});

test('manual retrieval keeps edited JSON visible when saving fails',async t=>{
  const ui=await popup(t,async()=>{throw Error('This job changed in another view.');});const raw=JSON.stringify({resume});ui.paste(raw);ui.submit();await flush();
  assert.equal(ui.input.value,raw);assert.equal(ui.dialog.open,true);assert.match(ui.status.textContent,/changed in another view/);assert.equal(ui.button.disabled,false);
});
