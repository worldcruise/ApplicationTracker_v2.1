import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {dockFixture,event} from './helpers/dock-records-fixture.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {createStudio} from '../extension/ai-apply/src/studio.mjs';
import {configureApplyTools} from '../extension/studio/apply-tools-service.js';

const until=async fn=>{for(let i=0;i<150;i++){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,5));}throw Error('Manual application did not settle.');};

async function fixture(t,{resume=true}={}){
 const app=await dockFixture(t),win=new Window({url:'chrome-extension://dock-test/ai-apply/index.html?windowId=41'});win.document.write(await readFile('extension/ai-apply/index.html','utf8'));
 let record=await app.create('manual-transfer');if(resume)record=await app.ready(record);
 const saved=await app.mutate('update',record,{...record,cvJsonRaw:record.resume?.cvJsonRaw||'',coverLetterRaw:'My submitted cover letter.',coverLetterEnabled:true,salary:'USD 120000 / year',notes:'Keep these notes.'});record=saved.jobs.find(job=>job.id===record.id);
 const previous={document:globalThis.document,window:globalThis.window,location:globalThis.location,chrome:globalThis.chrome},messages=event(),calls=[];
 const sender={id:'dock-test',url:win.location.href},browser={...app.browser,runtime:{...app.browser.runtime,onMessage:messages},tabs:{...app.browser.tabs,onUpdated:event(),onRemoved:event()}};
 browser.windows.get=async()=>({id:41,type:'normal'});
 browser.runtime.sendMessage=message=>new Promise(resolve=>messages.emit(message,sender,resolve));
 configureApplyTools({browser,isUI:source=>source.id===sender.id&&source.url===sender.url,authorizeUI:async()=>{},store:async()=>app.request('AI_APPLY_READ'),dispatch:async(operation,payload)=>{calls.push({operation,payload});return app.request(operation,payload);}});
 Object.assign(globalThis,{document:win.document,window:win,location:win.location,chrome:browser});setQueueBackend((action,payload)=>app.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));
 const queue=createJobQueue({channel:null});
 t.after(()=>{win.dispatchEvent(new win.Event('pagehide'));queue.dispose();win.happyDOM.abort();Object.assign(globalThis,previous);setQueueBackend(undefined);});
 const generations={ready:Promise.resolve(),forJob:()=>null,captures:()=>[],subscribe:()=>()=>{}};
 const studio=createStudio({queue,generations,openDialog:id=>win.document.getElementById(id).showModal(),showStudio:()=>{},showChat:()=>{},moveTab:()=>{},openApplication:()=>{}});await studio.ready;
 const details=win.document.querySelector(`[data-action="details"][data-request="${record.id}"]`);assert.ok(details);details.click();
 return {...app,win,queue,studio,record,calls,browser,sender,messages};
}

for(const resume of [true,false])test(`Details places Mark as applied below Edit and transfers saved ${resume?'resume and letter':'letter without a resume'} exactly once`,async t=>{
 const app=await fixture(t,{resume}),doc=app.win.document,button=doc.querySelector('#request-mark-applied');assert.equal(doc.querySelector('#request-edit').nextElementSibling,button);assert.equal(button.disabled,false);assert.equal(doc.querySelector('#request-dialog').open,true);
 const original=structuredClone(app.record.resume);button.click();button.click();await until(async()=>(await app.request('DOCK_RECORDS_STATE')).jobs.length===0);await until(()=>!doc.querySelector('#request-dialog').open&&app.queue.snapshot().requests.length===0);
 const state=await app.request('DOCK_RECORDS_STATE'),application=state.applications.find(item=>item.company===app.record.company&&item.role===app.record.role);assert.ok(application);assert.equal(application.status,'applied');assert.equal(application.description,app.record.description);assert.equal(application.url,app.record.url);assert.equal(application.salary,app.record.salary);assert.equal(application.notes,app.record.notes);assert.equal(application.coverLetterRaw,'My submitted cover letter.');assert.equal(application.coverLetterEnabled,true);assert.deepEqual(application.resume,original);assert.equal(state.applications.length,2);assert.equal(app.tabs.length,0);
 assert.equal(app.calls.length,1);assert.deepEqual({operation:app.calls[0].operation,action:app.calls[0].payload.action,confirmed:app.calls[0].payload.submissionConfirmed},{operation:'DOCK_RECORDS_MUTATE',action:'apply',confirmed:true});assert.match(doc.querySelector('#queue-notice-message').textContent,/moved to Applications/);
 const result=await app.browser.runtime.sendMessage({type:'ai-apply.tools',payload:{action:'job.mark-applied',windowId:41,jobId:app.record.id,expectedRevision:app.record.revision,mutationId:app.calls[0].payload.mutationId}});assert.equal(result.ok,true);assert.equal(result.value.selectedId,application.id);assert.equal((await app.request('DOCK_RECORDS_STATE')).applications.length,2);
});

test('manual recording rejects stale details and shows a save failure in the open details dialog',async t=>{
 const app=await fixture(t),doc=app.win.document;
 const stale=await app.browser.runtime.sendMessage({type:'ai-apply.tools',payload:{action:'job.mark-applied',windowId:41,jobId:app.record.id,expectedRevision:app.record.revision-1,mutationId:crypto.randomUUID()}});assert.equal(stale.ok,false);assert.match(stale.error,/changed/);assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs.length,1);
 app.browser.runtime.sendMessage=async()=>({ok:false,error:'The application could not be saved. Try again.'});doc.querySelector('#request-mark-applied').click();await until(()=>doc.querySelector('#request-application-status').dataset.state==='error');await until(()=>!doc.querySelector('#request-mark-applied').disabled);assert.equal(doc.querySelector('#request-dialog').open,true);assert.match(doc.querySelector('#request-application-status').textContent,/could not be saved/);assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs.length,1);
});
