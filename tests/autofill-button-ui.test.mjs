import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {Window} from 'happy-dom';
import {connectTrackerWorkspace} from '../extension/ai-apply/src/autofill-workspace.mjs';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';
import {event} from './helpers/dock-records-fixture.mjs';

const until=async check=>{for(let i=0;i<100;i++){if(await check())return;await delay(5);}throw Error('Autofill did not settle.');};
const job={id:'one',state:'queued',input:{job:{url:'https://employer.test/jobs/one'}}};
async function fixture(t,{selected=job,state,handle}={}){
  const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41&nonce=test'});win.document.write(await readFile('extension/ai-apply/index.html','utf8'));
  const previous=globalThis.document;globalThis.document=win.document;const calls=[],messages=event(),active=event(),updated=event();let tick;
  win.setInterval=callback=>{tick=callback;return 1;};win.clearInterval=()=>{};
  const current={candidate:{id:'profile'},run:null,tabs:[{id:7,windowId:41,url:job.input.job.url,active:true}],...state};
  const browser={runtime:{id:'test',onMessage:messages,sendMessage:async message=>{calls.push(message);return {ok:true,value:handle?await handle(message,current):structuredClone(current)};}},tabs:{onActivated:active,onUpdated:updated}};
  const controller=connectTrackerWorkspace({root:win.document,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});
  t.after(()=>{controller.close();globalThis.document=previous;return win.happyDOM.abort();});await delay(0);
  return {win,calls,current,controller,messages,active,updated,tick:()=>tick(),button:win.document.querySelector('[data-fill-start]')};
}

test('Autofill renders one button without popup, helper text, profile settings or manual answer controls',async t=>{
  const f=await fixture(t),host=f.win.document.querySelector('#apply-actions');assert.equal(host.querySelectorAll('button').length,1);assert.equal(host.textContent.trim(),'Autofill');
  assert.equal(host.querySelector('dialog,input,textarea,select,[data-open-autofill],[data-profile-settings],[role=status],[role=alert]'),null);
  assert.ok(!f.calls.some(call=>['DOCK_APPLY_START','DOCK_APPLY_INSPECT'].includes(call.operation)||call.type==='ai-apply.tools'));
  await f.tick();await delay(0);assert.ok(f.calls.every(call=>['DOCK_APPLY_STATE','DOCK_APPLY_TRACK'].includes(call.operation)));
});

test('the single button starts the existing engine without field restrictions or opening a popup',async t=>{
  const f=await fixture(t);f.button.click();await until(()=>f.calls.some(call=>call.operation==='DOCK_APPLY_START'));
  const start=f.calls.find(call=>call.operation==='DOCK_APPLY_START');assert.equal(start.payload.jobId,job.id);assert.equal(start.payload.tabId,7);assert.equal(start.payload.windowId,41);assert.equal(start.payload.fieldKeys,undefined);assert.equal(start.payload.answers,undefined);
  assert.ok(!f.calls.some(call=>call.operation==='DOCK_APPLY_INSPECT'));assert.equal(f.win.document.querySelector('dialog[open]'),null);
});

test('an empty queue still autofills from the existing profile and switches an old run atomically',async t=>{
  const f=await fixture(t,{selected:null,state:{run:{id:'old',jobId:'other',tabId:8,phase:'filling'}}});assert.equal(f.button.disabled,false);f.button.click();await until(()=>f.calls.some(call=>call.operation==='DOCK_APPLY_START'));
  const start=f.calls.find(call=>call.operation==='DOCK_APPLY_START');assert.equal(start.payload.profileOnly,true);assert.equal(start.payload.replaceRunId,'old');assert.equal(start.payload.tabId,7);assert.equal(start.payload.fieldKeys,undefined);
});

test('retries and paused runs use the same button without restricting the fields',async t=>{
  for(const phase of ['questions','paused']){
    const f=await fixture(t,{state:{run:{id:phase,jobId:job.id,tabId:7,phase,fields:[]}}});f.button.click();await until(()=>f.calls.some(call=>call.operation==='DOCK_APPLY_ACTION'));
    const action=f.calls.find(call=>call.operation==='DOCK_APPLY_ACTION');assert.equal(action.payload.action,phase==='paused'?'resume':'rescan');assert.equal(action.payload.fieldKeys,undefined);
  }
});

test('submission status disables Autofill without inspecting or restarting the submitted application',async t=>{
  const f=await fixture(t,{selected:null,state:{submission:{tabId:7,phase:'submitting',url:job.input.job.url}}});assert.equal(f.button.textContent.trim(),'Submitting…');assert.equal(f.button.disabled,true);
  f.current.submission.phase='submitted';await f.controller.refresh();assert.equal(f.button.textContent.trim(),'Submitted');assert.equal(f.button.dataset.submissionStatus,'submitted');assert.equal(f.button.disabled,true);
  f.button.click();assert.ok(!f.calls.some(call=>['DOCK_APPLY_START','DOCK_APPLY_ACTION','DOCK_APPLY_INSPECT'].includes(call.operation)));
  f.current.tabs=[{id:8,active:true,url:'https://another.test/apply'}];await f.controller.refresh();assert.equal(f.button.disabled,false);assert.equal(f.button.textContent.trim(),'Autofill');
});

test('button errors stay available as a tooltip and disposed workspaces stop polling',async t=>{
  const f=await fixture(t,{handle:async message=>{if(message.operation==='DOCK_APPLY_START')throw Error('Employer page unavailable');return {candidate:{id:'profile'},tabs:[{id:7,url:job.input.job.url,active:true}],run:null};}});
  f.button.click();await until(()=>f.button.title==='Employer page unavailable');assert.equal(f.button.disabled,false);assert.equal(f.win.document.querySelector('#apply-actions').querySelectorAll('button').length,1);
  f.controller.close();const count=f.calls.length;f.tick();f.active.emit({windowId:41});await delay(0);assert.equal(f.calls.length,count);
});

test('direct button fills known facts and saved documents; confirmed submission is recorded exactly once',async t=>{
  const app=await applyFixture(t),savedJob=await app.ready(await app.create('single-button')),employer=app.employer(undefined,savedJob.url);
  const selected={id:savedJob.id,state:'ready',input:{job:{url:savedJob.url}}};
  const f=await fixture(t,{selected,handle:message=>app.request(message.operation,message.payload)});
  assert.equal(employer.page.document.querySelector('[name=firstName]').value,'');assert.equal(employer.submits(),0);
  f.button.click();await until(()=>app.sent.some(call=>call.message.action==='fill')).catch(error=>{throw Error(error.message+' '+f.button.title+' '+JSON.stringify(f.calls.map(call=>({op:call.operation,payload:call.payload}))));});await app.settled();
  assert.equal(employer.page.document.querySelector('[name=firstName]').value,'Jordan');assert.equal(employer.page.document.querySelector('[name=email]').value,'jordan@example.test');assert.equal(employer.uploads(),1);assert.equal(employer.submits(),0);
  const sender={id:app.browser.runtime.id,url:savedJob.url,frameId:0,documentId:'document-7',tab:{id:7,windowId:41,url:savedJob.url}};
  const emit=async value=>{const run=(await app.storage.get('dock-apply-run:v1:41'))['dock-apply-run:v1:41'];return app.pageEvent({runId:`${run.id}:${run.epoch||0}`,token:run.trackingToken,url:savedJob.url,...value},sender);};
  await emit({kind:'intent',action:'submit'});await f.controller.refresh();assert.equal(f.button.textContent.trim(),'Submitting…');
  employer.page.document.body.innerHTML='<h1>Thank you for applying</h1>';const receipt={kind:'receipt',text:'Thank you for applying'};
  await emit({kind:'state',scan:employer.form.scan(),receipt});await f.controller.refresh();assert.equal(f.button.textContent.trim(),'Submitted');assert.equal(f.button.disabled,true);
  const records=await app.recordsRequest('DOCK_RECORDS_STATE');assert.equal(records.applications.filter(row=>row.url===savedJob.url).length,1);
  await emit({kind:'state',scan:employer.form.scan(),receipt});assert.equal((await app.recordsRequest('DOCK_RECORDS_STATE')).applications.filter(row=>row.url===savedJob.url).length,1);
});
