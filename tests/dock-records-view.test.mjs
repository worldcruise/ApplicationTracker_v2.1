import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Window } from 'happy-dom';
import { dockFixture } from './helpers/dock-records-fixture.mjs';
import { mountJobRecords } from '../extension/studio/job-records-view.js';
import { JOB_RECORDS_MARKUP } from '../extension/studio/job-records-markup.js';
import { DASHBOARD_MARKUP } from '../extension/studio/reference-dashboard-markup.js';
import { mountReferenceDashboard } from '../extension/studio/reference-dashboard.js';
import {createMeetingSamples} from './fixtures/meeting-samples.mjs';

async function until(condition) { for(let i=0;i<200;i++){if(condition())return;await delay(5);}throw Error('The dock did not settle.'); }
async function view(t,options={}) {
  const f=await dockFixture(t),page=new Window({settings:{disableJavaScriptEvaluation:true}});page.document.body.innerHTML='<div id="host"></div>';
  let api;
  const serviceRequest=f.request;
  f.browser.runtime.sendMessage=async message=>{if(message.target)return{ok:true};try{return{ok:true,requestId:message.requestId,result:await serviceRequest(message.operation,message.payload)};}catch(error){return{ok:false,requestId:message.requestId,error:{code:error.code,message:error.message}};}};
  const roots=new Map(),directoryStore={root:async id=>roots.get(id),matching:async()=>null,remember:async root=>roots.set(root.id,root)};page.showDirectoryPicker=async()=>({name:'Test exports',queryPermission:async()=> 'granted'});
  const host=page.document.getElementById('host'),$=selector=>host.querySelector(selector),click=async selector=>{assert.ok($(selector),selector);$(selector).click();await until(()=>$('section')&&$('#job-records-design').getAttribute('aria-busy')!=='true');await delay(10);};
  const enter=(selector,value)=>{const node=$(selector);assert.ok(node,selector);node.value=value;node.dispatchEvent(new page.Event('input',{bubbles:true}));};
  const mount=async()=>{api=mountJobRecords(host,{browser:f.browser,privateStorage:f.storage,directoryStore,...options});await api.ready;};
  await mount();t.after(async()=>{api.close();await page.happyDOM.abort();});
  return {...f,page,host,$,click,enter,remount:async()=>{api.close();await delay(10);await mount();},get api(){return api;}};
}

test('dock HTML uses the reference layout, real records, and keeps edits across tabs and reopening',async t=>{
  const app=await view(t);
  assert.equal(app.$('#jr-app-count').textContent,'1');assert.equal(app.$('#jr-queue-count').textContent,'0');assert.ok(!app.host.textContent.includes('Morgan Taylor'));assert.ok(!JOB_RECORDS_MARKUP.includes('<script'));
  await app.click('.jr-application-record .jr-card-main');await app.click('#jr-edit-slot [data-command="edit"]');
  app.enter('#jr-salary','$100,000 / year');
  await app.click('#jr-view-description');await app.click('#jr-view-details');assert.equal(app.$('#jr-salary').value,'$100,000 / year');
  await app.click('#jr-tab-queue');await app.click('#jr-tab-applications');await app.click('.jr-application-record .jr-card-main');await app.click('#jr-edit-slot [data-command="edit"]');assert.equal(app.$('#jr-salary').value,'$100,000 / year');
  await app.remount();assert.equal(app.$('#jr-salary').value,'$100,000 / year');assert.equal(app.$('#jr-edit-form').hidden,false);
  app.$('#jr-status-select').value='interview';app.$('#jr-status-select').dispatchEvent(new app.page.Event('change',{bubbles:true}));
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.browser.storage.local.values.appliedList[0].status==='interview');
  assert.equal(app.browser.storage.local.values.appliedList[0].status,'interview');
});

test('Applications manual add requires company and role and creates an application instead of a queue job',async t=>{
  const app=await view(t);
  assert.equal(app.$('.jr-search-row [data-command="add"]').textContent,'Add');
  assert.equal(app.$('.jr-search-row input').nextElementSibling.className,'jr-manage');
  assert.equal(app.$('.jr-toolbar').hidden,true);
  await app.click('[data-command="manage"]');assert.equal(app.$('.jr-manage-menu').hidden,false);
  await app.click('[data-command="add"]');
  assert.equal(app.$('#jr-add-form h3').textContent,'Add application record manually');
  for(const name of ['company','role']){const input=app.$(`#jr-add-form [name="${name}"]`);assert.equal(input.required,true);assert.equal(input.previousElementSibling.querySelector('.jr-required').textContent,'*');}
  assert.equal(app.$('#jr-add-form [name="url"]').required,false);
  app.enter('#jr-add-form [name="company"]','Manual Company');app.enter('#jr-add-form [name="role"]','Manual Role');
  app.$('#jr-add-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-app-count').textContent==='2');
  assert.equal(app.$('#jr-queue-count').textContent,'0');assert.equal(app.$('#jr-detail-company').textContent,'Manual Company');
  assert.equal(app.$('#jr-note-input'),null);assert.ok(app.$('#jr-resume-input'));assert.ok(app.$('#jr-letter-input'));
});

test('queue detail keeps only apply and delete actions and places Update record beside the tabs',async t=>{
  const app=await view(t),job=await app.ready(await app.create());await app.api.select(job.id);
  assert.deepEqual([...app.$('#jr-detail-actions').children].map(node=>node.dataset.command),['apply','delete']);
  assert.equal(app.$('.jr-detail-subnav').nextElementSibling.id,'jr-edit-slot');
  await app.click('#jr-edit-slot [data-command="edit"]');
  const cv=JSON.stringify({company:job.company,title:job.role,summary:'Edited resume text',skills:[],experience:[],education:[]});app.enter('#jr-resume-input',cv);
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-resume-input').disabled);
  assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs.find(item=>item.id===job.id).resume.cvJsonRaw,cv);
});

test('queue details offer manual application recording below Update record and preserve submitted documents',async t=>{
 const app=await view(t),ready=await app.ready(await app.create('manual-detail')),saved=await app.mutate('update',ready,{...ready,cvJsonRaw:ready.resume.cvJsonRaw,coverLetterRaw:'Submitted letter',coverLetterEnabled:true,salary:'$120,000'}),job=saved.jobs[0];await app.api.select(job.id);
 const actions=[...app.$('#jr-edit-slot').children];assert.deepEqual(actions.map(node=>node.dataset.command),['edit','mark-applied']);assert.equal(actions[1].textContent,'Mark as applied');
 await app.click('#jr-edit-slot [data-command="edit"]');assert.equal(app.$('[data-command="mark-applied"]').disabled,true);app.$('#jr-salary').dispatchEvent(new app.page.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(app.$('[data-command="mark-applied"]').disabled,false);
 await app.click('[data-command="mark-applied"]');const state=await app.request('DOCK_RECORDS_STATE'),application=state.applications.find(row=>row.url===job.url);assert.equal(state.jobs.length,0);assert.equal(application.status,'applied');assert.deepEqual(application.resume,job.resume);assert.equal(application.coverLetterRaw,'Submitted letter');assert.equal(application.salary,'$120,000');assert.equal(app.$('[data-command="mark-applied"]'),null);assert.equal(app.$('#jr-tab-applications').getAttribute('aria-selected'),'true');
});

test('Delete opens a date-filtered selection dialog for queue jobs and applications',async t=>{
  const app=await view(t);await app.create('first');await app.create('second');
  assert.equal(app.$('[data-command="delete-all"]'),null);await app.api.show('queue');
  const clear=app.$('[data-command="delete-records"]');assert.equal(clear.previousElementSibling.getAttribute('role'),'separator');assert.equal(clear.textContent,'Delete');
  await app.click('[data-command="delete-records"]');
  const dialog=app.$('.record-delete-dialog');assert.equal(dialog.open,true);assert.equal(dialog.querySelector('select').value,'24hours');assert.equal(dialog.querySelector('.record-delete-confirm').disabled,true);
  const period=dialog.querySelector('select');period.value='custom';period.dispatchEvent(new app.page.Event('change'));
  assert.equal(dialog.querySelectorAll('tbody tr').length,2);
  dialog.querySelector('[aria-label="Select all shown records"]').click();assert.equal(dialog.querySelectorAll('tbody input:checked').length,2);
  await app.click('.record-delete-confirm');await until(()=>!app.$('.record-delete-dialog'));
  assert.equal(app.$('#jr-queue-count').textContent,'0');assert.equal(app.$('#jr-app-count').textContent,'1');assert.equal(clear.disabled,true);
  await app.remount();assert.equal(app.$('#jr-queue-count').textContent,'0');
  await app.api.show('applications');await app.click('[data-command="delete-records"]');assert.equal(app.$('.record-delete-dialog h2').textContent,'Delete applications');
  await app.click('.record-delete-close');assert.equal(app.$('#jr-app-count').textContent,'1');
});

test('Manage offers import and export only for queues, closes on Escape, and opens the export picker',async t=>{
  const app=await view(t);await app.create();
  await app.api.show('queue');await app.click('[data-command="manage"]');
  assert.deepEqual([...app.$('.jr-manage-menu').querySelectorAll('[role=menuitem]')].filter(button=>!button.hidden).map(button=>button.textContent),['Add','Import','Export','Delete']);
  app.$('[data-command="add"]').dispatchEvent(new app.page.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(app.$('.jr-manage-menu').hidden,true);
  await app.click('[data-command="manage"]');await app.click('[data-command="export-records"]');
  assert.equal(app.$('.jr-manage-menu').hidden,true);assert.equal(app.$('.record-delete-dialog h2').textContent,'Export queue jobs');
  assert.equal(app.$('[aria-label="Export period"]').value,'24hours');assert.equal(app.$('.record-export-confirm').disabled,true);await app.click('.record-delete-close');
  await app.api.show('applications');await app.click('[data-command="manage"]');
  assert.deepEqual([...app.$('.jr-manage-menu').querySelectorAll('[role=menuitem]')].filter(button=>!button.hidden).map(button=>button.textContent),['Add','Delete']);
  const saved=await app.request('DOCK_RECORDS_STATE');assert.equal(saved.jobs.length,1);assert.equal(saved.applications.length,1);
});

test('Update record enables fields and becomes a Save button that commits edits',async t=>{
  const app=await view(t),record=await app.create();await app.api.select(record.id);
  assert.ok(app.$('#jr-edit-slot [data-command="edit"]'));
  await app.click('#jr-edit-slot [data-command="edit"]');
  const save=app.$('#jr-edit-slot button');assert.equal(save.textContent,'Save record');assert.ok(save.querySelector('.lucide-save'));assert.equal(save.type,'submit');assert.equal(save.getAttribute('form'),'jr-edit-form');
  assert.ok(app.$('.jr-detail-navigation').classList.contains('jr-editing'));
  for(const control of app.$('#jr-edit-form').querySelectorAll('input,textarea,select'))assert.equal(control.disabled,false);
  if(!app.$('#jr-letter-enabled').checked)await app.click('#jr-letter-enabled');
  app.enter('#jr-letter-input','Saved through the top Save button');
  assert.notEqual((await app.request('DOCK_RECORDS_STATE')).jobs.find(job=>job.id===record.id).coverLetterRaw,'Saved through the top Save button');
  await app.click('#jr-edit-slot button');
  await until(()=>!!app.$('#jr-edit-slot [data-command="edit"]'));
  assert.equal(app.$('#jr-letter-input').disabled,true);
  assert.equal(app.$('.jr-detail-navigation').classList.contains('jr-editing'),false);
  assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs.find(job=>job.id===record.id).coverLetterRaw,'Saved through the top Save button');
});

test('Escape discards queue detail edits and restores the saved fields',async t=>{
  const app=await view(t),record=await app.create();await app.api.select(record.id);
  await app.click('#jr-edit-slot [data-command="edit"]');
  assert.equal(app.$('#jr-edit-form .jr-detail-actions').hidden,true);
  const original=app.$('#jr-salary').value;app.enter('#jr-salary','Discard this salary');
  app.$('#jr-salary').dispatchEvent(new app.page.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
  assert.equal(app.$('#jr-salary').value,original);assert.equal(app.$('#jr-salary').disabled,true);
  assert.ok(app.$('#jr-edit-slot [data-command="edit"]'));
  await app.remount();await app.api.select(record.id);assert.equal(app.$('#jr-salary').value,original);
});

test('dock job creation, job description, failed-job undo and application submission use persistent records',async t=>{
  const app=await view(t);await app.api.show('queue');await app.click('[data-command="add"]');
  for(const [name,value]of Object.entries({company:'Widget Labs',role:'Engineer',salary:'$100,000-$130,000 / year',url:'https://example.test/new',description:'Build useful products.'}))app.enter(`#jr-add-form [name="${name}"]`,value);
  app.$('#jr-add-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-detail-company').textContent==='Widget Labs');
  assert.equal(app.$('#jr-queue-count').textContent,'1');
  assert.equal(app.$('#jr-description-pane').hidden,false);assert.equal(app.$('.jr-description-copy').textContent,'Build useful products.');await app.click('#jr-view-details');
  await app.mutate('fail',(await app.request('DOCK_RECORDS_STATE')).jobs[0]);await app.api.refresh();await app.click('#jr-detail-actions [data-command="delete"]');assert.equal(app.$('#jr-queue-count').textContent,'0');
  await app.click('[data-command="undo-delete"]');assert.equal(app.$('#jr-queue-count').textContent,'1');await app.mutate('retry',(await app.request('DOCK_RECORDS_STATE')).jobs[0]);await app.api.refresh();
  let record=(await app.request('DOCK_RECORDS_STATE')).jobs[0];record=await app.ready(record);await app.api.refresh();
  assert.equal(app.$('#jr-detail-status').hidden,true);assert.equal(app.$('#jr-detail-status').textContent,'Ready');
  await app.click('#jr-view-description');assert.equal(app.$('.jr-description-copy').textContent,'Build useful products.');assert.ok(!app.$('#jr-description-pane').textContent.includes('Real saved summary'));
  await app.click('#jr-view-details');await app.mutate('apply',(await app.request('DOCK_RECORDS_STATE')).jobs[0]);await app.api.refresh();assert.equal(app.$('#jr-app-count').textContent,'2');assert.equal(app.$('#jr-queue-count').textContent,'0');
  assert.equal(app.browser.storage.local.values.appliedList.length,2);assert.equal(app.tabs.length,0);
});

test('dock blocks stale application saves and retains unsaved edit text',async t=>{
  const app=await view(t);
  await app.click('.jr-application-record .jr-card-main');await app.click('#jr-edit-slot [data-command="edit"]');app.enter('#jr-salary','$100,000 / year');
  const raw=app.browser.storage.local.values.appliedList.map(item=>({...item,status:'offer'}));await app.browser.storage.local.set({appliedList:raw});await delay(20);
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-feedback').dataset.error==='true');
  assert.equal(app.$('#jr-salary').value,'$100,000 / year');assert.equal(app.browser.storage.local.values.appliedList[0].status,'offer');
});

test('queue cards have four actions, gate missing documents, and open Details from the main section',async t=>{
  const app=await view(t),queued=await app.create('queued'),ready=await app.ready(await app.create('ready'));
  await app.api.show('queue');
  for(const record of [queued,ready]){
    const card=app.$(`[data-id="${record.id}"]`);assert.ok(card.classList.contains('jr-queue-record'));
    assert.deepEqual([...card.querySelectorAll('.jr-record-actions button')].map(node=>node.getAttribute('aria-label')||node.textContent),['Resume','Cover letter','Update','Delete']);
    assert.equal(card.querySelector('[data-command="open-resume"]').disabled,!record.resume?.snapshot);
    assert.equal(card.querySelector('[data-command="cover-letter"]').disabled,true);
    assert.equal(card.querySelector('.jr-card-salary').textContent,'Salary not listed');
  }
  await app.click(`[data-id="${queued.id}"] .jr-card-main`);assert.equal(app.$('#jr-details-pane').hidden,false);assert.equal(app.$('#jr-description-pane').hidden,true);
  await app.click('[data-command="back"]');
  assert.equal(app.$(`[data-id="${queued.id}"] [data-command="open-resume"]`).disabled,true,'refresh cannot enable missing documents');
  const main=app.$(`[data-id="${queued.id}"] .jr-card-main`);main.dispatchEvent(new app.page.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await until(()=>!app.$('#jr-detail').hidden&&app.$('#job-records-design').getAttribute('aria-busy')!=='true');await app.click('[data-command="back"]');
  const savedJson=ready.resume.cvJsonRaw,current=(await app.deps.drafts.read()).draft;await app.deps.drafts.save({draft:{...current,cvJsonRaw:'Current unsaved CV text'},expectedRevision:current.revision});
  let opened=0;app.deps.openStudio=async()=>{opened++;return{tabId:100};};app.restart();
  await app.click(`[data-id="${ready.id}"] [data-command="open-resume"]`);assert.equal(opened,1);const restored=(await app.deps.drafts.read()).draft;assert.equal(restored.cvJsonRaw,savedJson);assert.equal(restored.jobInputRaw,`${ready.url}\n${ready.description}`);
  assert.equal(app.$('#jr-list').hidden,false,'Opening Studio does not replace the queue with an inline preview');assert.equal(app.tabs.length,0);
});

test('web queue List uses nine fields with status tags, document availability and working details',async t=>{
  const app=await view(t,{searchQueue:true,stateKeyPrefix:'web-records-ui:v1'}),queued=await app.create('queued'),ready=await app.ready(await app.create('ready'));
  await app.api.show('queue');app.api.setLayout('list');
  assert.equal(app.$('.jr-search-row').hidden,false);
  assert.equal(app.$('.jr-search-row input').getAttribute('aria-label'),'Search job queues by company or role');
  assert.deepEqual([...app.$('.jr-record-table thead tr').children].map(cell=>cell.textContent),['Company','Role','Salary','Status','Updated','JD','Resume','Cover letter','Actions']);
  for(const record of [queued,ready]){
    const row=app.$(`tr[data-id="${record.id}"]`);
    assert.equal(row.children.length,9);assert.equal(row.querySelector('.jr-status').textContent,record.status);
    assert.equal(row.querySelector('select'),null);assert.ok(row.querySelector('.jr-status svg'));
    assert.equal(row.querySelector('[data-command="open-resume"]').disabled,!record.resume?.snapshot);
    assert.equal(row.querySelector('[data-command="cover-letter"]').disabled,true);
    assert.deepEqual([...row.querySelectorAll('.jr-record-actions button')].map(button=>button.textContent),['Update','Delete']);
  }
  await app.click(`tr[data-id="${ready.id}"] [data-command="description"]`);
  assert.equal(app.$('#jr-description-pane').hidden,false);assert.equal(app.$('.jr-description-copy').textContent,ready.description);
  await app.click('[data-command="back"]');assert.equal(app.$('#job-records-design').dataset.layout,'list');
  await app.click(`tr[data-id="${queued.id}"] .jr-table-main`);assert.equal(app.$('#jr-details-pane').hidden,false);
  await app.click('[data-command="back"]');app.api.setLayout('cards');
  assert.equal(app.$('.jr-record-table'),null);assert.equal(app.host.querySelectorAll('.jr-queue-record').length,2);
  assert.equal(app.$('.jr-record-actions').children.length,4);
});

test('web queue search filters both layouts without changing saved records and remembers its view',async t=>{
  const app=await view(t,{searchQueue:true,stateKeyPrefix:'web-records-ui:v1'});
  await app.mutate('create',null,{company:'Cedar Health',role:'Product Designer',url:'https://example.test/cedar',description:'Design useful products.'});await app.create('second');await app.api.show('queue');
  app.enter('.jr-search-row input','cedar designer');assert.equal(app.host.querySelectorAll('.jr-queue-record').length,1);
  app.api.setLayout('list');assert.equal(app.$('.jr-record-table tbody').children.length,1);
  assert.match(app.$('.jr-record-table tbody').textContent,/Cedar Health/);
  app.enter('.jr-search-row input','no matching company');assert.match(app.$('.jr-empty').textContent,/No matching records/);
  assert.equal((await app.request('DOCK_RECORDS_STATE')).jobs.length,2);
  app.enter('.jr-search-row input','cedar designer');await app.remount();
  assert.equal(app.$('#job-records-design').dataset.layout,'list');assert.equal(app.$('.jr-record-table tbody').children.length,1);
  assert.equal(app.$('.jr-search-row input').value,'cedar designer');
});

test('application cards match queue actions and ordinary record edits preserve the current stage',async t=>{
  const app=await view(t),created=await app.mutate('create-application',null,{company:'Screening company',role:'Engineer'});
  const record=created.applications.find(row=>row.id===created.selectedId);await app.api.refresh();
  const card=app.$(`[data-id="${record.id}"]`);assert.ok(card.classList.contains('jr-compact-record'));
  assert.deepEqual([...card.querySelectorAll('.jr-record-actions button')].map(node=>node.getAttribute('aria-label')||node.textContent),['Resume','Cover letter','Update','Delete']);
  assert.equal(card.querySelector('[data-command="open-resume"]').disabled,true);assert.equal(card.querySelector('[data-command="application-letter"]').disabled,true);
  await app.click(`[data-id="${record.id}"] .jr-card-main`);
  assert.equal(app.$('#jr-tab-applications').getAttribute('aria-selected'),'true');assert.equal(app.$('#jr-details-pane').hidden,false);

});

test('salary edits persist to queue cards without invalidating a saved resume',async t=>{
  const app=await view(t),record=await app.ready(await app.create('salary'));
  await app.api.show('queue');await app.click(`[data-id="${record.id}"] .jr-card-main`);
  await app.click('#jr-edit-slot [data-command="edit"]');app.enter('#jr-salary','$95,000-$120,000 / year');
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#job-records-design').getAttribute('aria-busy')!=='true');
  const saved=(await app.request('DOCK_RECORDS_STATE')).jobs.find(item=>item.id===record.id);assert.equal(saved.salary,'$95,000-$120,000 / year');assert.equal(saved.status,'Ready');assert.ok(saved.resume.snapshot);
  await app.click('[data-command="back"]');assert.equal(app.$(`[data-id="${record.id}"] .jr-card-salary`).textContent,saved.salary);
});

test('opening a job detail defaults to the complete job description and preserves safe listing links',async t=>{
  const app=await view(t),description='About the role\n\nResponsibilities\n• Build accessible tools.\n• Review <script>example</script> text.\n\n'+('Additional job context. '.repeat(90));
  const created=await app.create(),result=await app.mutate('update',created,{...created,description,conversationUrl:''}),record=result.jobs.find(job=>job.id===created.id);
  await app.api.select(record.id);
  assert.equal(app.$('.jr-toolbar').hidden,true);
  assert.equal(app.$('.jr-detail-heading').nextElementSibling.id,'jr-detail-actions');
  assert.equal(app.$('#jr-details-pane #jr-detail-actions'),null);
  assert.ok(app.$('#jr-edit-slot [data-command="edit"]'));
  assert.deepEqual([...app.$('.jr-detail-subnav').children].map(tab=>tab.textContent),['Job description','Details']);assert.equal(app.$('#jr-view-description').getAttribute('aria-selected'),'true');assert.equal(app.$('#jr-description-pane').hidden,false);assert.equal(app.$('#jr-details-pane').hidden,true);
  assert.equal(app.$('.jr-description-copy').textContent,record.description);assert.equal(app.$('#jr-description-content script'),null);assert.equal(app.$('.jr-source-link').href,record.url);assert.equal(app.$('.jr-source-link').target,'_blank');
  assert.equal(app.$('#jr-detail-status').hidden,true);assert.equal(app.$('#jr-detail-candidate').nextElementSibling.id,'jr-detail-updated');assert.equal(app.$('#jr-edit-form').hidden,false);assert.equal(app.$('#jr-letter-input').disabled,true);assert.equal(app.$('#jr-queue-status-field').hidden,true);
  await app.click('#jr-view-details');assert.equal(app.$('#jr-details-pane').hidden,false);await app.remount();assert.equal(app.$('#jr-description-pane').hidden,false);
  await app.click('[data-command="back"]');assert.equal(app.$('.jr-toolbar').hidden,false);await app.click(`[data-id="${record.id}"] .jr-card-main`);assert.equal(app.$('#jr-details-pane').hidden,false);
});

test('queue cards update resumes in the CV modal, expose imported letters and delete with Undo',async t=>{
  const app=await view(t),job=await app.create();app.deps.resumeExports={start:async(record,options)=>({id:options.ticketId,phase:'settled',pending:false,message:'Saved',files:[{kind:'cv',state:'complete',filename:'resume.pdf'}]})};app.restart();await app.api.show('queue');assert.ok(app.$(`[data-id="${job.id}"] [data-command="delete"]`));assert.equal(app.$(`[data-id="${job.id}"] [data-command="cover-letter"]`).disabled,true);
  await app.click(`[data-id="${job.id}"] [data-command="update-resume"]`);assert.equal(app.$('#jr-cv-dialog').open,true);
  app.enter('#jr-cv-input',JSON.stringify({company:'Imported Company',title:'Imported Engineer',summary:'Saved CV.',skills:[],experience:[],education:[]}));app.$('#jr-cv-letter-toggle').click();app.enter('#jr-cv-letter','A separately imported cover letter.');await until(()=>!app.$('#jr-cv-update').disabled);
  await app.click('[data-cv-action="folder"]');await until(()=>app.$('#jr-cv-folder-name').value==='Test exports');app.$('#jr-cv-update').click();await until(()=>app.$(`[data-id="${job.id}"] .jr-company h3`)?.textContent==='Imported Company');assert.equal(app.$(`[data-id="${job.id}"] [data-command="cover-letter"]`).disabled,false);
  app.$('[data-cv-action="cancel"]').click();await app.click(`[data-id="${job.id}"] [data-command="delete"]`);assert.equal(app.$('#jr-queue-count').textContent,'0');await app.click('[data-command="undo-delete"]');assert.equal(app.$('#jr-queue-count').textContent,'1');
});

test('Applications and Job Queues switch immediately while UI saves are pending and coalesce rapid changes',async t=>{
  const app=await view(t),original=app.browser.storage.session.set,writes=[],finish=[];
  app.browser.storage.session.set=values=>{writes.push(structuredClone(values));return new Promise(resolve=>finish.push(resolve));};
  try{
    app.$('#jr-tab-queue').click();assert.equal(app.$('#jr-tab-queue').getAttribute('aria-selected'),'true');
    app.$('#jr-tab-applications').click();assert.equal(app.$('#jr-tab-applications').getAttribute('aria-selected'),'true');
    app.$('#jr-tab-queue').click();assert.equal(app.$('#jr-tab-queue').getAttribute('aria-selected'),'true');assert.equal(writes.length,1);
    finish.shift()();await until(()=>writes.length===2);assert.equal(Object.values(writes[1])[0].tab,'queue');finish.shift()();await delay(5);assert.equal(writes.length,2);
  }finally{for(const resolve of finish)resolve();app.browser.storage.session.set=original;}
});

test('a lost records response releases the view and leaves tab and Dashboard navigation usable',async t=>{
  const f=await dockFixture(t),page=new Window(),host=page.document.createElement('div');page.document.body.append(host);let dashboard=0;
  f.browser.runtime.sendMessage=()=>new Promise(()=>{});
  const api=mountJobRecords(host,{browser:f.browser,privateStorage:f.storage,requestTimeoutMs:20,onDashboard:()=>dashboard++});t.after(async()=>{api.close();await page.happyDOM.abort();});
  await api.ready;assert.match(host.querySelector('#jr-feedback').textContent,/did not respond/);
  host.querySelector('#jr-tab-queue').click();assert.equal(host.querySelector('#jr-tab-queue').getAttribute('aria-selected'),'true');
  host.querySelector('[data-command="dashboard"]').click();assert.equal(dashboard,1);assert.notEqual(api.root.getAttribute('aria-busy'),'true');
});

test('Dashboard back navigation is immediate even when saving queue state fails',async t=>{
  let dashboard=0;const app=await view(t,{onDashboard:()=>dashboard++});
  app.browser.storage.session.set=async()=>{throw Error('Storage unavailable');};
  app.$('[data-command="dashboard"]').click();assert.equal(dashboard,1,'Returning to Dashboard must not wait for storage');
  await delay(10);assert.match(app.$('#jr-feedback').textContent,/Unsaved edits remain/);
});

test('dock tiles show pending queue counts and meeting actions without the old summary or quick-action counts',async t=>{
  const page=new Window();page.document.body.innerHTML=DASHBOARD_MARKUP;const root=page.document.querySelector('#at-reference-dock'),f=await dockFixture(t);
  await f.browser.storage.local.set({appliedList:createMeetingSamples()});
  f.browser.runtime.sendMessage=async message=>({ok:true,result:message.operation==='DOCK_RECORDS_STATE'?{jobs:[{id:'one',status:'Ready'},{id:'two',status:'Queued'}],applications:[]}:{candidate:null,candidates:[]}});
  let selected,attention;
  const close=mountReferenceDashboard(root,f.browser,{privateStorage:f.storage,onApplications:tab=>{selected=tab;},onMeetings:needed=>{attention=needed;}});t.after(async()=>{close();await page.happyDOM.abort();});
  await until(()=>root.querySelector('.rd-stat-resume strong').textContent==='2');
  assert.ok(root.querySelector('.rd-stats').firstElementChild.classList.contains('rd-stat-applications'));
  assert.equal(root.querySelector('.rd-stat-resume .rd-stat-label').textContent,'Pending');
  assert.equal(root.querySelector('.rd-stat-resume svg').classList.contains('lucide-file-text'),true);
  assert.equal(root.querySelector('.rd-queue-summary,.rd-action-count'),null);
  assert.equal(root.querySelector('.rd-stat-meetings').dataset.needsAction,'true');
  assert.equal(root.querySelector('.rd-stat-hint'),null);
  root.querySelector('.rd-stat-resume').click();await until(()=>selected==='queue');
  root.querySelector('.rd-stat-meetings').click();await until(()=>attention===true);
  assert.match(root.querySelector('.rd-logo img').src,/icon\.png$/);
});

test('dock logo opens the web Dashboard and reuses its existing tab',async t=>{
  const page=new Window();page.document.body.innerHTML=DASHBOARD_MARKUP;const root=page.document.querySelector('#at-reference-dock'),f=await dockFixture(t);
  f.browser.runtime.sendMessage=async()=>({ok:true,result:{candidate:null,candidates:[]}});
  const close=mountReferenceDashboard(root,f.browser);t.after(async()=>{close();await page.happyDOM.abort();});
  const logo=root.querySelector('button.rd-brand');assert.equal(logo.getAttribute('aria-label'),'Open Dashboard');logo.querySelector('img').dispatchEvent(new page.MouseEvent('click',{bubbles:true}));
  await until(()=>f.tabs.length===1);assert.equal(f.tabs[0].url,f.browser.runtime.getURL('options.html')+'#/dashboard');
  await until(()=>!logo.disabled);let activated;
  f.browser.tabs.query=async()=>[{id:44,url:f.tabs[0].url}];f.browser.tabs.update=async(id,options)=>{activated={id,...options};};logo.click();await until(()=>activated);
  assert.equal(activated.id,44);assert.equal(activated.active,true);assert.equal(f.tabs.length,1);
});

test('dock Applications opens its internal workspace and the original dashboard remains mounted',async t=>{
  const page=new Window();page.document.body.innerHTML=DASHBOARD_MARKUP;const root=page.document.querySelector('#at-reference-dock');let opened;
  const f=await dockFixture(t),previous=globalThis.document;globalThis.document=page.document;
  f.browser.runtime.sendMessage=async()=>({ok:true,result:{candidate:null,candidates:[]}});
  const close=mountReferenceDashboard(root,f.browser,{onApplications:async(tab,url)=>{opened={tab,url};}});
  try{await delay(10);root.querySelector('[data-action="Applications"]').click();await until(()=>opened);assert.deepEqual(opened,{tab:'applications',url:undefined});assert.equal(f.tabs.length,0);assert.ok(root.querySelector('.rd-main'));}
  finally{close();globalThis.document=previous;await page.happyDOM.abort();}
});

test('actual dock entry point switches to the workspace and back without navigating a web page',async t=>{
  const page=new Window({settings:{disableIframePageLoading:true}}),f=await dockFixture(t),previous={document:globalThis.document,window:globalThis.window,chrome:globalThis.chrome};
  page.document.body.innerHTML='<div id="native-panel-root"></div>';globalThis.document=page.document;globalThis.window=page;globalThis.chrome=f.browser;
  f.browser.runtime.sendMessage=async message=>{try{return{ok:true,requestId:message.requestId,result:message.operation==='DASHBOARD_STATE'?{candidate:await f.deps.profiles.bootstrap(),candidates:[]} : message.operation==='DOCK_APPLY_STATE'?{candidate:{id:'candidate-1',name:'Test Candidate'},candidates:[],jobs:(await f.request('DOCK_RECORDS_STATE')).jobs,tabs:[],defaults:{},run:null}:await f.request(message.operation,message.payload)};}catch(error){return{ok:false,error:{message:error.message}};}};
  try{
    await f.browser.storage.session.set({'dock-records-ui:v1:41':{tab:'applications',layouts:{applications:'list',queue:'list'}}});
    const dispatch=f.browser.runtime.sendMessage;f.browser.runtime.onMessage={addListener(){},removeListener(){}};
    f.browser.runtime.sendMessage=async message=>message.type==='native-panel:request'?{ok:true,result:message.action==='context'?{windowId:41}:message.action==='take-view'?{}:await dispatch(message.envelope)}:dispatch(message);
    await import('../extension/sidepanel.js');await until(()=>page.document.documentElement.dataset.panelReady==='true');
    page.document.querySelector('[data-action="Applications"]').click();await until(()=>page.document.querySelector('#jr-app-count')?.textContent==='1');
    assert.equal(page.document.querySelector('.rd-main').hidden,true);assert.equal(page.document.querySelector('#job-records-design').hidden,false);
    assert.equal(page.document.querySelector('#job-records-design').dataset.layout,'cards','The dock ignores old saved List preferences');
    assert.equal(page.document.querySelector('.jr-view-toolbar,.jr-record-table'),null);
    assert.equal(page.document.querySelector('.jr-tabs').hidden,true,'Applications no longer exposes a queue tab');
    assert.equal(page.document.querySelector('.jr-header h2').textContent,'Applications');
    page.document.querySelector('[data-command="manage"]').click();
    assert.deepEqual([...page.document.querySelectorAll('.jr-manage-menu [role=menuitem]')].filter(button=>!button.hidden).map(button=>button.textContent),['Add','Delete']);
    page.document.querySelector('[data-command="dashboard"]').click();await until(()=>!page.document.querySelector('.rd-main').hidden);
    page.document.querySelector('[data-action="Apply to Job"]').click();await until(()=>page.document.querySelector('#at-reference-dock').dataset.dockView==='apply');
    const frame=page.document.querySelector('.dock-ai-apply-frame');assert.ok(frame);assert.equal(page.document.querySelector('#apply-ready-queue-design'),null);
    await until(()=>frame.src.includes('windowId='));const url=new URL(frame.src);
    page.dispatchEvent(new page.MessageEvent('message',{source:frame.contentWindow,origin:'chrome-extension://dock-test',data:{type:'ai-apply.ready',nonce:url.searchParams.get('nonce')}}));await delay(5);
    page.document.querySelector('.dock-ai-apply .dock-workspace-header button').click();assert.equal(page.document.querySelector('.rd-main').hidden,false);
    assert.equal(page.document.querySelector('#job-records-design').hidden,true);assert.equal(f.tabs.length,0);
    page.document.querySelector('.rd-stat-resume').click();await until(()=>page.document.querySelector('#at-reference-dock').dataset.dockView==='apply');assert.equal(page.document.querySelectorAll('.dock-ai-apply-frame').length,1);
  }finally{page.dispatchEvent(new page.Event('pagehide'));for(const[name,value]of Object.entries(previous))globalThis[name]=value;await page.happyDOM.abort();}
});
