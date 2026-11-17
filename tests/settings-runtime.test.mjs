import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {memoryStorage} from './helpers/dock-records-fixture.mjs';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';
import {createDockState} from '../extension/studio/dock-state.js';
import {mountDockDashboard} from '../extension/studio/dock-dashboard-view.js';
import {normalizeDocumentSettings,patchDocumentSettings} from '../extension/ai-apply/src/document-settings.mjs';
import {selectedDocumentSettings} from '../extension/ai-apply/src/generation-selection.mjs';
import {AUTOFILL_SETTINGS_KEY} from '../extension/studio/autofill-settings.js';
import {answerBatchPrompt} from '../extension/studio/question-answer-chat.js';

test('document and prompt checkboxes share one selection without changing an existing request snapshot',()=>{
 const original=normalizeDocumentSettings({selectedModules:['job','resume','coverLetter'],includeCoverLetter:false,formats:['pdf','json']});assert.equal(original.includeCoverLetter,true);
 const off=patchDocumentSettings(original,{includeCoverLetter:false});assert.deepEqual(off.selectedModules,['job','resume']);assert.equal(selectedDocumentSettings(null,off).includeCoverLetter,false);assert.deepEqual(original.selectedModules,['job','resume','coverLetter']);
 const onlyLetter=patchDocumentSettings(off,{selectedModules:['coverLetter']});assert.equal(onlyLetter.includeResume,false);assert.equal(onlyLetter.includeJobAnalysis,false);assert.equal(onlyLetter.includeCoverLetter,true);assert.deepEqual(onlyLetter.formats,['pdf','json']);
 assert.deepEqual(patchDocumentSettings(onlyLetter,{includeCoverLetter:false}).selectedModules,[]);
});

test('dock state restores per-window navigation, falls back after browser restart and ignores a late initial read',async()=>{
 const local=memoryStorage({}),session=memoryStorage({}),browser={windows:{getCurrent:async()=>({id:41})},storage:{local,session}};
 const first=createDockState({browser,scope:'dock'});await first.ready;await first.patch({view:'meetings'});
 assert.equal((await createDockState({browser,scope:'dock'}).ready).view,'meetings');
 const other=createDockState({browser,scope:'dock',windowId:42});assert.equal((await other.ready).view,'meetings');await other.patch({view:'apply'});
 assert.equal((await createDockState({browser,scope:'dock',windowId:41}).ready).view,'meetings');
 assert.equal((await createDockState({browser:{...browser,storage:{local,session:memoryStorage({})}},scope:'dock',windowId:99}).ready).view,'apply');
 const race=createDockState({browser,scope:'dock'});await race.patch({view:'applications'});assert.equal((await race.ready).view,'applications');
});

test('closing and mounting the dock restores Applications while an explicit navigation request takes precedence',async t=>{
 const app=await applyFixture(t),page=new Window({settings:{disableIframePageLoading:true}});t.after(()=>page.happyDOM.abort());const host=page.document.createElement('main');page.document.body.append(host);
 app.browser.runtime.sendMessage=async message=>({ok:true,result:message.operation==='DASHBOARD_STATE'?{candidate:null,candidates:[]}:await app.recordsRequest(message.operation,message.payload)});
 let dock=mountDockDashboard(host,{browser:app.browser,privateStorage:app.storage});t.after(()=>dock.close());await dock.ready;await dock.showApplications();
 host.querySelector('.jr-card-main').click();for(let i=0;i<100&&host.querySelector('#jr-detail').hidden;i++)await new Promise(resolve=>setTimeout(resolve,5));const selected=host.querySelector('#jr-detail-company').textContent;assert.ok(selected);dock.close();await new Promise(resolve=>setTimeout(resolve,10));
 dock=mountDockDashboard(host,{browser:app.browser,privateStorage:app.storage});await dock.ready;assert.equal(dock.root.dataset.dockView,'applications');assert.equal(host.querySelector('#jr-detail-company').textContent,selected);assert.equal(host.querySelector('#jr-detail').hidden,false);dock.close();
 const explicit=mountDockDashboard(host,{browser:app.browser,privateStorage:app.storage,initialView:'meetings'});await explicit.ready;assert.equal(explicit.root.dataset.dockView,'meetings');explicit.close();
});

test('Autofill consumes profile reusable answers and reloads the latest reuse and recording settings',async t=>{
 const app=await applyFixture(t),page=app.employer('<form><label>Available notice period<input id="notice" required></label><label>First name<input id="first"></label></form>'),job=await app.create();
 app.profiles.get('candidate-1').document.customAnswers=[{id:'notice',question:'Available notice period',answer:'Two weeks'}];
 await app.start(job);let run=await app.settled();assert.equal(page.page.document.querySelector('#notice').value,'Two weeks');
 await app.browser.storage.local.set({[AUTOFILL_SETTINGS_KEY]:{reuse:false,saveAnswers:false,record:false}});page.page.document.querySelector('#notice').value='';
 await app.action(run,'rescan');run=await app.settled();assert.equal(page.page.document.querySelector('#notice').value,'');assert.equal(run.options.reuse,false);
 const result=await app.action(run,'confirm-submission');assert.equal(result.run.phase,'submitted');assert.equal(app.browser.storage.local.values.appliedList.length,1);assert.ok((await app.recordsRequest('DOCK_RECORDS_STATE')).jobs.some(row=>row.id===job.id));
});

test('Save answers controls whether reviewed Fill all answers are learned',async t=>{
 const app=await applyFixture(t),page=app.employer('<form><label>Notice period<input id="notice" required></label></form>'),job=await app.create(),inspection=await app.request('DOCK_APPLY_INSPECT'),field=inspection.fields[0];
 await app.request('DOCK_APPLY_START',{jobId:job.id,tabId:7,fieldKeys:[field.key],answers:{[field.key]:'Two weeks'}});let run=await app.settled();const key='dock-approved-answers:v1:candidate-1';assert.equal((await app.storage.get(key))[key]['text:notice period'].answer,'Two weeks');
 await app.browser.storage.local.set({[AUTOFILL_SETTINGS_KEY]:{reuse:false,saveAnswers:false,record:true}});page.page.document.querySelector('#notice').value='';await app.action(run,'rescan',{fieldKeys:[field.key],answers:{[field.key]:'One month'}});await app.settled();assert.equal((await app.storage.get(key))[key]['text:notice period'].answer,'Two weeks');
});

test('saved Autofill application instructions reach the question prompt without adding resume or contact sources',()=>{
 const result=answerBatchPrompt({input:{job:{company:'Example'},autofillInstructions:'Use {{candidate_full_name}}. Keep answers brief.',promptValues:{candidate_full_name:'Jordan'},profile:{contact:{email:'private@example.test'}}}},[{key:'why',label:'Why this role?',type:'textarea'}],'run',{autofill:'Write as the candidate.'});
 assert.match(result.prompt,/APPLICATION INSTRUCTIONS\nUse Jordan\. Keep answers brief\./);assert.doesNotMatch(result.prompt,/private@example.test/);
});
