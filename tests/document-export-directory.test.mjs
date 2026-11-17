import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocumentDirectoryWriter,requestDocumentExportAccess} from '../extension/studio/document-export-directory.js';
import {createDocumentDownloads} from '../extension/ai-apply/src/document-downloads.mjs';
import {DEFAULT_EXPORT_ROOT_KEY} from '../extension/studio/default-export-root.js';
import {documentFilename} from '../extension/ai-apply/src/document-export.mjs';
import {exportDocuments} from '../extension/ai-apply/src/document-export.mjs';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

function folder(name,permission='granted'){
 const files=new Map(),folders=new Map();
 return {name,files,folders,queryPermission:async()=>permission,
  async getDirectoryHandle(name){if(!folders.has(name))folders.set(name,folder(name));return folders.get(name);},
  async getFileHandle(name,{create=false}={}){
   if(!files.has(name)){if(!create)throw Object.assign(Error('Not found'),{name:'NotFoundError'});files.set(name,new Uint8Array());}
   return {createWritable:async()=>({write:async bytes=>files.set(name,new Uint8Array(bytes)),close:async()=>{}}),getFile:async()=>({size:files.get(name).length})};
  }};
}
function configured(permission){
 const handle=folder('Exports',permission),roots=new Map([['chosen',{id:'chosen',name:'Exports',handle}]]),storage=memoryStorage({[DEFAULT_EXPORT_ROOT_KEY]:{id:'chosen',name:'Exports'}}),directories={root:async id=>roots.get(id),bind:async record=>roots.set(record.id,record),matching:async()=>null};
 return {handle,storage,directories,write:createDocumentDirectoryWriter({storage,directories})};
}
const run={job:{input:{candidateId:'candidate',job:{company:'Example / Employer'}}}},file={filename:'Resume.pdf',bytes:new TextEncoder().encode('%PDF-1.7 test'),kind:'resume',format:'pdf',mime:'application/pdf'};

test('PDFs use only the candidate name and cover letter inside the company folder, replacing the previous PDFs',async()=>{
 const f=configured(),resume={...file,filename:documentFilename('Jordan Taylor','Example / Employer','resume','pdf')},letter={...file,kind:'cover-letter',filename:documentFilename('Jordan Taylor','Example / Employer','cover-letter','pdf')};
 const first=await f.write(resume,run),second=await f.write({...resume,bytes:new TextEncoder().encode('%PDF replacement')},run),third=await f.write(letter,run),files=f.handle.folders.get('Example _ Employer').files;
 assert.equal(first.relativePath,'Example _ Employer/Jordan Taylor.pdf');assert.equal(second.relativePath,first.relativePath);assert.equal(third.relativePath,'Example _ Employer/cover letter.pdf');
 assert.equal(new TextDecoder().decode(files.get('Jordan Taylor.pdf')),'%PDF replacement');assert.equal(files.size,2);assert.deepEqual(files.get('cover letter.pdf'),file.bytes);
 assert.equal(documentFilename('CON','Employer','resume','pdf'),'_CON.pdf');assert.equal(documentFilename('A/B','Employer','resume','pdf'),'A_B.pdf');
});

test('exports use Chrome downloads only when no folder is configured, and report unavailable or denied folders',async()=>{
 const write=createDocumentDirectoryWriter({storage:memoryStorage({}),directories:{}});assert.equal(await write(file,run),null);
 const denied=configured('denied');await assert.rejects(()=>denied.write(file,run),/Allow access/);assert.equal(denied.handle.folders.size,0);
 const missing=createDocumentDirectoryWriter({storage:memoryStorage({[DEFAULT_EXPORT_ROOT_KEY]:{id:'gone',name:'Old'}}),directories:{root:async()=>null}});await assert.rejects(()=>missing(file,run),/unavailable/);
 const f=configured();await assert.rejects(()=>f.write({...file,filename:'../escape.pdf'},run),/filename is invalid/);
});

test('an explicit download renews folder permission while background exports never prompt',async()=>{
 const f=configured('prompt');let permission='prompt',requests=0;f.handle.queryPermission=async()=>permission;f.handle.requestPermission=async()=>{requests++;return permission='granted';};
 await assert.rejects(()=>f.write(file,run),/Allow access/);assert.equal(requests,0);
 await requestDocumentExportAccess('candidate',f);assert.equal(requests,1);await f.write(file,run);await requestDocumentExportAccess('candidate',f);assert.equal(requests,1);
 permission='denied';f.handle.requestPermission=async()=> 'denied';await assert.rejects(()=>requestDocumentExportAccess('candidate',f),/Folder access was not allowed/);
});

test('saved document downloads export the selected PDF even with automatic downloads and all generation modules off',async t=>{
 const state={runs:[]},cached=new Map(),rendered=[],downloads=[],job={id:'saved',state:'attention',input:{candidateId:'candidate',profile:{name:'Jordan Taylor'},job:{company:'Employer'}},resume:{company:'Employer',title:'Engineer',summary:'',skills:[],experience:[],education:[]},coverLetterEnabled:true,coverLetter:'Saved letter'};
 const store={get:async id=>structuredClone(state.runs.find(run=>run.id===id)),change:async edit=>({value:edit(state)}),update:async(id,edit)=>{const index=state.runs.findIndex(run=>run.id===id);state.runs[index]=edit(structuredClone(state.runs[index]));return{value:structuredClone(state.runs[index])};}};
 const browser={runtime:{sendMessage:async()=>({}),getURL:path=>'chrome-extension://test/'+path},storage:{local:memoryStorage({documentSettings:{selectedModules:[],formats:['json'],autoDownload:false,autoPreview:false}})},downloads:{onChanged:event(),download:async data=>{downloads.push(data);return downloads.length;},search:async()=>[{state:'complete'}]}};
 let count=0;const delivery=createDocumentDownloads({browser,store,jobs:{getJob:async()=>job},uuid:()=>String(++count),files:{put:async value=>cached.set(value.key,value),get:async key=>cached.get(key)},exportFiles:run=>exportDocuments(run,{renderPDF:async(_,kind)=>{rendered.push(kind);return{base64:btoa('%PDF-1.7 test')};}})});t.after(()=>delivery.dispose());
 const resume=await delivery.startSaved(job.id,'resume');assert.equal(resume.state,'complete');assert.equal(downloads[0].filename,'Employer/Jordan Taylor.pdf');
 job.resume={invalid:true};const letter=await delivery.startSaved(job.id,'cover-letter');assert.equal(letter.state,'complete');assert.equal(downloads[1].filename,'Employer/cover letter.pdf');assert.deepEqual(rendered,['resume','cover-letter']);assert.ok(downloads.every(file=>file.url.startsWith('data:application/pdf')));
});

test('a profile export-folder override takes precedence over the default root',async()=>{
 const f=configured(),override=folder('Profile');await f.storage.set({'autofill-profile:candidate':{studio:{applicationPreferences:{exportDirectory:'Profile'}}}});f.directories.matching=async(candidate,name)=>candidate==='candidate'&&name==='Profile'?{name,handle:override}:null;
 await f.write(file,run);assert.equal(override.folders.get('Example _ Employer').files.size,1);assert.equal(f.handle.folders.size,0);
});

test('a completed job analysis supplies the company folder when the captured listing company was incomplete',async()=>{
 const f=configured(),result=await f.write(file,{...run,result:{job:{company:'Analyzed Employer'}}});assert.equal(result.relativePath,'Analyzed Employer/Resume.pdf');
});

test('folder delivery marks files complete and opens the cached PDF preview without starting a Chrome download',async t=>{
 const f=configured(),state={...run,id:'generation',phase:'complete',result:{resume:{}},documentSettings:{selectedModules:['resume'],formats:['pdf'],autoDownload:true,autoPreview:true}},cached=new Map(),previews=[];
 const browser={runtime:{sendMessage:async()=>({}),getURL:path=>'chrome-extension://test/'+path},storage:{local:memoryStorage({})},downloads:{onChanged:event(),download:()=>{throw Error('Chrome download should not run');}},tabs:{query:async()=>[],create:async data=>previews.push(data)}};
 const store={get:async()=>structuredClone(state),update:async(id,edit)=>{Object.assign(state,edit(structuredClone(state)));return {value:structuredClone(state)};}};
 const delivery=createDocumentDownloads({browser,store,jobs:{},files:{put:async value=>cached.set(value.key,value),get:async key=>cached.get(key)},saveGenerated:async()=>{},exportFiles:async()=>({files:[file],errors:[]}),writeToDirectory:f.write});t.after(()=>delivery.dispose());
 await delivery.start(state.id);assert.equal(state.downloads.state,'complete');assert.equal(state.downloads.files[0].destination.rootName,'Exports');assert.equal(cached.get(state.downloads.files[0].key).state,'complete');assert.equal(previews.length,1);assert.match(previews[0].url,/preview\.html\?aiFile=/);
 await delivery.start(state.id);assert.equal(previews.length,1,'a repeated notification must not export again');
});
