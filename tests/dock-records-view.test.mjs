import assert from 'node:assert/strict';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { Window } from 'happy-dom';
import { dockFixture } from './helpers/dock-records-fixture.mjs';
import { mountJobRecords } from '../extension/studio/job-records-view.js';
import { JOB_RECORDS_MARKUP } from '../extension/studio/job-records-markup.js';
import { DASHBOARD_MARKUP } from '../extension/studio/reference-dashboard-markup.js';
import { mountReferenceDashboard } from '../extension/studio/reference-dashboard.js';

async function until(condition) { for(let i=0;i<200;i++){if(condition())return;await delay(5);}throw Error('The dock did not settle.'); }
async function view(t,options={}) {
  const f=await dockFixture(t),page=new Window({settings:{disableJavaScriptEvaluation:true}});page.document.body.innerHTML='<div id="host"></div>';
  let api;
  const serviceRequest=f.request;
  f.browser.runtime.sendMessage=async message=>{if(message.target)return{ok:true};try{return{ok:true,requestId:message.requestId,result:await serviceRequest(message.operation,message.payload)};}catch(error){return{ok:false,requestId:message.requestId,error:{code:error.code,message:error.message}};}};
  const host=page.document.getElementById('host'),$=selector=>host.querySelector(selector),click=async selector=>{assert.ok($(selector),selector);$(selector).click();await until(()=>$('section')&&$('#job-records-design').getAttribute('aria-busy')!=='true');await delay(10);};
  const enter=(selector,value)=>{const node=$(selector);assert.ok(node,selector);node.value=value;node.dispatchEvent(new page.Event('input',{bubbles:true}));};
  const mount=async()=>{api=mountJobRecords(host,{browser:f.browser,privateStorage:f.storage,...options});await api.ready;};
  await mount();t.after(async()=>{api.close();await page.happyDOM.abort();});
  return {...f,page,host,$,click,enter,remount:async()=>{api.close();await delay(10);await mount();},get api(){return api;}};
}

test('dock HTML uses the reference layout, real records, and keeps edits across tabs and reopening',async t=>{
  const app=await view(t);
  assert.equal(app.$('#jr-app-count').textContent,'1');assert.equal(app.$('#jr-queue-count').textContent,'0');assert.ok(!app.host.textContent.includes('Morgan Taylor'));assert.ok(!JOB_RECORDS_MARKUP.includes('<script'));
  await app.click('[data-command="view"]');await app.click('#jr-view-details');await app.click('#jr-detail-actions [data-command="edit"]');
  app.enter('#jr-note-input','Keep this unsaved note');
  await app.click('#jr-view-description');await app.click('#jr-view-details');assert.equal(app.$('#jr-note-input').value,'Keep this unsaved note');
  await app.click('#jr-tab-queue');await app.click('#jr-tab-applications');await app.click('[data-command="edit"]');assert.equal(app.$('#jr-note-input').value,'Keep this unsaved note');
  await app.remount();assert.equal(app.$('#jr-note-input').value,'Keep this unsaved note');assert.equal(app.$('#jr-edit-form').hidden,false);
  app.$('#jr-status-select').value='interview';app.$('#jr-status-select').dispatchEvent(new app.page.Event('change',{bubbles:true}));
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-record-note').textContent==='Keep this unsaved note');
  assert.equal(app.browser.storage.local.values.appliedList[0].status,'interview');
});

test('dock job creation, job description, failed-job undo and application submission use persistent records',async t=>{
  const app=await view(t);await app.click('[data-command="add"]');
  for(const [name,value]of Object.entries({company:'Widget Labs',role:'Engineer',url:'https://example.test/new',description:'Build useful products.'}))app.enter(`#jr-add-form [name="${name}"]`,value);
  app.$('#jr-add-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-detail-company').textContent==='Widget Labs');
  assert.equal(app.$('#jr-queue-count').textContent,'1');
  assert.equal(app.$('#jr-description-pane').hidden,false);assert.equal(app.$('.jr-description-copy').textContent,'Build useful products.');await app.click('#jr-view-details');
  await app.click('[data-command="fail"]');await app.click('#jr-detail-actions [data-command="delete"]');assert.equal(app.$('#jr-queue-count').textContent,'0');
  await app.click('[data-command="undo-delete"]');assert.equal(app.$('#jr-queue-count').textContent,'1');await app.click('#jr-detail-actions [data-command="retry"]');
  let record=(await app.request('DOCK_RECORDS_STATE')).jobs[0];record=await app.ready(record);await app.api.refresh();
  assert.equal(app.$('#jr-detail-status').hidden,false);assert.equal(app.$('#jr-detail-status').textContent,'Ready');
  await app.click('#jr-view-description');assert.equal(app.$('.jr-description-copy').textContent,'Build useful products.');assert.ok(!app.$('#jr-description-pane').textContent.includes('Real saved summary'));
  await app.click('#jr-view-details');await app.click('[data-command="mark-applied"]');assert.equal(app.$('#jr-app-count').textContent,'2');assert.equal(app.$('#jr-queue-count').textContent,'0');
  assert.equal(app.browser.storage.local.values.appliedList.length,2);assert.equal(app.tabs.length,0);
});

test('dock blocks stale application saves and retains unsaved edit text',async t=>{
  const app=await view(t);
  await app.click('[data-command="view"]');await app.click('#jr-view-details');await app.click('#jr-detail-actions [data-command="edit"]');app.enter('#jr-note-input','Retained conflict text');
  const raw=app.browser.storage.local.values.appliedList.map(item=>({...item,status:'offer'}));await app.browser.storage.local.set({appliedList:raw});await delay(20);
  app.$('#jr-edit-form').dispatchEvent(new app.page.Event('submit',{bubbles:true,cancelable:true}));await until(()=>app.$('#jr-feedback').dataset.error==='true');
  assert.equal(app.$('#jr-note-input').value,'Retained conflict text');assert.equal(app.browser.storage.local.values.appliedList[0].status,'offer');
});

test('queue cards offer Go to apply for every status and View resume opens that job in Studio',async t=>{
  const applied=[],app=await view(t,{onApply:id=>applied.push(id)}),queued=await app.create('queued'),ready=await app.ready(await app.create('ready'));
  await app.api.show('queue');
  for(const record of [queued,ready]){
    const card=app.$(`[data-id="${record.id}"]`);assert.ok(card.classList.contains('jr-queue-record'));assert.equal(card.querySelector('[data-command="apply"]').textContent,'Go to apply');
    await app.click(`[data-id="${record.id}"] [data-command="apply"]`);assert.equal(applied.at(-1),record.id);
  }
  assert.equal(app.$(`[data-id="${queued.id}"] [data-command="update-resume"]`).textContent,'Update resume');
  const savedJson=ready.resume.cvJsonRaw,current=(await app.deps.drafts.read()).draft;await app.deps.drafts.save({draft:{...current,cvJsonRaw:'Current unsaved CV text'},expectedRevision:current.revision});
  let opened=0;app.deps.openStudio=async()=>{opened++;return{tabId:100};};app.restart();
  await app.click(`[data-id="${ready.id}"] [data-command="open-resume"]`);assert.equal(opened,1);const restored=(await app.deps.drafts.read()).draft;assert.equal(restored.cvJsonRaw,savedJson);assert.equal(restored.jobInputRaw,`${ready.url}\n${ready.description}`);
  assert.equal(app.$('#jr-list').hidden,false,'Opening Studio does not replace the queue with an inline preview');assert.equal(app.tabs.length,0);
});

test('opening a job detail defaults to the complete job description and preserves safe listing links',async t=>{
  const app=await view(t),description='About the role\n\nResponsibilities\n• Build accessible tools.\n• Review <script>example</script> text.\n\n'+('Additional job context. '.repeat(90));
  const created=await app.create(),result=await app.mutate('update',created,{...created,description,conversationUrl:''}),record=result.jobs.find(job=>job.id===created.id);
  await app.api.select(record.id);
  assert.deepEqual([...app.$('.jr-detail-subnav').children].map(tab=>tab.textContent),['Job description','Details']);assert.equal(app.$('#jr-view-description').getAttribute('aria-selected'),'true');assert.equal(app.$('#jr-description-pane').hidden,false);assert.equal(app.$('#jr-details-pane').hidden,true);
  assert.equal(app.$('.jr-description-copy').textContent,record.description);assert.equal(app.$('#jr-description-content script'),null);assert.equal(app.$('.jr-source-link').href,record.url);assert.equal(app.$('.jr-source-link').target,'_blank');
  assert.equal(app.$('#jr-detail-status').hidden,true);assert.equal(app.$('#jr-detail-updated').nextElementSibling.id,'jr-detail-role');
  await app.click('#jr-view-details');assert.equal(app.$('#jr-details-pane').hidden,false);await app.remount();assert.equal(app.$('#jr-description-pane').hidden,false);
  await app.click('[data-command="back"]');await app.click(`[data-id="${record.id}"] [data-command="view"]`);assert.equal(app.$('#jr-description-pane').hidden,false);
});

test('queue cards update resumes in the CV modal, expose imported letters and delete with Undo',async t=>{
  const app=await view(t),job=await app.create();await app.api.show('queue');assert.ok(app.$(`[data-id="${job.id}"] [data-command="delete"]`));assert.equal(app.$(`[data-id="${job.id}"] [data-command="cover-letter"]`),null);
  await app.click(`[data-id="${job.id}"] [data-command="update-resume"]`);assert.equal(app.$('#jr-cv-dialog').open,true);
  app.enter('#jr-cv-input',JSON.stringify({company:'Imported Company',title:'Imported Engineer',summary:'Saved CV.',skills:[],experience:[],education:[]}));app.$('#jr-cv-letter-toggle').click();app.enter('#jr-cv-letter','A separately imported cover letter.');await until(()=>!app.$('#jr-cv-update').disabled);
  app.$('#jr-cv-update').click();await until(()=>app.$(`[data-id="${job.id}"] .jr-company h3`)?.textContent==='Imported Company');assert.ok(app.$(`[data-id="${job.id}"] [data-command="cover-letter"]`));
  app.$('[data-cv-action="cancel"]').click();await app.click(`[data-id="${job.id}"] [data-command="delete"]`);assert.equal(app.$('#jr-queue-count').textContent,'0');await app.click('[data-command="undo-delete"]');assert.equal(app.$('#jr-queue-count').textContent,'1');
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
  const page=new Window(),f=await dockFixture(t),previous={document:globalThis.document,window:globalThis.window,chrome:globalThis.chrome};
  page.document.body.innerHTML='<div id="reference-dashboard-root"></div>';globalThis.document=page.document;globalThis.window=page;globalThis.chrome=f.browser;
  f.browser.runtime.sendMessage=async message=>{try{return{ok:true,requestId:message.requestId,result:message.operation==='DASHBOARD_STATE'?{candidate:await f.deps.profiles.bootstrap(),candidates:[]} : await f.request(message.operation,message.payload)};}catch(error){return{ok:false,error:{message:error.message}};}};
  try{
    await import('../extension/dashboard.js');await delay(20);
    page.document.querySelector('[data-action="Applications"]').click();await until(()=>page.document.querySelector('#jr-app-count')?.textContent==='1');
    assert.equal(page.document.querySelector('.rd-main').hidden,true);assert.equal(page.document.querySelector('#job-records-design').hidden,false);
    page.document.querySelector('[data-command="dashboard"]').click();await until(()=>!page.document.querySelector('.rd-main').hidden);
    assert.equal(page.document.querySelector('#job-records-design').hidden,true);assert.equal(f.tabs.length,0);
  }finally{page.dispatchEvent(new page.Event('pagehide'));for(const[name,value]of Object.entries(previous))globalThis[name]=value;await page.happyDOM.abort();}
});
