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
async function fixture(t,{selected=job,state,handle,studio={}}={}){
  const win=new Window({url:'chrome-extension://test/ai-apply/index.html?windowId=41&nonce=test'});win.document.write(await readFile('extension/ai-apply/index.html','utf8'));
  const previous=globalThis.document;globalThis.document=win.document;const calls=[],messages=event(),active=event(),updated=event();let tick;
  win.setInterval=callback=>{tick=callback;return 1;};win.clearInterval=()=>{};
  const current={candidate:{id:'profile'},run:null,tabs:[{id:7,windowId:41,url:job.input.job.url,active:true}],...state};
  const browser={runtime:{id:'test',onMessage:messages,sendMessage:async message=>{calls.push(message);return {ok:true,value:handle?await handle(message,current):message.operation==='DOCK_APPLY_INSPECT'?{fields:[],tabId:7,url:current.tabs[0]?.url}:structuredClone(current)};}},tabs:{onActivated:active,onUpdated:updated}};
  const controller=connectTrackerWorkspace({root:win.document,events:win,browser,studio:{ready:Promise.resolve(),selectedJob:()=>selected,...studio},queue:{subscribe:()=>()=>{},refresh:async()=>{}},selectView:()=>{},selectStudioTab:()=>{}});
  t.after(()=>{controller.close();globalThis.document=previous;return win.happyDOM.abort();});await delay(0);
  return {win,calls,current,controller,messages,active,updated,tick:()=>tick(),select:job=>{selected=job;},button:win.document.querySelector('[data-fill-start]'),draft:win.document.querySelector('[data-draft-ai]')};
}

test('native workspace restores two actions and an inline form bar without status messages or automatic filling',async t=>{
  const f=await fixture(t),host=f.win.document.querySelector('#apply-actions');assert.equal(host.querySelectorAll('button').length,2);
  assert.equal(f.draft.textContent.trim(),'Draft answers with AI');assert.equal(f.draft.disabled,true);assert.ok(host.querySelector('[data-form-review][open]'));
  assert.equal(host.querySelector('dialog,[data-open-autofill],[data-profile-settings],[role=status],[role=alert]'),null);
  assert.ok(f.calls.some(call=>call.operation==='DOCK_APPLY_INSPECT'));
  assert.ok(!f.calls.some(call=>call.operation==='DOCK_APPLY_START'||call.type==='ai-apply.tools'));
  await f.tick();await delay(0);assert.ok(f.calls.every(call=>['DOCK_APPLY_STATE','DOCK_APPLY_TRACK','DOCK_APPLY_INSPECT'].includes(call.operation)));
});

test('the single button starts the existing engine without field restrictions or opening a popup',async t=>{
  const f=await fixture(t);f.button.click();await until(()=>f.calls.some(call=>call.operation==='DOCK_APPLY_START'));
  const start=f.calls.find(call=>call.operation==='DOCK_APPLY_START');assert.equal(start.payload.jobId,job.id);assert.equal(start.payload.tabId,7);assert.equal(start.payload.windowId,41);assert.equal(start.payload.fieldKeys,undefined);assert.equal(start.payload.answers,undefined);
  assert.ok(f.calls.some(call=>call.operation==='DOCK_APPLY_INSPECT'));assert.equal(f.win.document.querySelector('dialog[open]'),null);
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
  f.button.click();await until(()=>f.button.title==='Employer page unavailable');assert.equal(f.button.disabled,false);assert.equal(f.win.document.querySelector('#apply-actions').querySelectorAll('button').length,2);
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

test('AI drafts selected unanswered questions, retrieves editable answers, then Autofill commits them through the existing engine',async t=>{
  const app=await applyFixture(t),savedJob=await app.ready(await app.create('ai-review')),employer=app.employer('<form><label>First name<input name="firstName" required></label><label>Why this role?<textarea name="why" required></textarea></label><label>Anything else?<textarea name="extra"></textarea></label></form>',savedJob.url);
  let complete=false,requested=[];
  const f=await fixture(t,{selected:{id:savedJob.id,state:'ready',input:{job:{url:savedJob.url}}},studio:{applyChatUrl:()=> 'https://chatgpt.com/c/saved-job'},handle:async message=>{
    if(message.type!=='ai-apply.tools')return app.request(message.operation,message.payload);
    if(message.payload.action==='chat.draft'){requested=message.payload.fields;assert.equal(message.payload.conversationUrl,'https://chatgpt.com/c/saved-job');return {id:'answer-batch',phase:'waiting'};}
    return {id:'answer-batch',phase:complete?'complete':'waiting',answers:requested.map(field=>({id:field.key,answer:'My AI answer',needsUser:false}))};
  }});
  await f.controller.refresh();f.button.click();await until(()=>app.sent.some(call=>call.message.action==='fill'));await app.settled();await f.controller.refresh();
  const host=f.win.document.querySelector('#apply-actions'),rows=()=>[...host.querySelectorAll('.tracker-form-row')];
  assert.equal(rows()[0].dataset.filled,'true');assert.equal(rows()[0].open,false);assert.equal(f.draft.disabled,false);
  f.draft.click();await until(()=>f.win.sessionStorage.getItem('tracker-form-answer-batch:v1:41'));
  assert.deepEqual(requested.map(field=>field.label),['Why this role?']);assert.equal(employer.page.document.querySelector('[name=why]').value,'');
  const extra=rows()[2].querySelector('textarea');extra.value='My optional answer';extra.dispatchEvent(new f.win.Event('input',{bubbles:true}));
  complete=true;await f.controller.refresh();assert.equal(rows()[1].querySelector('textarea').value,'My AI answer');assert.equal(rows()[1].dataset.filled,'false');
  assert.equal(employer.page.document.querySelector('[name=why]').value,'');assert.equal(f.win.sessionStorage.getItem('tracker-form-answer-batch:v1:41'),null);
  rows()[1].open=true;rows()[2].open=true;const before=app.sent.filter(call=>call.message.action==='fill').length;f.button.click();await until(()=>app.sent.filter(call=>call.message.action==='fill').length>before);await app.settled();await f.controller.refresh();
  assert.equal(employer.page.document.querySelector('[name=why]').value,'My AI answer');assert.equal(employer.page.document.querySelector('[name=extra]').value,'My optional answer');
  assert.equal(rows()[1].dataset.filled,'true');assert.equal(rows()[1].open,false);assert.equal(rows()[2].open,false);assert.equal(f.draft.disabled,true);assert.equal(employer.submits(),0);
  assert.equal(host.querySelector('[role=status],[role=alert],dialog'),null);
});

test('a pending AI batch is not read into a different job or allowed to overwrite an answer typed while waiting',async t=>{
  let complete=false;
  const field={key:'document-7:why',label:'Why this role?',type:'textarea',required:true,filled:false,answer:''};
  const f=await fixture(t,{handle:async(message,current)=>message.type==='ai-apply.tools'?message.payload.action==='chat.draft'?{id:'batch',phase:'waiting'}:{id:'batch',phase:complete?'complete':'waiting',answers:[{id:field.key,answer:'AI draft'}]}:message.operation==='DOCK_APPLY_INSPECT'?{fields:[field],tabId:current.tabs[0].id,url:current.tabs[0].url}:structuredClone(current)});
  await f.controller.refresh();f.draft.click();await until(()=>f.win.sessionStorage.getItem('tracker-form-answer-batch:v1:41'));
  const input=f.win.document.querySelector('[data-answer-key]');input.value='My answer while waiting';input.dispatchEvent(new f.win.Event('input',{bubbles:true}));
  f.select({...job,id:'two',input:{job:{url:'https://employer.test/jobs/two'}}});f.current.tabs[0].url='https://employer.test/jobs/two';
  complete=true;const polls=f.calls.filter(call=>call.payload?.action==='chat.draft.status').length;await f.controller.refresh();
  assert.equal(f.calls.filter(call=>call.payload?.action==='chat.draft.status').length,polls);assert.equal(f.win.document.querySelector('[data-answer-key]').value,'');
  f.select(job);f.current.tabs[0].url=job.input.job.url;await f.controller.refresh();
  assert.equal(f.win.document.querySelector('[data-answer-key]').value,'My answer while waiting');assert.equal(f.win.sessionStorage.getItem('tracker-form-answer-batch:v1:41'),null);
});
