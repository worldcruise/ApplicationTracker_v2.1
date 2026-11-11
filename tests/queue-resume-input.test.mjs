import assert from 'node:assert/strict';
import test from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {dockFixture} from './helpers/dock-records-fixture.mjs';
import {mountQueueResumeInput} from '../extension/studio/queue-resume-input.js';
import {JOB_RECORD_ICONS} from '../extension/studio/job-records-markup.js';
import {createQueueResumeExports} from '../extension/studio/queue-resume-export.js';
import {createQueueDirectoryStore} from '../extension/studio/queue-export-folder.js';
import {IDBFactory} from 'fake-indexeddb';
import {RESUME_JSON_PROMPT,RESUME_JSON_COMMENT} from '../extension/studio/resume-json-prompt.js';
import {saveDefaultExportRoot} from '../extension/studio/default-export-root.js';

const cv=(company='Updated Company',title='Updated Role')=>({company,title,summary:'Prepared summary.',skills:[{Engineering:['JavaScript']}],experience:[],education:[]});
const input=(company,title)=>({cvJsonRaw:JSON.stringify(cv(company,title)),coverLetterRaw:'',coverLetterEnabled:false});
async function until(check){for(let index=0;index<150;index++){if(await check())return;await delay(10);}throw Error('CV input did not settle.');}

test('every queue status can be deleted and undone, including Queued and Ready',async t=>{
  const f=await dockFixture(t),queued=await f.create('queued'),ready=await f.ready(await f.create('ready'));
  for(const record of [queued,ready]){const removed=await f.mutate('delete',record);assert.ok(!removed.jobs.some(job=>job.id===record.id));const restored=await f.mutate('restore',{...record,revision:record.revision+1});assert.equal(restored.jobs.find(job=>job.id===record.id).status,record.status);}
  assert.equal(f.browser.storage.local.values.appliedList.length,1);
});

test('CV updates rename the queued job atomically, preserve matching labels, and retain resume history without changing Studio or the candidate',async t=>{
  const f=await dockFixture(t),record=await f.create(),draft=structuredClone(f.draft),candidate=await f.deps.profiles.bootstrap(),fields={...input('New Company','Senior Engineer'),coverLetterRaw:'Dear hiring team,\n\nI am interested in this role.',coverLetterEnabled:true},mutationId=crypto.randomUUID();
  const inspect=await f.request('DOCK_RECORDS_CV_INPUT',{action:'validate',id:record.id,expectedRevision:record.revision,windowId:41,...fields});assert.equal(inspect.validation.state,'valid');assert.equal((await f.request('DOCK_RECORDS_STATE')).jobs[0].status,'Queued');
  const update={action:'update-resume',type:'queue',id:record.id,expectedRevision:record.revision,fields,mutationId};const result=await f.request('DOCK_RECORDS_MUTATE',update),saved=result.jobs[0];
  assert.equal(saved.company,'New Company');assert.equal(saved.role,'Senior Engineer');assert.equal(saved.status,'Ready');assert.equal(saved.inputRevision,2);assert.equal(saved.resume.coverLetterRaw,fields.coverLetterRaw);assert.equal(saved.resume.coverLetterEnabled,true);assert.equal(saved.resume.snapshot.resume.company,saved.company);
  assert.deepEqual(f.draft,draft);assert.deepEqual(await f.deps.profiles.bootstrap(),candidate);assert.equal((await f.request('DOCK_RECORDS_MUTATE',update)).jobs[0].resume.version,1);
  const matched=await f.mutate('update-resume',saved,input(' new company ','senior engineer'));assert.equal(matched.jobs[0].company,'New Company');assert.equal(matched.jobs[0].role,'Senior Engineer');assert.equal(matched.jobs[0].inputRevision,2);assert.equal(matched.jobs[0].resume.version,2);assert.equal(matched.jobs[0].resumeHistory[0].coverLetterRaw,fields.coverLetterRaw);
  await assert.rejects(f.mutate('update-resume',record,fields),{code:'CONFLICT'});
});

test('invalid JSON or an enabled empty cover letter cannot overwrite a saved queue resume',async t=>{
  const f=await dockFixture(t),record=await f.ready(await f.create());
  for(const fields of [{...input(),cvJsonRaw:'{broken'},{...input(),coverLetterEnabled:true}])await assert.rejects(f.mutate('update-resume',record,fields),{code:'INVALID_CV'});
  assert.deepEqual((await f.request('DOCK_RECORDS_STATE')).jobs[0],record);
});

test('completed exports retain the saved PDF reference on the matching queue resume',async t=>{
  const f=await dockFixture(t),job=await f.ready(await f.create());
  f.deps.resumeExports={start:async(record,options)=>{options.selection.destination={bindingId:'root',companyFolder:'Employer'};return {id:options.ticketId,files:[{kind:'cv',state:'pending'}]};},status:async()=>({files:[{kind:'cv',state:'complete',filename:'resume.pdf'}]})};f.restart();
  const payload={id:job.id,expectedRevision:job.revision,windowId:41,ticketId:'saved-export',bindingId:'root',cvJsonRaw:job.resume.cvJsonRaw,coverLetterRaw:'',coverLetterEnabled:false};
  await f.request('DOCK_RECORDS_CV_INPUT',{...payload,action:'export'});
  await f.request('DOCK_RECORDS_CV_INPUT',{...payload,action:'export-status'});
  assert.deepEqual((await f.request('DOCK_RECORDS_STATE')).jobs[0].resume.export,{ticketId:'saved-export',bindingId:'root',companyFolder:'Employer',fileName:'resume.pdf',state:'complete'});
});

test('CV downloads freeze just the entered CV and optional letter without committing edits',async t=>{
  const f=await dockFixture(t),record=await f.create(),before=structuredClone(f.draft);let exported;
  f.deps.resumeExports={start:async(job,options)=>{exported={job,options};return {id:options.ticketId};}};f.restart();
  await f.request('DOCK_RECORDS_CV_INPUT',{action:'export',id:record.id,expectedRevision:1,windowId:41,ticketId:'download-1',bindingId:'folder-1',...input(),coverLetterEnabled:true,coverLetterRaw:'Letter paragraph one.\n\nLetter paragraph two.'});
  assert.equal(exported.options.selection.omitJobDescription,true);assert.equal(exported.options.selection.jobInputRaw,'');assert.deepEqual(exported.options.selection.letter.paragraphs,['Letter paragraph one.','Letter paragraph two.']);assert.equal(exported.options.selection.snapshot.resume.company,'Updated Company');assert.deepEqual(f.draft,before);assert.equal((await f.request('DOCK_RECORDS_STATE')).jobs[0].resume,null);
});

test('queue exports verify folder ownership and permission and retry only the requested missing file',async()=>{
  const record={id:'job-1',candidateId:'candidate-1',revision:1},root={id:'folder-1',candidateId:'candidate-1',preference:'Resumes',name:'Resumes',handle:{queryPermission:async()=> 'granted'}};let selection,runs=[];
  const publicTicket={id:'ticket-1',candidateId:record.candidateId,draftId:'queue-resume:job-1',files:[{kind:'cv',state:'complete'},{kind:'letter',state:'failed'}]};
  const tickets={request:async(id,details,prepare)=>{selection=(await prepare()).selection;return publicTicket;},run:async(...args)=>runs.push(args),status:async()=>publicTicket,retry:async()=>publicTicket};
  const exports=createQueueResumeExports({tickets,directories:()=>({root:async()=>root}),safeCompanyFolder:value=>value});
  const options={ticketId:'ticket-1',bindingId:root.id,selection:{snapshot:{candidate:{id:record.candidateId},draftId:publicTicket.draftId,resume:{company:'Employer'}},cvJsonRaw:'{}',coverLetterRaw:'Letter',coverLetterEnabled:true}};
  await exports.start(record,options);assert.equal(selection.destination.companyFolder,'Employer');assert.equal(selection.destination.rootName,'Resumes');await exports.retry(record,'ticket-1','letter');assert.deepEqual(runs.at(-1),['ticket-1','letter']);
  root.handle.queryPermission=async()=> 'denied';await assert.rejects(exports.start(record,options),{code:'FOLDER_PERMISSION'});root.candidateId='another-candidate';await assert.rejects(exports.start(record,options),{code:'FOLDER_REQUIRED'});
});

test('queue folder handles use the Studio store without changing the Studio folder assignment',async()=>{
  const indexedDB=new IDBFactory(),store=createQueueDirectoryStore(indexedDB),original={id:'studio-root',candidateId:'candidate-1',name:'Resumes',preference:'Resumes',handle:{kind:'directory',name:'Resumes'}};await store.remember(original);
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('application-tracker-export-files-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  await new Promise((resolve,reject)=>{const tx=db.transaction('preferences','readwrite');tx.objectStore('preferences').put(original.id,JSON.stringify([original.candidateId,original.preference]));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();
  const selected={...original,id:'queue-root'};await store.remember(selected);assert.deepEqual(await store.root(selected.id),selected);assert.deepEqual(await store.matching(original.candidateId,original.preference),original);
});

async function modal(t){
  const f=await dockFixture(t),page=new Window(),host=page.document.createElement('div');page.document.body.append(host);let updated,chosen=0;const roots=new Map();
  const directoryStore={root:async id=>roots.get(id),matching:async()=>null,remember:async root=>roots.set(root.id,root),bind:async root=>roots.set(root.id,root)};
  page.showDirectoryPicker=()=>{chosen++;return Promise.resolve({name:'Selected folder',queryPermission:async()=> 'granted'});};
  f.deps.resumeExports={start:async(record,options)=>({id:options.ticketId,phase:'settled',pending:false,message:'Saved',files:[{kind:'cv',state:'complete',filename:'resume.pdf'}]})};f.restart();
  const ui=mountQueueResumeInput(host,{request:f.request,privateStorage:f.storage,getWindowId:()=>41,onUpdated:next=>{updated=next;},icons:JOB_RECORD_ICONS,directoryStore});t.after(()=>{ui.close();return page.happyDOM.abort();});
  const $=selector=>host.querySelector(selector),enter=(selector,value)=>{const node=$(selector);node.value=value;node.dispatchEvent(new page.Event('input',{bubbles:true}));};
  return {...f,page,ui,$,enter,directoryStore,get updated(){return updated;},get chosen(){return chosen;}};
}

test('CV modal validates inputs, keeps its letter toggle separate, updates the record and cancels further edits',async t=>{
  const app=await modal(t),job=await app.create();await app.ui.open(job);assert.equal(app.$('#jr-cv-heading').textContent,'CV input');assert.equal(app.$('#jr-cv-update').disabled,true);assert.equal(app.$('#jr-cv-letter').hidden,true);assert.equal(app.$('#jr-cv-dialog').querySelector('[id*="job-description"]'),null);
  app.enter('#jr-cv-input',JSON.stringify(cv()));await until(()=>!app.$('#jr-cv-update').disabled);app.$('#jr-cv-letter-toggle').click();assert.equal(app.$('#jr-cv-letter').hidden,false);await until(()=>app.$('#jr-cv-status').dataset.state==='error');
  app.enter('#jr-cv-letter','A separately imported cover letter.');await until(()=>!app.$('#jr-cv-update').disabled);app.$('[data-cv-action="folder"]').click();await until(()=>app.$('#jr-cv-folder-name').value==='Selected folder');app.$('#jr-cv-update').click();await until(()=>app.updated);await until(()=>app.$('#jr-cv-dialog').getAttribute('aria-busy')==='false');
  assert.equal(app.updated.jobs[0].company,'Updated Company');assert.equal(app.updated.jobs[0].resume.coverLetterRaw,'A separately imported cover letter.');assert.equal(app.$('#jr-cv-dialog').open,true);
  app.enter('#jr-cv-input','Unsaved changes');app.$('[data-cv-action="cancel"]').click();assert.equal(app.$('#jr-cv-dialog').open,false);assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs[0].resume.cvJsonRaw,JSON.stringify(cv()));
});

test('CV Copy prompt copies the exact shared conversion prompt and shows its explanation',async t=>{
  const app=await modal(t),job=await app.create();let copied;
  Object.defineProperty(app.page.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}}});
  await app.ui.open(job);assert.equal(app.$('#jr-cv-prompt-comment').textContent,RESUME_JSON_COMMENT);
  app.$('[data-cv-action="copy-prompt"]').click();await until(()=>copied!==undefined);assert.equal(copied,RESUME_JSON_PROMPT);
});

test('cover-letter toggle controls import, editor and saved state without deleting text',async t=>{
  const app=await modal(t),job=await app.create();await app.ui.open(job,{letter:true});
  const upload=()=>app.$('[data-cv-action="import-letter"]'),toggle=()=>app.$('#jr-cv-letter-toggle');
  assert.equal(toggle().getAttribute('aria-checked'),'false');assert.equal(upload().disabled,true);assert.equal(app.$('#jr-cv-letter-file').disabled,true);
  app.enter('#jr-cv-input',JSON.stringify(cv()));toggle().click();assert.equal(upload().disabled,false);assert.equal(app.$('#jr-cv-letter').disabled,false);
  app.enter('#jr-cv-letter','Keep this letter when switched off');toggle().click();assert.equal(upload().disabled,true);assert.equal(app.$('#jr-cv-letter').hidden,true);
  await until(()=>!app.$('#jr-cv-update').disabled);app.$('[data-cv-action="folder"]').click();await until(()=>app.$('#jr-cv-folder-name').value==='Selected folder');app.$('#jr-cv-update').click();await until(()=>app.updated);await until(()=>app.$('#jr-cv-dialog').getAttribute('aria-busy')==='false');
  const saved=app.updated.jobs.find(item=>item.id===job.id);assert.equal(saved.resume.coverLetterEnabled,false);assert.equal(saved.resume.coverLetterRaw,'Keep this letter when switched off');
  await app.ui.open(saved);assert.equal(toggle().getAttribute('aria-checked'),'false');assert.equal(upload().disabled,true);
  toggle().click();assert.equal(upload().disabled,false);assert.equal(app.$('#jr-cv-letter').value,'Keep this letter when switched off');
});

test('eye control previews the current unsaved CV in Studio without updating the queue resume',async t=>{
  const app=await modal(t),job=await app.ready(await app.create()),saved=structuredClone(job.resume),previous=(await app.deps.drafts.read()).draft;let opened=0;
  app.deps.openStudio=async()=>{opened++;return {tabId:100};};app.restart();
  await app.ui.open(job);const eye=app.$('[data-cv-action="preview"]');
  assert.equal(eye.previousElementSibling.dataset.cvAction,'import-cv');
  app.enter('#jr-cv-input','{invalid');assert.equal(eye.disabled,true);
  const raw=JSON.stringify(cv('Preview Company'));app.enter('#jr-cv-input',raw);await until(()=>!eye.disabled);
  eye.click();await until(()=>opened===1);await until(()=>app.$('#jr-cv-dialog').getAttribute('aria-busy')==='false');
  assert.equal((await app.deps.drafts.read()).draft.cvJsonRaw,raw);
  assert.deepEqual((await app.request('DOCK_RECORDS_STATE')).jobs.find(item=>item.id===job.id).resume,saved);
  const backups=await app.storage.get(null);assert.ok(Object.entries(backups).some(([key,value])=>key.startsWith('dock-draft-backup:')&&value.cvJsonRaw===previous.cvJsonRaw));
});

test('CV export uses the Settings default root and retains an explicitly selected override',async t=>{
  const app=await modal(t),job=await app.create();
  await saveDefaultExportRoot({name:'Default exports',queryPermission:async()=> 'granted'},app.storage,app.directoryStore);
  await app.ui.open(job);assert.equal(app.$('#jr-cv-folder-name').value,'Default exports');assert.equal(app.chosen,0);
  app.$('[data-cv-action="folder"]').click();await until(()=>app.$('#jr-cv-folder-name').value==='Selected folder');
  await app.ui.open(job);assert.equal(app.$('#jr-cv-folder-name').value,'Selected folder');
});

test('Save & Export checks the folder first and retries export without saving a second resume version',async t=>{
  const app=await modal(t),job=await app.create();let attempts=0;
  app.deps.resumeExports={start:async(record,options)=>{if(++attempts===1)throw Error('Disk unavailable');return {id:options.ticketId,phase:'settled',pending:false,message:'Saved',files:[]};}};app.restart();
  await app.ui.open(job);app.enter('#jr-cv-input',JSON.stringify(cv()));await until(()=>!app.$('#jr-cv-update').disabled);
  app.$('#jr-cv-update').click();await until(()=>app.$('#jr-cv-status-text').textContent.includes('Choose an export folder'));assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs[0].resume,null);
  app.$('[data-cv-action="folder"]').click();await until(()=>app.$('#jr-cv-folder-name').value==='Selected folder');app.$('#jr-cv-update').click();await until(()=>app.$('#jr-cv-status-text').textContent.includes('Resume saved. Export could not complete'));await until(()=>!app.$('#jr-cv-update').disabled);
  assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs[0].resume.version,1);
  app.$('#jr-cv-update').click();await until(()=>attempts===2);await until(()=>app.$('#jr-cv-dialog').getAttribute('aria-busy')==='false');assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs[0].resume.version,1);
});

test('Save & Export writes the current input and saves the queue resume in one action',async t=>{
  const app=await modal(t),job=await app.create();let downloaded;
  app.deps.resumeExports={start:async(record,options)=>{downloaded=options;return {id:options.ticketId,phase:'settled',pending:false,message:'Saved',files:[{kind:'cv',state:'complete',filename:'resume.pdf'}]};}};app.restart();
  await app.ui.open(job);app.enter('#jr-cv-input',JSON.stringify(cv()));await until(()=>!app.$('#jr-cv-update').disabled);
  app.$('[data-cv-action="folder"]').click();assert.equal(app.chosen,1,'The picker starts synchronously from the user click');await until(()=>app.$('#jr-cv-folder-name').value==='Selected folder');
  app.$('#jr-cv-update').click();await until(()=>downloaded);assert.ok(downloaded.bindingId);assert.equal(downloaded.selection.snapshot.resume.company,'Updated Company');assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs[0].resume.cvJsonRaw,JSON.stringify(cv()));
});
