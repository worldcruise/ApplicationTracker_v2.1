import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {createQueueDocuments} from '../extension/ai-apply/src/queue-documents.mjs';
import {parseManualDocuments,manualDocumentValue} from '../extension/ai-apply/src/manual-documents.mjs';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {createJobQueue} from '../extension/ai-apply/src/job-queue.mjs';
import {setQueueBackend} from '../extension/ai-apply/src/queue-store.mjs';
import {dockFixture,event,memoryStorage} from './helpers/dock-records-fixture.mjs';

const profile={name:'Test Candidate',role:'Engineer',summary:'Builds systems.',skills:[],experience:[],education:[]};
const job={id:'job',updatedAt:1,input:{candidateId:'one',profile,prompt:'OLD RESUME PROMPT',tailor:true,job:{company:'Employer',role:'Engineer',description:'Build systems.',url:'https://employer.test/job'}}};
const resume={company:'Employer',title:'Engineer',summary:'Builds reliable services.',skills:[],experience:[],education:[]};
const document={requestId:'job',job:{company:'Employer',title:'Engineer',description:'Build systems.',applyUrl:job.input.job.url,salary:{value:'',source:'unknown',evidence:'',basis:''}},resume,coverLetter:'I build reliable services.'};
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));

test('card Copy uses current saved prompts without opening chat or starting a generation',async t=>{
  const events=event(),copied=[],browser={runtime:{sendMessage:async()=>({})},storage:{local:memoryStorage({'ai-manual-copy:v1':{manualPrompt:true,manualAnswer:true},'ai-writing-prompts:v1':{jdAnalysis:'CURRENT JD RULE',coverLetter:'CURRENT LETTER'}})},tabs:{onUpdated:events,onRemoved:events}};
  const service=createGenerationService({browser,jobs:{getJob:async()=>job},store:{change:()=>{throw Error('Must not start a run');}},readResumePrompt:async()=> 'CURRENT RESUME PROMPT',clipboard:async(operation,text)=>copied.push({operation,text})});t.after(()=>service.dispose());
  assert.deepEqual(await service.copyPrompt('job'),{copied:true});assert.equal(copied.length,1);assert.equal(copied[0].operation,'write');
  assert.match(copied[0].text,/CURRENT JD RULE\n\nTask 2 \(Resume\)\nCURRENT RESUME PROMPT\n\nTask 3 \(Cover letter\)\nCURRENT LETTER/);
  assert.doesNotMatch(copied[0].text,/"requestId":/);assert.equal(copied[0].text.includes('OLD RESUME PROMPT'),false);
  const failed=createGenerationService({browser,jobs:{getJob:async()=>job},readResumePrompt:async()=> 'PROMPT',clipboard:async()=>{throw Error('Clipboard unavailable');}});t.after(()=>failed.dispose());
  await assert.rejects(()=>failed.copyPrompt('job'),/Clipboard unavailable/);
});

test('one JSON update saves job details and both documents atomically in the shared tracker',async t=>{
  const fixture=await dockFixture(t);setQueueBackend((action,payload)=>fixture.request(action==='read'?'AI_APPLY_READ':'AI_APPLY_COMMIT',payload));t.after(()=>setQueueBackend(undefined));
  const queue=createJobQueue({channel:null});t.after(()=>queue.dispose());await queue.ready;
  const selected=queue.snapshot().profiles[0],quote='USD 100000-120000 per year';
  const id=await queue.add({candidateId:selected.id,profile:selected.data,tailor:true,job:{company:'Employer',role:'Engineer',url:'https://employer.test/job',description:'Build systems. Salary: '+quote}});
  const current=queue.snapshot().requests[0],value=structuredClone(document);value.requestId=id;value.job.company='Employer LLC';value.job.title='Software Engineer';value.job.description=current.input.job.description;value.job.salary={value:quote,source:'listed',evidence:quote,basis:''};value.resume.company='Employer LLC';value.resume.title='Software Engineer';
  const wrong={...value,requestId:'another-job'};
  await assert.rejects(()=>queue.saveDocuments(id,{json:JSON.stringify(wrong),expectedUpdatedAt:current.updatedAt}),/another job/);
  let native=(await fixture.request('DOCK_RECORDS_STATE')).jobs[0];assert.equal(native.resume,null);assert.equal(native.company,'Employer');
  await queue.saveDocuments(id,{json:JSON.stringify(value),expectedUpdatedAt:current.updatedAt});
  native=(await fixture.request('DOCK_RECORDS_STATE')).jobs[0];assert.equal(native.company,'Employer LLC');assert.equal(native.role,'Software Engineer');assert.equal(native.salary,quote);assert.equal(native.status,'Ready');
  assert.equal(JSON.parse(native.resume.cvJsonRaw).title,'Software Engineer');assert.equal(native.resume.coverLetterRaw,value.coverLetter);assert.equal(native.resume.coverLetterEnabled,true);
  const saved=queue.snapshot().requests[0],reopened=manualDocumentValue(saved);assert.doesNotThrow(()=>parseManualDocuments(JSON.stringify(reopened),saved));
  assert.equal(Object.hasOwn(reopened.resume,'contact'),false);
  await assert.rejects(()=>queue.saveDocuments(id,{json:JSON.stringify(value),expectedUpdatedAt:current.updatedAt,expectedRevision:current.canonicalRevision}),/changed/);
  value.coverLetter='';await queue.saveDocuments(id,{json:JSON.stringify(value),expectedUpdatedAt:saved.updatedAt});
  native=(await fixture.request('DOCK_RECORDS_STATE')).jobs[0];assert.equal(native.resume.coverLetterEnabled,false);assert.equal(native.resume.coverLetterRaw,'');
});

async function popup(t,saveDocuments){
  const win=new Window(),previous=globalThis.document;t.after(()=>{globalThis.document=previous;win.happyDOM.abort();});
  win.document.body.innerHTML=(await readFile('extension/ai-apply/index.html','utf8')).match(/<dialog id="documents-dialog"[\s\S]*?<\/dialog>/)[0];globalThis.document=win.document;
  const dialog=win.document.querySelector('dialog');dialog.close=()=>{dialog.open=false;dialog.dispatchEvent(new win.Event('close'));};
  let saved=0;const view=createQueueDocuments({queue:{saveDocuments},getRequest:()=>job,openDialog:()=>dialog.open=true,onSaved:()=>saved++});view.open(job.id);
  const input=win.document.querySelector('textarea'),form=win.document.querySelector('form'),save=win.document.querySelector('#documents-save'),status=win.document.querySelector('#documents-status');
  const paste=value=>{input.value=typeof value==='string'?value:JSON.stringify(value);input.dispatchEvent(new win.Event('input'));};
  const submit=()=>form.dispatchEvent(new win.Event('submit',{cancelable:true}));return {win,dialog,input,form,save,status,paste,submit,get saved(){return saved;}};
}

test('Update popup validates and submits the complete reply through separate resume and cover letter inputs',async t=>{
  const writes=[],ui=await popup(t,async(id,value)=>writes.push({id,value}));
  assert.equal(ui.win.document.querySelectorAll('textarea').length,2);assert.equal(ui.save.disabled,true);
  ui.paste('{');assert.equal(ui.save.disabled,true);ui.submit();await flush();assert.equal(writes.length,0);
  ui.paste({...document,requestId:'other'});assert.equal(ui.save.disabled,true);assert.match(ui.status.textContent,/another request/);
  ui.paste(document.resume);const letter=ui.win.document.querySelector('#documents-cover-letter'),enabled=ui.win.document.querySelector('#documents-cover-enabled');enabled.checked=true;letter.value=document.coverLetter;enabled.dispatchEvent(new ui.win.Event('input'));assert.equal(ui.save.disabled,false);ui.submit();await flush();
  assert.equal(writes.length,1);assert.equal(writes[0].id,job.id);assert.deepEqual(JSON.parse(writes[0].value.resume),document.resume);assert.equal(ui.dialog.open,false);assert.equal(ui.saved,1);
});

test('Update popup preserves the pasted JSON and displays save conflicts',async t=>{
  const ui=await popup(t,async()=>{throw Error('This job changed in another view.');});ui.paste(document.resume);ui.submit();await flush();
  assert.equal(ui.dialog.open,true);assert.deepEqual(JSON.parse(ui.input.value),document.resume);assert.match(ui.status.textContent,/changed in another view/);assert.equal(ui.input.disabled,false);assert.equal(ui.saved,0);
});
