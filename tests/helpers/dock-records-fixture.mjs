import { createDockRecordsService } from '../../extension/studio/dock-records-service.js';
import { createStudioStorage } from '../../extension/studio/storage.js';
import { IDBFactory } from 'fake-indexeddb';
export function event() { const listeners = new Set(); return { addListener:fn => listeners.add(fn),removeListener:fn => listeners.delete(fn),emit:(...args) => listeners.forEach(fn => fn(...args)) }; }
export function memoryStorage(initial = {}, changed, area) {
  const values = structuredClone(initial);
  return { values, async get(keys = null) { return structuredClone(keys == null ? values : Object.fromEntries((typeof keys === 'string' ? [keys] : keys).filter(key => key in values).map(key => [key,values[key]]))); },
    async set(input) { const changes = Object.fromEntries(Object.entries(input).map(([key,newValue]) => [key,{oldValue:values[key],newValue}])); Object.assign(values,structuredClone(input)); changed?.emit(changes,area); },async remove(key) { delete values[key]; } };
}
export async function dockFixture(t) {
  const changed = event(), storage = createStudioStorage({indexedDB:new IDBFactory(),BroadcastChannel:null}); t.after(() => storage.close());
  const candidate = { id:'candidate-1',revision:1,profile:{profileName:'Profile One'},document:{candidate:{id:'candidate-1',name:'Test Candidate'},applicationPreferences:{}} };
  let draft = { id:'draft',candidateId:candidate.id,revision:0,jobInputRaw:'',cvJsonRaw:'',coverLetterRaw:'',coverLetterEnabled:false,documentTemplate:{id:'rendercv-classic',version:1} };
  const tabs = [], sync = [], browser = {
    runtime:{id:'dock-test',getURL:path => `chrome-extension://dock-test/${path}`,sendMessage:async () => ({ok:true})},
    storage:{local:memoryStorage({appliedList:[{jobTitle:'Existing role',companyName:'Existing company',jobLink:'https://example.test/existing',companyLink:'https://example.test',date:new Date(2026,10,8).toString(),status:'applied',profileName:'Profile One',extra:'preserved'}]},changed,'local'),session:memoryStorage({},changed,'session'),onChanged:changed},
    windows:{getCurrent:async () => ({id:41,type:'normal'})},tabs:{query:async () => [],create:async input => { tabs.push(input); return {id:100,...input}; }},
  };
  const deps = { browser,storage,profiles:{bootstrap:async () => structuredClone(candidate),get:async id => id === candidate.id ? structuredClone(candidate) : null,select:async id => { if(id !== candidate.id) throw Error('Missing candidate'); }},
    drafts:{read:async () => ({draft:structuredClone(draft)}),bootstrap:async () => ({record:{draft:structuredClone(draft)}}),save:async input => { if(input.expectedRevision !== draft.revision) throw Error('Draft conflict'); draft={...structuredClone(input.draft),revision:draft.revision+1}; return {record:{draft:structuredClone(draft)}}; },
      settings:async input=>{if(input.expectedRevision!==draft.revision)throw Error('Draft settings conflict');draft={...draft,documentTemplate:{id:input.templateId,version:1},formattingOverrides:structuredClone(input.overrides),bindings:structuredClone(input.bindings),revision:draft.revision+1};return {record:{draft:structuredClone(draft)}};}},
    prompts:{read:async () => ({selectedId:'prompt',templates:[{id:'prompt',title:'Factual prompt',text:'{{candidate_profile}} {{job_description}}'}]})},
    validateResume:raw => { try { const value=JSON.parse(raw); return value.company && value.title && value.summary && Array.isArray(value.skills) && Array.isArray(value.experience) && Array.isArray(value.education) ? {value} : {message:'Invalid CV'}; } catch {return {message:'Invalid CV JSON'};} },
    makeSnapshot:(profile,draft) => ({snapshot:{candidate:profile.document.candidate,resume:JSON.parse(draft.cvJsonRaw),bindings:structuredClone(draft.bindings||{experience:[],education:[]}),profile:{contact:['test@example.test']}}}),openStudio:async () => ({tabId:100}),
    saveApplication:async input => { const values=browser.storage.local.values, record={jobTitle:input.jobTitle,jobLink:input.jobLink,companyName:input.companyName,companyLink:input.companyLink,date:input.appliedDate.toString(),profileName:input.profileDetails.profileName,status:'applied'}; if(!values.appliedList.some(item=>item.jobLink===record.jobLink&&item.date===record.date&&item.profileName===record.profileName)) await browser.storage.local.set({appliedList:[record,...values.appliedList]}); },
    syncApplication:async input => {sync.push(input);},now:() => '2026-11-08T18:00:00.000Z',
  };
  let service = createDockRecordsService(deps);
  const request = (operation,payload = {}) => service.handle(operation,payload,{id:browser.runtime.id,url:browser.runtime.getURL('dashboard.html')});
  const mutate = (action,record,fields,extra = {}) => request('DOCK_RECORDS_MUTATE',{action,type:record?.type || 'queue',id:record?.id,expectedRevision:record?.revision,mutationId:crypto.randomUUID(),fields,...extra});
  const create = async (suffix = 'one') => {const state=await mutate('create',null,{company:'Example',role:'Engineer',url:`https://example.test/${suffix}`,description:'Build reliable software.',notes:'Initial notes',conversationUrl:'https://chatgpt.com/c/test-chat'});return state.jobs.find(item=>item.id===state.selectedId);};
  async function ready(record,{cv,bindings}={}) {
    await request('DOCK_RECORDS_STUDIO',{id:record.id,expectedRevision:record.revision,windowId:41});
    draft.cvJsonRaw=JSON.stringify(cv||{company:record.company,title:record.role,summary:'Real saved summary',skills:[],experience:[],education:[]});
    draft.bindings=bindings||{experience:[],education:[]};
    const state=await request('DOCK_RECORDS_STATE'),updated=state.jobs.find(item=>item.id===record.id);
    const result=await request('DOCK_RECORDS_RESUME',{id:record.id,expectedRevision:updated.revision,windowId:41});return result.jobs.find(item=>item.id===record.id);
  }
  return { browser,storage,deps,request,mutate,create,ready,tabs,sync,get draft(){return draft;},restart(){service=createDockRecordsService(deps);} };
}
