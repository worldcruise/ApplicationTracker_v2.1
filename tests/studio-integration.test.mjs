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
import { buildPrompt } from '../extension/studio/prompt-settings.js';
import { requireEmbeddedEditor } from '../extension/studio/editor-access.js';
import { DASHBOARD_OPERATIONS, isReferenceDashboardSender } from '../extension/studio/reference-dashboard-access.js';
import { handleCaptureHotkey } from '../extension/studio/capture-hotkey.js';
import { createDockRecordsService, DOCK_RECORD_OPERATIONS } from '../extension/studio/dock-records-service.js';
import {createQueueResumeExports} from '../extension/studio/queue-resume-export.js';
import { createDockApplyService, DOCK_APPLY_OPERATIONS } from '../extension/studio/dock-apply-service.js';
import { resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph } from '../extension/studio/resume-layout.js';
import {resumeRenderer} from './helpers/resume-renderer.mjs';

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

async function coordinator(t) {
  const studioStorage = createStudioStorage({ indexedDB: new IDBFactory(), BroadcastChannel: null });
  t.after(() => studioStorage.close());
  const createdTabs = [];
  const chrome = {
    runtime: {
      id: 'autofill-test', getURL: path => `chrome-extension://autofill-test/${path}`,
      getContexts: async filter => filter?.documentIds?.includes('editor-document') ? [{ documentId: 'editor-document', documentUrl: 'chrome-extension://autofill-test/workspace.html', frameId: 1, tabId: 100, windowId: 41 }] : [{ documentId: 'preview-document', documentUrl: 'chrome-extension://autofill-test/preview.html', frameId: 0, tabId: 100, windowId: 41 }], onMessage: event(), onConnect: event(), onInstalled: event(), onStartup: event(),
    },
    storage: { local: memoryStorage({ profile: { ...emptyProfile(), profileName: 'Existing Autofill profile' } }), session: memoryStorage(), onChanged: event() },
    windows: { get: async id => ({ id, type: 'normal' }), onRemoved: event(), update: async () => {} },
    sidePanel: { setPanelBehavior: async () => {}, open: async () => {}, onClosed: event() },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    tabs: {
      onUpdated: event(), onRemoved: event(), onAttached: event(), query: async () => [],
      get: async id => ({ id, windowId: 41, url: 'chrome-extension://autofill-test/preview.html' }),
      update: async (id,input) => ({id,windowId:41,url:'chrome-extension://autofill-test/preview.html',...input}),
      create: async input => { createdTabs.push(input); return { id: 100, windowId: 41, ...input }; },
    },
    downloads: { search: async () => [], onChanged: event(), onCreated: event(), onErased: event() },
    commands: { onCommand: event() },
  };
  const sandbox = vm.createContext({ resumeSectionOrder, skillsFirstTemplate, chrome, studioStorage, createProfileRepository, createDockRecordsService, saveDockApplication:async input=>{const raw=chrome.storage.local.values.appliedList||[];await chrome.storage.local.set({appliedList:[{jobTitle:input.jobTitle,jobLink:input.jobLink,companyName:input.companyName,companyLink:input.companyLink,profileName:input.profileDetails.profileName,status:'applied',date:input.appliedDate.toString()},...raw]});},syncDockApplication:async()=>{},openWebStudioPreview, requireEmbeddedEditor, handleCaptureHotkey, DASHBOARD_OPERATIONS, isReferenceDashboardSender: sender => isReferenceDashboardSender(sender, chrome), isPromptSettingsSender: sender => isPromptSettingsSender(sender, chrome), PROMPT_SETTINGS_OPERATIONS, crypto: webcrypto, TextEncoder, TextDecoder, URL, console, structuredClone, setTimeout, clearTimeout });
  Object.assign(sandbox,{createQueueResumeExports,createDockApplyService,parseDockResume:async()=>({}),generateDockAnswer:async()=>''});
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

test('only the native dock can use Apply operations through the actual worker router',async t=>{
  const app=await coordinator(t),dock={id:app.chrome.runtime.id,url:app.chrome.runtime.getURL('dashboard.html'),frameId:0};
  const reply=await app.request('DOCK_APPLY_STATE',{windowId:41},dock);assert.equal(reply.ok,true);assert.equal(reply.result.run,null);assert.equal(reply.result.jobs.length,0);
  for(const operation of DOCK_APPLY_OPERATIONS)for(const sender of [{...dock,url:app.chrome.runtime.getURL('options.html')},{...dock,url:'https://example.test/job'},{...dock,frameId:1}])assert.equal(await app.request(operation,{windowId:41},sender),null,`${operation}: rejected ${sender.url}`);
});

test('dock CV input uses the real CV validator and snapshot without replacing Studio text',async t=>{
  const {request,chrome,sandbox}=await coordinator(t),sender={id:chrome.runtime.id,url:chrome.runtime.getURL('dashboard.html'),frameId:0};
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
  const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('dashboard.html'),frameId:0},created=await request('DOCK_RECORDS_MUTATE',{action:'create',mutationId:crypto.randomUUID(),fields:{company:'Job Company',role:'Engineer',url:'https://example.test/download',description:'Job context stays out of the downloaded files.'}},sender),job=created.result.jobs[0];
  const root={id:'queue-export-root',candidateId:job.candidateId,preference:'Resumes',name:'Resumes',handle:{name:'Resumes',queryPermission:async()=> 'granted',getDirectoryHandle:async()=>companyDirectory}};
  const directories={root:async()=>root,matching:async()=>root,receipt:async id=>receipts.get(id),putReceipt:async value=>receipts.set(value.id,structuredClone(value))};sandbox.wn=()=>directories;offscreen.Mw=offscreen.Lw(directories);
  chrome.runtime.sendMessage=async message=>{const payload=message.payload;try{let result;if(message.operation==='PDF_EXPORT_PREPARE')result=await offscreen.Eu.prepare(payload.ticketId,payload.selection,payload.retryUntil,payload.kinds);else if(message.operation==='PDF_DIRECTORY_WRITE')result=await offscreen.Mw.write(payload,async()=>offscreen.Eu.blob(payload.ticketId,payload.kind));else if(message.operation==='PDF_DIRECTORY_STATUS')result=await offscreen.Mw.observe(payload);else if(message.operation==='PDF_EXPORT_SETTLE')result=offscreen.Eu.settle(payload.ticketId,payload.kind,payload.outcome,payload.attemptId);else throw Error(message.operation);return {ok:true,requestId:message.requestId,result:result??null};}catch(error){return {ok:false,requestId:message.requestId,message:error.message};}};
  const exported=await request('DOCK_RECORDS_CV_INPUT',{action:'export',id:job.id,expectedRevision:job.revision,windowId:41,ticketId:'queue-real-pdfs',bindingId:root.id,cvJsonRaw:JSON.stringify({company:'Imported Company',title:'Engineer',summary:'Engineer delivering reliable applications.',skills:[{Engineering:['JavaScript']}],experience:[],education:[]}),coverLetterRaw:'Dear hiring team,\n\nI would like to contribute to your team.\n\nThank you.',coverLetterEnabled:true},sender);assert.equal(exported.ok,true,exported.error?.message);
  let ticket;for(let index=0;index<100;index++){await new Promise(resolve=>setTimeout(resolve,15));ticket=(await request('DOCK_RECORDS_CV_INPUT',{action:'export-status',id:job.id,expectedRevision:job.revision,windowId:41,ticketId:'queue-real-pdfs'},sender)).result;if(!ticket.pending)break;}
  assert.equal(ticket.phase,'settled',ticket.message);assert.deepEqual(ticket.files.map(file=>file.kind),['cv','letter']);assert.ok(ticket.files.every(file=>file.state==='complete'&&file.pageCount>=1));assert.equal(files.size,2);assert.ok([...files.keys()].every(name=>name.endsWith('.pdf')));
  for(const blob of files.values())assert.equal(new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()).slice(0,4)),'%PDF');assert.ok([...receipts.values()].every(receipt=>receipt.state==='complete'));
  assert.equal((await request('DOCK_RECORDS_STATE',{},sender)).result.jobs[0].resume,null,'Download does not save the modal input into the queue');
});

test('sample queue jobs use the actual worker validator and Studio snapshot builder without changing the active draft',async t=>{
  const {request,chrome,studioStorage}=await coordinator(t),sender={id:chrome.runtime.id,url:chrome.runtime.getURL('dashboard.html'),frameId:0};
  const before=await request('WORKSPACE_BOOTSTRAP'),canonical=structuredClone(chrome.storage.local.values.profile);
  const seeded=await request('DOCK_RECORDS_SEED_SAMPLES',{},sender);assert.equal(seeded.ok,true,seeded.error?.message);assert.equal(seeded.result.jobs.length,5);
  for(const job of seeded.result.jobs){assert.equal(job.isMock,true);assert.equal(job.resume.snapshot.schemaVersion,2);assert.equal(job.resume.snapshot.resume.company,job.company);assert.equal(job.resume.snapshot.candidate.id,before.result.candidate.id);assert.deepEqual(job.resume.snapshot.bindings,{experience:[],education:[]});}
  assert.deepEqual((await request('WORKSPACE_BOOTSTRAP')).result.studio.record.draft,before.result.studio.record.draft);assert.deepEqual(chrome.storage.local.values.profile,canonical);assert.equal(chrome.storage.local.values.appliedList,undefined);
  const again=await request('DOCK_RECORDS_SEED_SAMPLES',{},sender);assert.equal(again.result.jobs.length,5);assert.equal((await studioStorage.get('dock-job-records:v1'))['dock-job-records:v1'].jobs.length,5);
  const sample=seeded.result.jobs[1],opened=await request('DOCK_RECORDS_OPEN_RESUME',{id:sample.id,expectedRevision:sample.revision,windowId:41},sender);assert.equal(opened.ok,true,opened.error?.message);
  assert.equal((await request('STUDIO_BOOTSTRAP',{candidateId:sample.candidateId})).result.record.draft.cvJsonRaw,sample.resume.cvJsonRaw);assert.deepEqual(chrome.storage.local.values.profile,canonical);
});

test('imported Studio coordinator supports candidate import, editing, persistence, and settings', async t => {
  const { request, chrome, studioStorage } = await coordinator(t);
  const attach = await request('WORKSPACE_ATTACH', { visible: true });
  assert.equal(attach.ok, true);
  const document = {
    schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'candidate-1', name: 'Test Candidate' },
    personalDetails: { email: 'candidate@example.test' }, companies: [], professionalProfile: { summary: 'Saved facts.' },
  };
  const imported = await request('CANDIDATE_IMPORT', { raw: JSON.stringify(document), filename: 'candidate.json', mutationId: crypto.randomUUID() });
  assert.equal(imported.ok, true);
  assert.equal(imported.result.candidate.revision, 1);
  const saved = await request('CANDIDATE_SAVE', {
    candidateId: document.candidate.id, expectedRevision: 1,
    document: { ...document, candidate: { ...document.candidate, name: 'Edited Candidate' } }, mutationId: crypto.randomUUID(),
  });
  assert.equal(saved.ok, true);
  assert.equal(saved.result.candidate.revision, 2);
  const bootstrap = await request('WORKSPACE_BOOTSTRAP');
  assert.equal(bootstrap.ok, true);
  assert.equal(bootstrap.result.candidate.document.candidate.name, 'Edited Candidate');
  assert.equal(bootstrap.result.candidates.length, 2);
  assert.ok(bootstrap.result.studio.record.draft);
  const prompt = await request('PROMPT_SETTINGS', {}, { id: chrome.runtime.id, url: chrome.runtime.getURL('settings.html'), frameId: 0 });
  assert.equal(prompt.ok, true);
  assert.equal(prompt.result.library.templates.length, 1);
  const record = (await studioStorage.get('autofill-profile:candidate-1'))['autofill-profile:candidate-1'];
  assert.equal(record.revision, 2);
  assert.equal(record.document, undefined);
  assert.equal(record.profile.contactData.email, 'candidate@example.test');
  assert.equal(chrome.storage.local.values.profile.nameData.firstName, 'Edited');
  const ticketId = crypto.randomUUID();
  const exported = await request('CANDIDATE_EXPORT_JSON', { candidateId: 'candidate-1', expectedRevision: 2, ticketId });
  assert.equal(exported.ok, true);
  const json = JSON.parse(chrome.storage.session.values[`candidate-export:${ticketId}`].jsonText);
  assert.equal(json.nameData.firstName, 'Edited');
  assert.equal(json.kind, undefined);
});

test('Studio rejects page-script senders and preserves revision conflict checks', async t => {
  const { request, chrome } = await coordinator(t);
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

test('reference dashboards select canonical profiles while other pages cannot use dashboard operations', async t => {
  const { request, chrome } = await coordinator(t);
  const sender = { id: chrome.runtime.id, url: chrome.runtime.getURL('dashboard.html'), frameId: 0 };
  const loaded = await request('DASHBOARD_STATE', {}, sender);
  assert.equal(loaded.ok, true); assert.equal(loaded.result.candidates.length, 1);
  const document = { schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'dashboard-profile', name: 'Another Candidate' } };
  await request('CANDIDATE_IMPORT', { raw: JSON.stringify(document), filename: 'profile.json', mutationId: crypto.randomUUID() });
  const selected = await request('DASHBOARD_SELECT_PROFILE', { candidateId: loaded.result.candidate.document.candidate.id }, sender);
  assert.equal(selected.ok, true); assert.equal(selected.result.candidate.id, loaded.result.candidate.id);
  assert.equal(selected.result.candidates.length, 2);
  assert.equal(chrome.storage.local.values.profile.profileName, 'Existing Autofill profile');
  for (const blocked of [{ ...sender, frameId: 1 }, { ...sender, url: chrome.runtime.getURL('options.html#/dashboard') }, { ...sender, url: chrome.runtime.getURL('options.html#/settings/profile') }, { ...sender, url: 'https://example.test/dashboard.html' }]) {
    assert.equal(await request('DASHBOARD_SELECT_PROFILE', { candidateId: 'dashboard-profile' }, blocked), null);
  }
});

test('dock records use the real Studio draft and validator, and web pages cannot call dock record operations', async t => {
  const {request,chrome,createdTabs}=await coordinator(t);
  chrome.runtime.sendMessage=async()=>({ok:true});
  const sender={id:chrome.runtime.id,url:chrome.runtime.getURL('dashboard.html'),frameId:0};
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
  for(const operation of DOCK_RECORD_OPERATIONS)for(const blocked of [{...sender,url:chrome.runtime.getURL('options.html#/')},{...sender,url:chrome.runtime.getURL('options.html#/settings/prompts')},{...sender,frameId:1},{...sender,url:'https://example.test/dashboard.html'}])assert.equal(await request(operation,{},blocked),null,operation);
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
  const invalid = await request('PROMPT_SAVE', { template: { ...template, text: '{{candidate_profile}}' }, expectedRevision: save.result.revision }, sender);
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
  assert.ok(preview.text.includes('Senior') && preview.text.includes('Use concise factual bullets.') && preview.text.includes('A real job description.'));
  const other = await request('CANDIDATE_GET', { candidateId: 'another-profile' }, sender);
  assert.equal(other.ok, false);
  assert.equal(other.error.code, 'CANDIDATE_CONFLICT');
  for (const blocked of [
    { ...sender, frameId: 1 }, { ...sender, url: chrome.runtime.getURL('options.html#/settings/profile') },
    { ...sender, url: chrome.runtime.getURL('options.html#/dashboard') }, { ...sender, url: 'https://example.test/options.html#/settings/prompts' },
  ]) assert.equal(await request('PROMPT_SAVE', { template, expectedRevision: 1 }, blocked), null);
  assert.equal(await request('WORKSPACE_ATTACH', { visible: true }, sender), null);
});

test('owned Studio selectors assign saved prompts, switch candidates and preserve drafts and profile facts', async t => {
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
  assert.equal(selected.ok, true, selected.error?.message);
  assert.equal(selected.result.candidate.document.applicationPreferences.assignedPromptTemplateId, template.id);
  assert.deepEqual(chrome.storage.local.values.profile, original);
  const conflict = await request('PROMPT_SELECT', { candidateId: initial.candidate.id, templateId: template.id, expectedCandidateRevision: initial.candidate.revision, mutationId: crypto.randomUUID() });
  assert.equal(conflict.ok, false); assert.equal(conflict.error.code, 'CONFLICT');
  const copied = await request('COPY_PROMPT_JD', { candidateId: initial.candidate.id, expectedRevision: written.result.record.draft.revision });
  assert.equal(copied.ok, true, copied.error?.message);
  assert.equal(copied.result.templateId, template.id);
  assert.match(copied.result.manualText, /STUDIO PROMPT[\s\S]*Keep this job description/);
  const imported = await request('CANDIDATE_IMPORT', { raw: JSON.stringify({ schemaVersion: 2, kind: 'application-tracker-candidate', candidate: { id: 'second-selector-candidate', name: 'Second Candidate' } }), filename: 'candidate.json', mutationId: crypto.randomUUID() });
  assert.equal(imported.ok, true);
  const stale = await request('PROMPT_SELECT', { candidateId: initial.candidate.id, templateId: template.id, expectedCandidateRevision: selected.result.candidate.revision, mutationId: crypto.randomUUID() });
  assert.equal(stale.ok, false); assert.equal(stale.error.code, 'CANDIDATE_CONFLICT');
  assert.equal((await request('CANDIDATE_SELECT', { candidateId: initial.candidate.id })).ok, true);
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

test('Autofill message router yields Studio requests without claiming their response channel', async () => {
  const source = await readFile('extension/background.js', 'utf8');
  const start = source.indexOf('chrome.runtime.onMessage.addListener(');
  const end = source.indexOf(',chrome.tabs.onCreated.addListener', start);
  assert.ok(start >= 0 && end > start);
  let callback;
  vm.runInNewContext(source.slice(start, end), {
    chrome: { runtime: { onMessage: { addListener: fn => { callback = fn; } } } },
    gg: () => { throw new Error('Autofill must not inspect the Studio protocol.'); },
  });
  assert.equal(callback({ version: 1, operation: 'CANDIDATE_IMPORT' }, {}, () => {}), false);
  assert.equal(callback({ target: 'owning-workspace-export:v1' }, {}, () => {}), false);
  assert.equal(callback({ target: 'flush-resume-settings:v1' }, {}, () => {}), false);
  assert.equal(callback({ target: 'flush-studio-navigation:v1' }, {}, () => {}), false);
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
  const { request, sandbox: worker, chrome } = await coordinator(t);
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
  const renderer = vm.createContext({ resumeSectionOrder, skillsFirstTemplate, layoutResumeParagraph,
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
