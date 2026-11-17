import {configureMeetingWorkflow} from "../extension/studio/meeting-workflow-service.js";
import {initializeLocalApp} from "../extension/studio/initialize-local-app.js";
import {registerAIClipboard} from '../extension/studio/ai-clipboard-offscreen.js';
import {configureNativePanel} from '../extension/studio/native-panel-service.js';
import {createRecordPDFRenderer,registerDocumentPreviewRenderer} from '../extension/studio/document-preview-renderer.js';
import {createPromptRepository as createApplicationPromptRepository} from '../extension/studio/prompt-repository.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import test from 'node:test';
import { IDBFactory } from 'fake-indexeddb';
import { createStudioStorage } from '../extension/studio/storage.js';
import { openStudioDock, openDashboard } from '../extension/studio/dock.js';
import { createProfileRepository } from '../extension/studio/profile-repository.js';
import { emptyProfile } from '../extension/studio/profile-model.js';
import { openWebStudioPreview } from '../extension/studio/web-preview.js';
import { isPromptSettingsSender, PROMPT_SETTINGS_OPERATIONS } from '../extension/studio/settings-access.js';
import {configurePromptSettingsBridge} from '../extension/studio/prompt-settings-bridge.js';
import { buildPrompt } from '../extension/studio/prompt-settings.js';
import { requireEmbeddedEditor } from '../extension/studio/editor-access.js';
import { DASHBOARD_OPERATIONS, isNativeDockSender, WEB_RECORD_OPERATIONS, isWorkspaceRecordsSender, isSubmittedPreviewSender } from '../extension/studio/reference-dashboard-access.js';
import { handleCaptureHotkey } from '../extension/studio/capture-hotkey.js';
import { createDockRecordsService, DOCK_RECORD_OPERATIONS } from '../extension/studio/dock-records-service.js';
import {createQueueResumeExports} from '../extension/studio/queue-resume-export.js';
import { createDockApplyService, DOCK_APPLY_OPERATIONS } from '../extension/studio/dock-apply-service.js';
import { resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph } from '../extension/studio/resume-layout.js';
import {resumeRenderer} from './helpers/resume-renderer.mjs';
import {createSingleProfileService,isProfileSettingsSender,PROFILE_OPERATIONS} from '../extension/studio/single-profile-service.js';

test('the actual worker accepts native panel requests and retires the website message bridge',async t=>{
  const app=await coordinator(t),sender={id:app.chrome.runtime.id,url:app.chrome.runtime.getURL('sidepanel.html'),frameId:0,documentId:'native-document'};
  const previous=app.chrome.runtime.getContexts;app.chrome.runtime.getContexts=async filter=>filter.contextTypes?.includes('SIDE_PANEL')?[{documentId:'native-document',contextType:'SIDE_PANEL',windowId:-1}]:previous(filter);
  async function panel(operation,override={}){
    const message={type:'native-panel:request',windowId:41,action:'request',envelope:{version:1,requestId:'native-request',operation,payload:{}}};let accepted=false;
    const response=new Promise(resolve=>{for(const listener of app.chrome.runtime.onMessage.listeners)accepted=listener(message,{...sender,...override},resolve)||accepted;});return accepted?response:null;
  }
  const state=await panel('DASHBOARD_STATE');assert.equal(state.ok,true);assert.equal(state.result.result.candidate.document.candidate.name,'Existing Autofill profile');
  assert.equal((await panel('DOCK_RECORDS_STATE')).ok,true);
  assert.equal((await panel('DASHBOARD_STATE',{url:'https://example.test/job'})).ok,false);
  assert.equal((await panel('CANDIDATE_EXPORT_JSON')).ok,false);
  let accepted=false;for(const listener of app.chrome.runtime.onMessage.listeners)accepted=listener({type:'inline-dock:request'},{id:app.chrome.runtime.id,url:'https://example.test/job'},()=>{})||accepted;assert.equal(accepted,false);
});

function event() {
  const listeners = new Set();
  return { listeners, addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) };
}

function memoryStorage(initial = {}) {
  const values = structuredClone(initial);
  return {
    values,
    async get(keys = null) {
      if (keys === null) return structuredClone(values);
      const selected = typeof keys === 'string' ? [keys] : keys;
      return structuredClone(Object.fromEntries(selected.filter(key => Object.hasOwn(values, key)).map(key => [key, values[key]])));
    },
    async set(items) { Object.assign(values, structuredClone(items)); },
    async remove(keys) { for (const key of typeof keys === 'string' ? [keys] : keys) delete values[key]; },
    async getBytesInUse() { return new TextEncoder().encode(JSON.stringify(values)).length; },
    async setAccessLevel() { throw new Error('Shared Autofill storage must stay accessible to its content scripts.'); },
  };
}

async function coordinator(t, {withProfile=true}={}) {
  const studioStorage = createStudioStorage({ indexedDB: new IDBFactory(), BroadcastChannel: null });
  t.after(() => studioStorage.close());
  const createdTabs = [];
  const chrome = {
    sampleData:{enabled:true},
    runtime: {
      id: 'autofill-test', getURL: path => `chrome-extension://autofill-test/${path}`,
      getContexts: async filter => filter?.documentIds?.includes('editor-document') ? [{ documentId: 'editor-document', documentUrl: 'chrome-extension://autofill-test/workspace.html', frameId: 1, tabId: 100, windowId: 41 }] : [{ documentId: 'preview-document', documentUrl: 'chrome-extension://autofill-test/preview.html', frameId: 0, tabId: 100, windowId: 41 }], onMessage: event(), onConnect: event(), onInstalled: event(), onStartup: event(),
    },
    storage: { local: memoryStorage(withProfile?{ profile: { ...emptyProfile(), profileName: 'Existing Autofill profile' } }:{}), session: memoryStorage(), onChanged: event() },
    windows: { get: async id => ({ id, type: 'normal' }), onRemoved: event(), update: async () => {} },
    sidePanel: { setOptions:async()=>{}, setPanelBehavior: async () => {}, open: async () => {}, onClosed: event() },
    action: { onClicked:event(), setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: {
      onUpdated: event(), onRemoved: event(), onAttached: event(), query: async () => [],
      get: async id => ({ id, windowId: 41, url: 'chrome-extension://autofill-test/preview.html' }),
      update: async (id,input) => ({id,windowId:41,url:'chrome-extension://autofill-test/preview.html',...input}),
      create: async input => { createdTabs.push(input); return { id: 100, windowId: 41, ...input }; },
    },
    downloads: { search: async () => [], onChanged: event(), onCreated: event(), onErased: event() },
    commands: { onCommand: event() },
  };
  await chrome.storage.local.set({'meeting-mock-cards:v1':[],'meeting-mock-cards:version':6});
  const sandbox = vm.createContext({ resumeSectionOrder, skillsFirstTemplate, chrome, studioStorage, createProfileRepository, createDockRecordsService, saveDockApplication:async input=>{const raw=chrome.storage.local.values.appliedList||[];await chrome.storage.local.set({appliedList:[{jobTitle:input.jobTitle,jobLink:input.jobLink,companyName:input.companyName,companyLink:input.companyLink,profileName:input.profileDetails.profileName,status:'applied',date:input.appliedDate.toString()},...raw]});},syncDockApplication:async()=>{},deleteDockApplication:async()=>{},openWebStudioPreview, requireEmbeddedEditor, handleCaptureHotkey, DASHBOARD_OPERATIONS, WEB_RECORD_OPERATIONS,isSubmittedPreviewSender:sender=>isSubmittedPreviewSender(sender,chrome),isWorkspaceRecordsSender:sender=>isWorkspaceRecordsSender(sender,chrome),isNativeDockSender: sender => isNativeDockSender(sender, chrome), isPromptSettingsSender: sender => isPromptSettingsSender(sender, chrome), PROMPT_SETTINGS_OPERATIONS, crypto: webcrypto, TextEncoder, TextDecoder, URL, console, structuredClone, setTimeout, clearTimeout });
  Object.assign(sandbox,{buildStudioPrompt:buildPrompt,createRecordPDFRenderer,configureNativePanel,configurePromptSettingsBridge,configureAIApply:()=>({}),configureMeetingWorkflow,initializeLocalApp,parseResumeUpload:(input,{parse,fallback})=>(parse||fallback)(input),createSingleProfileService,isProfileSettingsSender:sender=>isProfileSettingsSender(sender,chrome),PROFILE_OPERATIONS,createApplicationPromptRepository,createQueueResumeExports,createDockApplyService,parseResumeFile:async()=>({}),generateDockAnswer:async()=>''});
  const source = (await readFile('extension/service-worker.js', 'utf8')).replace(/^import[^\n]+\n/gm, '');
  vm.runInContext(source, sandbox);
  const workspace = { id: chrome.runtime.id, url: chrome.runtime.getURL('workspace.html'), frameId: 1, documentId: 'editor-document', tab: { id: 100, windowId: 41 } };
  const identity = { workspaceId: '41', workspaceInstanceId: crypto.randomUUID() };
  async function request(operation, payload = {}, sender = workspace) {
    const message = { version: 1, requestId: crypto.randomUUID(), operation, payload, ...identity };
    let accepted = false;
    const response = new Promise(resolve => {
      for (const listener of chrome.runtime.onMessage.listeners) accepted = listener(message, sender, resolve) || accepted;
    });
    if (!accepted) return null;
    return structuredClone(await response);
  }
  const initial = await request('WORKSPACE_ATTACH', { visible: true });
  assert.equal(initial.ok, true, initial.error?.message);
  return { chrome, studioStorage, request, identity, createdTabs, sandbox, workspace };
}

test('the Profile page replaces a resume through the actual worker without creating another profile',async t=>{
  const app=await coordinator(t);app.sandbox.parseResumeFile=async()=>({nameData:{firstName:'Resume',lastName:'Person',preferredName:false},jobData:[],educationData:[],skillsData:['Testing']});
  const sender={id:app.chrome.runtime.id,url:app.chrome.runtime.getURL('options.html#/settings/profile'),frameId:0,tab:{id:7,windowId:41}};
  const initial=await app.request('PROFILE_STATE',{},sender);assert.equal(initial.ok,true,initial.error?.message);
  const updated=await app.request('PROFILE_RESUME_UPLOAD',{base64:'cGRm',fileName:'replacement.pdf',expectedRevision:initial.result.candidate.revision,mutationId:crypto.randomUUID()},sender);
  assert.equal(updated.ok,true,updated.error?.message);assert.equal(updated.result.candidate.id,initial.result.candidate.id);assert.equal(updated.result.candidate.profile.nameData.firstName,'Resume');assert.equal(app.chrome.storage.local.values.profile.resumeData.fileName,'replacement.pdf');
  const profiles=await app.request('DASHBOARD_STATE',{}, {id:app.chrome.runtime.id,url:app.chrome.runtime.getURL('sidepanel.html'),frameId:0});assert.equal(profiles.result.candidates.length,1);
  assert.equal(await app.request('PROFILE_STATE',{}, {...sender,url:'https://example.test/job'}),null);
  assert.equal(await app.request('PROFILE_STATE',{}, {...sender,url:app.chrome.runtime.getURL('options.html#/settings/prompts')}),null);
});

test('only the native dock can use Apply operations through the actual worker router',async t=>{
  const app=await coordinator(t),dock={id:app.chrome.runtime.id,url:app.chrome.runtime.getURL('sidepanel.html'),frameId:0};
  const reply=await app.request('DOCK_APPLY_STATE',{windowId:41},dock);assert.equal(reply.ok,true);assert.equal(reply.result.run,null);assert.equal(reply.result.jobs.length,0);
  for(const operation of DOCK_APPLY_OPERATIONS)for(const sender of [{...dock,url:app.chrome.runtime.getURL('options.html')},{...dock,url:'https://example.test/job'},{...dock,frameId:1}])assert.equal(await app.request(operation,{windowId:41},sender),null,`${operation}: rejected ${sender.url}`);
});

test('dock CV input uses the real CV validator and snapshot without replacing Studio text',async t=>{
  const {request,chrome,sandbox}=await coordinator(t),sender={id:chrome.runtime.id,url:chrome.runtime.getURL('sidepanel.html'),frameId:0};
  const created=await request('DOCK_RECORDS_MUTATE',{action:'create',mutationId:crypto.randomUUID(),fields:{company:'Original Company',role:'Original Role',url:'https://example.test/cv-input',description:'The original job description.'}},sender);assert.equal(created.ok,true);
  const job=created.result.jobs[0],before=(await request('STUDIO_BOOTSTRAP',{candidateId:job.candidateId})).result.record.draft,fields={cvJsonRaw:JSON.stringify({company:'Imported Company',title:'Imported Role',summary:'Prepared CV.',skills:[],experience:[],education:[]}),coverLetterRaw:'A separately imported letter.',coverLetterEnabled:true};
  const invalid=await request('DOCK_RECORDS_MUTATE',{action:'update-resume',id:job.id,expectedRevision:job.revision,mutationId:crypto.randomUUID(),fields:{...fields,cvJsonRaw:JSON.stringify({wrong:'schema'})}},sender);assert.equal(invalid.ok,false);
  const saved=await request('DOCK_RECORDS_MUTATE',{action:'update-resume',id:job.id,expectedRevision:job.revision,mutationId:crypto.randomUUID(),fields},sender);assert.equal(saved.ok,true,saved.error?.message);const resume=saved.result.jobs[0].resume;assert.equal(resume.snapshot.schemaVersion,2);assert.equal(resume.snapshot.resume.title,'Imported Role');assert.equal(saved.result.jobs[0].company,'Imported Company');assert.deepEqual((await request('STUDIO_BOOTSTRAP',{candidateId:job.candidateId})).result.record.draft,before);
  assert.deepEqual(Array.from(sandbox.Zt({letter:{},omitJobDescription:true})),['cv','letter']);assert.deepEqual(Array.from(sandbox.Zt({letter:null,omitJobDescription:true})),['cv']);assert.deepEqual(Array.from(sandbox.Zt({letter:null})),['cv','jd']);
});

test('queue download renders real CV and letter PDFs through the worker and writes only those files with receipts',async t=>{
  const {request,chrome,sandbox}=await coordinator(t),{runtime:offscreen}=await resumeRenderer(),files=new Map(),receipts=new Map();
  offscreen.fetch=async url=>{const file=await readFile(`extension/fonts/${String(url).split('/').at(-1)}`);return {ok:true,arrayBuffer:async()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength)};};
  const companyDirectory={async getFileHandle(name,options={}){if(!files.has(name)&&!options.create)throw new DOMException('Missing','NotFoundError');return {getFile:async()=>files.get(name),createWritable:async()=>{let pending;return {write:async blob=>{pending=blob;},close:async()=>files.set(name,pending),abort:async()=>{}};}};}};
  const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('sidepanel.html'),frameId:0},created=await request('DOCK_RECORDS_MUTATE',{action:'create',mutationId:crypto.randomUUID(),fields:{company:'Job Company',role:'Engineer',url:'https://example.test/download',description:'Job context stays out of the downloaded files.'}},sender),job=created.result.jobs[0];
  const root={id:'queue-export-root',candidateId:job.candidateId,preference:'Resumes',name:'Resumes',handle:{name:'Resumes',queryPermission:async()=> 'granted',getDirectoryHandle:async()=>companyDirectory}};
  const directories={root:async()=>root,matching:async()=>root,receipt:async id=>receipts.get(id),putReceipt:async value=>receipts.set(value.id,structuredClone(value))};sandbox.wn=()=>directories;offscreen.Mw=offscreen.Lw(directories);
  chrome.runtime.sendMessage=async message=>{const payload=message.payload;try{let result;if(message.operation==='PDF_EXPORT_PREPARE')result=await offscreen.Eu.prepare(payload.ticketId,payload.selection,payload.retryUntil,payload.kinds);else if(message.operation==='PDF_DIRECTORY_WRITE')result=await offscreen.Mw.write(payload,async()=>offscreen.Eu.blob(payload.ticketId,payload.kind));else if(message.operation==='PDF_DIRECTORY_STATUS')result=await offscreen.Mw.observe(payload);else if(message.operation==='PDF_EXPORT_SETTLE')result=offscreen.Eu.settle(payload.ticketId,payload.kind,payload.outcome,payload.attemptId);else throw Error(message.operation);return {ok:true,requestId:message.requestId,result:result??null};}catch(error){return {ok:false,requestId:message.requestId,message:error.message};}};
  const exported=await request('DOCK_RECORDS_CV_INPUT',{action:'export',id:job.id,expectedRevision:job.revision,windowId:41,ticketId:'queue-real-pdfs',bindingId:root.id,cvJsonRaw:JSON.stringify({company:'Imported Company',title:'Engineer',summary:'Engineer delivering reliable applications.',skills:[{Engineering:['JavaScript']}],experience:[],education:[]}),coverLetterRaw:'Dear hiring team,\n\nI would like to contribute to your team.\n\nThank you.',coverLetterEnabled:true},sender);assert.equal(exported.ok,true,exported.error?.message);
  let ticket;for(let index=0;index<100;index++){await new Promise(resolve=>setTimeout(resolve,15));ticket=(await request('DOCK_RECORDS_CV_INPUT',{action:'export-status',id:job.id,expectedRevision:job.revision,windowId:41,ticketId:'queue-real-pdfs'},sender)).result;if(!ticket.pending)break;}
  assert.equal(ticket.phase,'settled',ticket.message);assert.deepEqual(ticket.files.map(file=>file.kind),['cv','letter']);assert.ok(ticket.files.every(file=>file.state==='complete'&&file.pageCount>=1));assert.equal(files.size,2);assert.ok([...files.keys()].every(name=>name.endsWith('.pdf')));
  for(const blob of files.values())assert.equal(new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0,4)),'%PDF');assert.ok([...receipts.values()].every(receipt=>receipt.state==='complete'));
  assert.equal((await request('DOCK_RECORDS_STATE',{},sender)).result.jobs[0].resume,null,'Download does not save the modal input into the queue');
});

test('Studio rejects page-script senders and preserves revision conflict checks', async t => {
  const { request, chrome } = await coordinator(t,{withProfile:false});
  assert.equal(await request('WORKSPACE_BOOTSTRAP', {}, {
    id: chrome.runtime.id, url: 'https://example.test/job', tab: { id: 8 }, frameId: 0,
  }), null);
  const document = { schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'one', name: 'Candidate' } };
  const payload = { raw: JSON.stringify(document), filename: 'candidate.json', mutationId: crypto.randomUUID() };
  assert.equal((await request('CANDIDATE_IMPORT', payload)).ok, true);
  const conflict = await request('CANDIDATE_SAVE', { candidateId: 'one', expectedRevision: 0, document, mutationId: crypto.randomUUID() });
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, 'CONFLICT');
});

test('web pages can open a preview but cannot impersonate the dock or change candidates', async t => {
  const { request, chrome } = await coordinator(t);
  const web = { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html#/profile'), frameId: 0, tab: { id: 7, windowId: 41 } };
  for (const operation of ['WORKSPACE_ATTACH', 'CANDIDATE_IMPORT', 'CANDIDATE_GET', 'CANDIDATE_SAVE', 'PREVIEW_OPEN']) {
    assert.equal(await request(operation, {}, web), null, operation);
  }
  const wrongWindow = await request('OPEN_STUDIO_PREVIEW', { windowId: 42 }, web);
  assert.equal(wrongWindow.ok, false);
  assert.equal(wrongWindow.error.code, 'PREVIEW_OWNER_REQUIRED');
  assert.equal(await request('OPEN_STUDIO_PREVIEW', { windowId: 41 }, { ...web, url: 'https://example.test/options.html' }), null);
  assert.equal(await request('OPEN_STUDIO_PREVIEW', { windowId: 41 }, { ...web, frameId: 1 }), null);
});

test('reference dashboards read the single profile while other pages cannot use dashboard operations', async t => {
  const { request, chrome } = await coordinator(t);
  const sender = { id: chrome.runtime.id, url: chrome.runtime.getURL('sidepanel.html'), frameId: 0 };
  const loaded = await request('DASHBOARD_STATE', {}, sender);
  assert.equal(loaded.ok, true); assert.equal(loaded.result.candidates.length, 1);
  const document = { schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'dashboard-profile', name: 'Another Candidate' } };
  await request('CANDIDATE_IMPORT', { raw: JSON.stringify(document), filename: 'profile.json', mutationId: crypto.randomUUID() });
  assert.equal(chrome.storage.local.values.profile.profileName, 'Existing Autofill profile');
  for (const blocked of [{ ...sender, frameId: 1 }, { ...sender, url: chrome.runtime.getURL('options.html#/dashboard') }, { ...sender, url: chrome.runtime.getURL('options.html#/settings/profile') }, { ...sender, url: 'https://example.test/dashboard.html' }]) {
    assert.equal(await request('DASHBOARD_SELECT_PROFILE', { candidateId: 'dashboard-profile' }, blocked), null);
  }
});

test('dock and web queue editors share records while rejecting external pages and child frames', async t => {
  const {request,chrome,createdTabs}=await coordinator(t);
  chrome.runtime.sendMessage=async()=>({ok:true});
  const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('sidepanel.html'),frameId:0};
  const created=await request('DOCK_RECORDS_MUTATE',{action:'create',mutationId:crypto.randomUUID(),fields:{company:'Dock Company',role:'Engineer',url:'https://example.test/dock-job',description:'Build reliable systems.'}},sender);
  assert.equal(created.ok,true,created.error?.message);let record=created.result.jobs[0];
  const opened=await request('DOCK_RECORDS_STUDIO',{id:record.id,expectedRevision:record.revision,windowId:41},sender);
  assert.equal(opened.ok,true,opened.error?.message);record=opened.result.jobs[0];
  const studio=await request('STUDIO_BOOTSTRAP',{candidateId:record.candidateId});
  assert.equal(studio.result.record.draft.jobInputRaw,`${record.url}\n${record.description}`);
  const draft={...studio.result.record.draft,cvJsonRaw:JSON.stringify({company:'Dock Company',title:'Engineer',summary:'A saved resume.',skills:[],experience:[],education:[]})};
  const saved=await request('DRAFT_SAVE',{draft,expectedRevision:draft.revision,mutationId:crypto.randomUUID()});assert.equal(saved.ok,true,saved.error?.message);
  const settings=await request('DOCUMENT_SETTINGS_UPDATE',{auto:true,draftId:draft.id,candidateId:record.candidateId,templateId:'harvard',mutationId:crypto.randomUUID()});assert.equal(settings.ok,true,settings.error?.message);
  const attached=await request('DOCK_RECORDS_RESUME',{id:record.id,expectedRevision:record.revision,windowId:41},sender);
  assert.equal(attached.ok,true,attached.error?.message);assert.equal(attached.result.jobs[0].resume.snapshot.resume.summary,'A saved resume.');
  record=attached.result.jobs[0];assert.equal(record.resume.documentTemplate.id,'harvard');
  const otherTemplate=await request('DOCUMENT_SETTINGS_UPDATE',{auto:true,draftId:draft.id,candidateId:record.candidateId,templateId:'ember',mutationId:crypto.randomUUID()});assert.equal(otherTemplate.ok,true,otherTemplate.error?.message);
  const current=(await request('STUDIO_BOOTSTRAP',{candidateId:record.candidateId})).result.record.draft;assert.equal(current.documentTemplate.id,'ember');
  const unfinished={...current,cvJsonRaw:'An unfinished CV for the same job',coverLetterRaw:'Unfinished letter'};assert.equal((await request('DRAFT_SAVE',{draft:unfinished,expectedRevision:current.revision,mutationId:crypto.randomUUID()})).ok,true);
  const restored=await request('DOCK_RECORDS_OPEN_RESUME',{id:record.id,expectedRevision:record.revision,windowId:41},sender);assert.equal(restored.ok,true,restored.error?.message);
  const restoredDraft=(await request('STUDIO_BOOTSTRAP',{candidateId:record.candidateId})).result.record.draft;assert.equal(restoredDraft.cvJsonRaw,record.resume.cvJsonRaw);assert.equal(restoredDraft.coverLetterRaw,record.resume.coverLetterRaw);assert.deepEqual(restoredDraft.documentTemplate,record.resume.documentTemplate);assert.deepEqual(restoredDraft.bindings,record.resume.snapshot.bindings);
  assert.ok(createdTabs.some(tab=>tab.url.startsWith(chrome.runtime.getURL('preview.html'))));assert.equal(createdTabs.length,1,'View resume reuses the existing Resume Studio web tab');
  const webState=await request('DOCK_RECORDS_STATE',{}, {...sender,url:chrome.runtime.getURL('options.html#/?tab=queue')});assert.equal(webState.ok,true);assert.equal(webState.result.jobs[0].id,record.id);
  for(const operation of DOCK_RECORD_OPERATIONS)for(const blocked of [{...sender,frameId:1},{...sender,url:'https://example.test/dashboard.html'}])assert.equal(await request(operation,{},blocked),null,operation);
});

test('web Studio launch reuses the requesting options tab without creating another tab', async t => {
  const { request, chrome, createdTabs } = await coordinator(t);
  const updates = [];
  chrome.tabs.get = async id => ({ id, windowId: 41, url: chrome.runtime.getURL(id === 17 ? 'options.html#/dashboard' : 'preview.html') });
  chrome.tabs.update = async (id, input) => { updates.push({ id, ...input }); return { id, windowId: 41, ...input }; };
  const sender = { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html#/dashboard'), frameId: 0, tab: { id: 17, windowId: 41 } };
  const response = await request('OPEN_STUDIO_PREVIEW', { windowId: 41, tabId: 17 }, sender);
  assert.equal(response.ok, true, response.error?.message);
  assert.equal(response.result.tabId, 17);
  assert.equal(updates.length, 1); assert.equal(updates[0].id, 17);
  assert.ok(updates[0].url.startsWith(chrome.runtime.getURL('preview.html?owner=')));
  assert.equal(createdTabs.length, 0);
  const wrongTab = await request('OPEN_STUDIO_PREVIEW', { windowId: 41, tabId: 18 }, sender);
  assert.equal(wrongTab.ok, false); assert.equal(updates.length, 1);
});

test('the parent preview connects to its embedded editor and stays open independently of the dashboard', async t => {
  const { request, chrome } = await coordinator(t);
  const parent = { id: chrome.runtime.id, url: chrome.runtime.getURL('preview.html'), frameId: 0, documentId: 'preview-document', tab: { id: 100, windowId: 41 } };
  const connected = await request('PREVIEW_CONNECT', {}, parent);
  assert.equal(connected.ok, true, connected.error?.message);
  assert.equal(connected.result.state.tabId, 100);
  assert.equal((await request('DOCK_RECORDS_STATE',{},parent)).ok,true,'Preview can read navigation counts');
  assert.equal(await request('DOCK_RECORDS_MUTATE',{action:'delete-all'},parent),null,'Preview cannot mutate application records');
  assert.equal(await request('DOCK_RECORDS_STATE',{}, {...parent,frameId:1}),null,'Embedded pages cannot read records as the preview');
  const submitted={...parent,url:chrome.runtime.getURL('preview.html')+'?submitted=record-one&kind=resume'};
  assert.equal((await request('DOCK_RECORDS_STATE',{},submitted)).ok,true,'Submitted Studio can read its saved document');
  const missing=await request('DOCK_RECORDS_DOCUMENT_PREVIEW',{id:'record-one',type:'applications',expectedRevision:1,kind:'resume'},submitted);
  assert.equal(missing.error.code,'NOT_FOUND','Submitted Studio can request read-only PDFs without acquiring editor permissions');
  for(const operation of ['DOCK_RECORDS_MUTATE','PREVIEW_CONNECT','WORKSPACE_BOOTSTRAP','CANDIDATE_SAVE'])assert.equal(await request(operation,{},submitted),null,operation+' stays outside read-only Studio');
  for(const invalid of [{...submitted,frameId:1},{...submitted,url:submitted.url+'&owner=00000000-0000-0000-0000-000000000000'},{...submitted,url:submitted.url.replace('chrome-extension://','https://')}])assert.equal(await request('DOCK_RECORDS_STATE',{},invalid),null);
  const bootstrap = await request('WORKSPACE_BOOTSTRAP');
  const draft = bootstrap.result.studio.record.draft;
  const invalidated = await request('PREVIEW_INVALIDATE', { generation: crypto.randomUUID(), candidateId: draft.candidateId, draftId: draft.id });
  assert.equal(invalidated.ok, true, invalidated.error?.message);
  assert.equal(chrome.sidePanel.onClosed.listeners.size, 0);
  const focus = await request('PREVIEW_CLOSE', { tabId: 100 });
  assert.equal(focus.ok, true); assert.equal(focus.result.tabId, 100);
  const refreshed = await request('PREVIEW_GET', {}, parent);
  assert.equal(refreshed.ok, true); assert.equal(refreshed.result.state.tabId, 100);
});

test('v2 prompt settings save templates, assignments and profile instructions with scoped permissions and revision checks', async t => {
  const { request, chrome, sandbox } = await coordinator(t);
  const sender = { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html#/settings/prompts'), frameId: 0, tab: { id: 7, windowId: 41 } };
  const loaded = await request('PROMPT_SETTINGS', {}, sender);
  assert.equal(loaded.ok, true);
  const originalProfile = structuredClone(chrome.storage.local.values.profile);
  const template = { id: 'test-template', title: 'My resume prompt', text: 'Use these facts: {{candidate_profile}}\nFor this role: {{job_description}}' };
  const save = await request('PROMPT_SAVE', { template, expectedRevision: loaded.result.library.revision }, sender);
  assert.equal(save.ok, true);
  const conflict = await request('PROMPT_SAVE', { template: { ...template, title: 'Stale edit' }, expectedRevision: loaded.result.library.revision }, sender);
  assert.equal(conflict.ok, false);
  assert.equal(conflict.error.code, 'PROMPT_CONFLICT');
  const invalid = await request('PROMPT_SAVE', { template: { ...template, text: '{{candidate_profile}} {{candidate_profile}}' }, expectedRevision: save.result.revision }, sender);
  assert.equal(invalid.ok, false);
  assert.equal(invalid.error.code, 'INVALID_PROMPT');
  const candidate = loaded.result.candidate;
  const assignment = await request('PROMPT_SELECT', { templateId: template.id, candidateId: candidate.document.candidate.id, expectedCandidateRevision: candidate.revision, mutationId: crypto.randomUUID() }, sender);
  assert.equal(assignment.ok, true);
  assert.equal(assignment.result.candidate.document.applicationPreferences.assignedPromptTemplateId, template.id);
  const assigned = assignment.result.candidate;
  const document = { ...assigned.document, applicationPreferences: { ...assigned.document.applicationPreferences, resumePrompt: { seniority: 'Senior', yearsOfExperience: 8, shortBio: 'Build reliable software.' } },
    customPromptInstructions: [{ id: 'one', title: 'Style', text: 'Use concise factual bullets.' }], customAnswers: [{ id: 'answer', question: 'Availability?', answer: 'Two weeks.' }] };
  const updated = await request('CANDIDATE_SAVE', { candidateId: candidate.document.candidate.id, expectedRevision: assigned.revision, document, mutationId: crypto.randomUUID() }, sender);
  assert.equal(updated.ok, true);
  assert.deepEqual(chrome.storage.local.values.profile, originalProfile);
  assert.equal(updated.result.candidate.document.customAnswers[0].answer, 'Two weeks.');
  const preview = buildPrompt(updated.result.candidate.document, 'A real job description.', template);
  const dock = sandbox.Xt(updated.result.candidate.document, 'A real job description.', template);
  assert.equal(preview.text, dock.text);
  assert.equal(preview.text,'Use these facts: \nFor this role: A real job description.');
  const other = await request('CANDIDATE_GET', { candidateId: 'another-profile' }, sender);
  assert.equal(other.ok, false);
  assert.equal(other.error.code, 'CANDIDATE_CONFLICT');
  for (const blocked of [
    { ...sender, frameId: 1 }, { ...sender, url: chrome.runtime.getURL('options.html#/settings/profile') },
    { ...sender, url: chrome.runtime.getURL('options.html#/dashboard') }, { ...sender, url: 'https://example.test/options.html#/settings/prompts' },
  ]) assert.equal(await request('PROMPT_SAVE', { template, expectedRevision: 1 }, blocked), null);
  assert.equal(await request('WORKSPACE_ATTACH', { visible: true }, sender), null);
});

test('owned Studio prompt selection preserves the single profile and its drafts', async t => {
  const { request, chrome } = await coordinator(t);
  const settings = { id: chrome.runtime.id, url: chrome.runtime.getURL('options.html#/settings/prompts'), frameId: 0 };
  const initial = (await request('WORKSPACE_BOOTSTRAP')).result;
  const original = structuredClone(chrome.storage.local.values.profile);
  const prompts = await request('PROMPT_SETTINGS', { candidateId: initial.candidate.id });
  assert.equal(prompts.ok, true, prompts.error?.message);
  const template = { id: 'studio-selector-test', title: 'Concise', text: 'STUDIO PROMPT\n{{candidate_profile}}\n{{job_description}}' };
  const saved = await request('PROMPT_SAVE', { template, expectedRevision: prompts.result.library.revision }, settings);
  assert.equal(saved.ok, true);
  const forbidden = await request('PROMPT_SAVE', { template, expectedRevision: saved.result.revision });
  assert.equal(forbidden.ok, false);
  const draft = { ...initial.studio.record.draft, jobInputRaw: 'Keep this job description.' };
  const written = await request('DRAFT_SAVE', { draft, expectedRevision: draft.revision, mutationId: crypto.randomUUID() });
  assert.equal(written.ok, true, written.error?.message);
  const selected = await request('PROMPT_SELECT', { candidateId: initial.candidate.id, templateId: template.id, expectedCandidateRevision: initial.candidate.revision, mutationId: crypto.randomUUID() });
  assert.deepEqual(chrome.storage.local.values.profile, original);
  const conflict = await request('PROMPT_SELECT', { candidateId: initial.candidate.id, templateId: template.id, expectedCandidateRevision: initial.candidate.revision, mutationId: crypto.randomUUID() });
  assert.equal(conflict.ok, false); assert.equal(conflict.error.code, 'CONFLICT');
  const copied = await request('COPY_PROMPT_JD', { candidateId: initial.candidate.id, expectedRevision: written.result.record.draft.revision });
  assert.equal(copied.ok, true, copied.error?.message);
  assert.equal(copied.result.templateId, template.id);
  assert.match(copied.result.manualText, /STUDIO PROMPT[\s\S]*Keep this job description/);
  const rejected = await request('CANDIDATE_SELECT', {candidateId:'another-profile'});assert.equal(rejected.ok,false);assert.equal(rejected.error.code,'SINGLE_PROFILE');
  const restored = (await request('WORKSPACE_BOOTSTRAP')).result;
  assert.equal(restored.candidate.id, initial.candidate.id);
  assert.equal(restored.studio.record.draft.jobInputRaw, draft.jobInputRaw);
  assert.equal(restored.candidate.document.applicationPreferences.assignedPromptTemplateId, template.id);
});

test('legacy Studio profile routes still open SpeedyApply profile pages', async t => {
  const { request, createdTabs } = await coordinator(t);
  await request('WORKSPACE_ATTACH', { visible: true });
  const response = await request('PROMPT_OPEN_SETTINGS', { candidateId: null });
  assert.equal(response.ok, true);
  assert.equal(createdTabs[0].url, 'chrome-extension://autofill-test/options.html#/settings/profile/new');
  const state = await request('WORKSPACE_BOOTSTRAP');
  const edit = await request('PROMPT_OPEN_SETTINGS', { candidateId: state.result.candidate.document.candidate.id });
  assert.equal(edit.ok, true);
  assert.equal(createdTabs[1].url, 'chrome-extension://autofill-test/options.html#/settings/profile');
});

test('embedded editor settings flush accepts its owning page and rejects other tabs and stale owners', async () => {
  const source = await readFile('extension/preview.js', 'utf8');
  const first = source.indexOf('function dS('), last = source.indexOf('function hS(', first);
  let listener, flushed = 0;
  const chrome = { runtime: { id: 'test', getURL: file => `chrome-extension://test/${file}`, onMessage: { addListener: fn => { listener = fn; } } },
    tabs: { getCurrent: async () => ({ id: 7, windowId: 41, url: 'chrome-extension://test/preview.html' }) },
    storage: { session: { get: async key => ({ [key]: { instanceId: 'owner' } }) } } };
  const context = vm.createContext({ chrome, LR: 'flush-resume-settings:v1', Cm: () => true, Od: { useRef: value => ({ current: value }), useEffect: effect => effect() } });
  vm.runInContext(source.slice(first, last), context);
  context.dS('41', 'candidate', 'draft', async () => { flushed++; });
  const message = { target: 'flush-resume-settings:v1', workspaceId: '41', workspaceInstanceId: 'owner', previewTabId: 7, candidateId: 'candidate', draftId: 'draft' };
  const sender = { id: 'test', url: chrome.runtime.getURL('workspace.html'), frameId: 2, tab: { id: 7, windowId: 41 } };
  let response;
  assert.equal(listener(message, sender, value => { response = value; }), true);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(response.ok, true); assert.equal(flushed, 1);
  assert.equal(listener(message, { ...sender, frameId: 0 }, () => {}), false);
  assert.equal(listener(message, { ...sender, tab: { id: 8, windowId: 41 } }, () => {}), false);
  listener({ ...message, workspaceInstanceId: 'stale' }, sender, value => { response = value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(response.ok, false); assert.equal(flushed, 1);
});

test('Studio launch opens its web page and dashboard navigation reuses its tab', async () => {
  let launched;
  const opening = openStudioDock(41, { runtime: { sendMessage: async input => { launched = input; return { ok: true, result: {} }; } } });
  assert.equal(launched.operation, 'OPEN_STUDIO_PREVIEW');
  assert.deepEqual(launched.payload, { windowId: 41 });
  await opening;
  await assert.rejects(openStudioDock(null));
  let updated;
  const browser = {
    runtime: { getURL: file => `chrome-extension://test/${file}` },
    windows: { getCurrent: async () => ({ id: 41 }) },
    tabs: {
      query: async () => [{ id: 7, url: 'chrome-extension://test/options.html#/profile' }],
      update: async (id, options) => { updated = { id, options }; },
    },
  };
  await openDashboard('/resume-studio', browser);
  assert.deepEqual(updated, { id: 7, options: { url: 'chrome-extension://test/options.html#/resume-studio', active: true } });
});

test('the imported document renderer produces a PDF from a candidate and CV snapshot', async t => {
  const { request, sandbox: worker, chrome } = await coordinator(t,{withProfile:false});
  const profile = { ...emptyProfile(), profileName: 'Renderer', nameData: { firstName: 'Test', lastName: 'Candidate', preferredName: false },
    contactData: { email: 'candidate@example.test', phoneNumber: '5551234567', phoneCountryCode: '+1', phoneDeviceType: 'Mobile' },
    jobData: [{ jobTitle: 'Engineer', company: 'Example', location: 'Boston', startDate: '2022-01', currentlyWorkHere: true, description: 'Build software.' }] };
  const imported = await request('CANDIDATE_IMPORT', { raw: JSON.stringify(profile), filename: 'profile.json', mutationId: crypto.randomUUID() });
  assert.equal(imported.ok, true);
  const candidateId = imported.result.candidate.document.candidate.id;
  const resumeProfile = worker.ie(imported.result.candidate);
  assert.equal(resumeProfile.contact[0], 'candidate@example.test');
  assert.equal(resumeProfile.experience[0].role, 'Engineer');
  assert.equal(resumeProfile.experience[0].startDate, '2022-01');
  const state = await request('STUDIO_BOOTSTRAP', { candidateId });
  assert.equal(state.ok, true);
  const draft = state.result.record.draft;
  draft.jobInputRaw = 'https://example.test/job\nSoftware engineering position.';
  draft.cvJsonRaw = JSON.stringify({
    company: 'Example Company', title: 'Software Engineer', summary: 'Software engineer building reliable applications.',
    skills: [{ Engineering: ['JavaScript', 'Testing'] }], experience: [], education: [],
  });
  const snapshot = worker.Fe(imported.result.candidate, draft, '41', 1).snapshot;
  const messages = event();
  const renderer = vm.createContext({ resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph,registerAIClipboard,registerDocumentPreviewRenderer,
    chrome: { runtime: { id: chrome.runtime.id, getURL: chrome.runtime.getURL, onMessage: messages } },
    crypto: webcrypto, indexedDB: new IDBFactory(), Blob, TextEncoder, TextDecoder, URL, console, atob, btoa, structuredClone,
    setInterval: () => 0, clearInterval: () => {}, setTimeout, clearTimeout,
    document: { getElementById: () => null },
    fetch: async url => {
      const file = new URL(url).pathname.replace(/^\//, '');
      assert.ok(file.startsWith('fonts/'), `Renderer attempted an unexpected request: ${file}`);
      return new Response(await readFile(`extension/${file}`));
    },
  });
  vm.runInContext((await readFile('extension/offscreen.js', 'utf8')).replace(/^import[^\n]+\n/gm, ''), renderer);
  const response = await new Promise(resolve => {
    let accepted = false;
    for (const listener of messages.listeners) {
      accepted = listener({ version: 1, requestId: crypto.randomUUID(), target: 'offscreen', operation: 'RENDER_SNAPSHOT_V2', payload: { snapshot } }, {
        id: chrome.runtime.id, url: chrome.runtime.getURL('service-worker.js'),
      }, resolve) || accepted;
    }
    assert.equal(accepted, true);
  });
  assert.equal(response.ok, true, response.message);
  assert.equal(response.result.stale, false);
  const rendered = response.result.result;
  const pdf = Buffer.from(rendered.base64, 'base64');
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(rendered.pageCount >= 1);
  const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', pdf)).toString('hex');
  assert.equal(rendered.sha256, hash);
});


test('prompt role responsibilities and short context save independently through the worker',async t=>{
  const {request,chrome}=await coordinator(t);
  const profile=structuredClone(chrome.storage.local.values.profile);
  profile.jobData=[{id:'role-one',jobTitle:'Engineer',company:'Employer',location:'Remote',startDate:'2020-01',endDate:'',currentlyWorkHere:true,description:'Built reliable services.'}];
  const profileSender={id:chrome.runtime.id,url:chrome.runtime.getURL('options.html#/settings/profile'),frameId:0};
  const created=await request('PROFILE_SAVE',{profile,expectedProfile:chrome.storage.local.values.profile,mutationId:crypto.randomUUID()},profileSender);
  assert.equal(created.ok,true);
  const original=structuredClone(chrome.storage.local.values.profile),sender={...profileSender,url:chrome.runtime.getURL('options.html#/settings/ai/prompt')};
  const loaded=await request('PROMPT_SETTINGS',{},sender),candidate=loaded.result.candidate,role=candidate.document.companies[0];
  const document=structuredClone(candidate.document);
  document.applicationPreferences.resumePrompt={roles:{[role.id]:{responsibilities:'Delivered payment integrations.',shortDetail:'Led the platform team.'}}};
  const saved=await request('CANDIDATE_SAVE',{candidateId:candidate.id,expectedRevision:candidate.revision,document,mutationId:crypto.randomUUID()},sender);
  assert.equal(saved.ok,true);assert.deepEqual(chrome.storage.local.values.profile,original);
  const prompt=buildPrompt(saved.result.candidate.document,'',{id:'timeline',text:'{{candidate_profile}}'}).text;
  assert.deepEqual(saved.result.candidate.document.applicationPreferences.resumePrompt.roles[role.id],{responsibilities:'Delivered payment integrations.',shortDetail:'Led the platform team.'});
  assert.ok(prompt.includes('Employer, Jan 2020 - Present - Remote.'));assert.ok(!prompt.includes('Delivered payment integrations.'));assert.ok(!prompt.includes('Led the platform team.'));
  document.applicationPreferences.resumePrompt.roles[role.id].responsibilities=42;
  const invalid=await request('CANDIDATE_SAVE',{candidateId:candidate.id,expectedRevision:saved.result.candidate.revision,document,mutationId:crypto.randomUUID()},sender);
  assert.equal(invalid.ok,false);assert.match(invalid.error.message,/Enter text for responsibilities/);
});


test('AI Candidate Form persists prompt defaults without changing the base profile',async t=>{
 const {request,chrome}=await coordinator(t);
 const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('options.html#/settings/ai/candidate'),frameId:0};
 const original=structuredClone(chrome.storage.local.values.profile);
 const loaded=await request('PROMPT_SETTINGS',{},sender);assert.equal(loaded.ok,true);
 const candidate=loaded.result.candidate,document=structuredClone(candidate.document);
 document.applicationPreferences.resumePrompt={name:'Prompt Candidate',location:'Remote',seniority:'Senior',yearsOfExperience:8,roles:{'prompt-company-1':{company:'Employer',location:'Boston',dates:'2020 - Present',minimumBullets:9}},education:{'prompt-education-1':{degree:'BS',school:'Example University',dates:'2014 - 2018'}}};
 const saved=await request('CANDIDATE_SAVE',{candidateId:candidate.id,expectedRevision:candidate.revision,document,mutationId:crypto.randomUUID()},sender);
 assert.equal(saved.ok,true,JSON.stringify(saved.error));assert.deepEqual(chrome.storage.local.values.profile,original);
 const reloaded=await request('PROMPT_SETTINGS',{},sender);
 assert.equal(buildPrompt(reloaded.result.candidate.document,'',{id:'defaults',text:'{{candidate_name}} | {{candidate_location}} | {{years_of_experience}} | {{company_1_bullets}}'}).text,'Prompt Candidate | Remote | 8 | 9');
});

test('Resume Studio website visibility persists and filters rendered links without removing saved profile URLs',async t=>{
 const {request,chrome,sandbox}=await coordinator(t),loaded=await request('STUDIO_BOOTSTRAP',{}),candidate=loaded.result.record?.candidate||loaded.result.candidate;
 const initial=candidate||(await request('PROMPT_SETTINGS',{}, {id:chrome.runtime.id,url:chrome.runtime.getURL('options.html#/settings/ai/prompt'),frameId:0})).result.candidate;
 const document=structuredClone(initial.document);document.personalDetails={...document.personalDetails,onlinePresence:{linkedin:'https://linkedin.com/in/example',github:'https://github.com/example',website:'https://example.test'}};
 let saved=await request('CANDIDATE_SAVE',{candidateId:initial.id,expectedRevision:initial.revision,document,mutationId:crypto.randomUUID()});assert.equal(saved.ok,true,JSON.stringify(saved.error));const profile=structuredClone(chrome.storage.local.values.profile);
 assert.deepEqual(Array.from(sandbox.ie(saved.result.candidate).links),Object.values(document.personalDetails.onlinePresence));
 for(const visibility of [{linkedin:false,github:true,website:false},{linkedin:false,github:false,website:false},{linkedin:true,github:true,website:true}]){
   const current=saved.result.candidate,next=structuredClone(current.document);next.applicationPreferences={...next.applicationPreferences,resumeWebsiteVisibility:visibility};saved=await request('CANDIDATE_SAVE',{candidateId:current.id,expectedRevision:current.revision,document:next,mutationId:crypto.randomUUID()});assert.equal(saved.ok,true,JSON.stringify(saved.error));assert.deepEqual(Array.from(sandbox.ie(saved.result.candidate).links),Object.entries(document.personalDetails.onlinePresence).filter(([key])=>visibility[key]).map(([,value])=>value));assert.deepEqual(chrome.storage.local.values.profile.websiteData,profile.websiteData);assert.deepEqual(saved.result.candidate.document.applicationPreferences.resumeWebsiteVisibility,visibility);
 }
});

test('new Studio drafts use the saved default template and formatting without replacing an existing draft',async t=>{
 const {request,chrome}=await coordinator(t),settings=await request('PROMPT_SETTINGS',{}, {id:chrome.runtime.id,url:chrome.runtime.getURL('options.html#/settings/ai/prompt'),frameId:0}),candidate=settings.result.candidate,document=structuredClone(candidate.document);
 document.applicationPreferences={...document.applicationPreferences,preferredDocumentTemplateId:'harvard',defaultDocumentStyle:{documentTemplate:{id:'harvard',version:1},formattingOverrides:{headerAlignment:'right',accentColor:'#6550ce'}}};const saved=await request('CANDIDATE_SAVE',{candidateId:candidate.id,expectedRevision:candidate.revision,document,mutationId:crypto.randomUUID()});assert.equal(saved.ok,true,JSON.stringify(saved.error));await chrome.storage.session.remove('draft:candidate:'+candidate.id);
 const created=await request('STUDIO_BOOTSTRAP',{candidateId:candidate.id});assert.equal(created.ok,true,JSON.stringify(created.error));assert.equal(created.result.record.draft.documentTemplate.id,'harvard');assert.deepEqual(created.result.record.draft.formattingOverrides,document.applicationPreferences.defaultDocumentStyle.formattingOverrides);
 const next=structuredClone(saved.result.candidate.document);next.applicationPreferences.defaultDocumentStyle.formattingOverrides.headerAlignment='center';await request('CANDIDATE_SAVE',{candidateId:candidate.id,expectedRevision:saved.result.candidate.revision,document:next,mutationId:crypto.randomUUID()});const reopened=await request('STUDIO_BOOTSTRAP',{candidateId:candidate.id});assert.equal(reopened.result.record.draft.id,created.result.record.draft.id);assert.equal(reopened.result.record.draft.formattingOverrides.headerAlignment,'right');
});
