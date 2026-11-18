import {Window} from 'happy-dom';
import {setTimeout as delay} from 'node:timers/promises';
import {IDBFactory} from 'fake-indexeddb';
import {emptyProfile,profileToStudio} from '../extension/studio/profile-model.js';
import {DEFAULT_PROMPT} from '../extension/studio/prompt-repository.js';

const route=process.argv[2]||'/dashboard',action=process.argv[3],page=new Window({url:'chrome-extension://web-runtime/options.html#'+route});
page.document.body.innerHTML='<div id="root"></div>';
const errors=[],originalError=console.error;console.error=(...args)=>errors.push(args.map(value=>value?.stack||String(value)).join(' '));
page.addEventListener('error',event=>{errors.push(event.error?.message||event.message);event.preventDefault();});
process.on('unhandledRejection',error=>errors.push(error.stack||String(error)));
for(const key of ['window','document','navigator','location','history','localStorage','sessionStorage','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','Node','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','DOMException','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia']){
  const value=key==='window'?page:page[key];Object.defineProperty(globalThis,key,{configurable:true,writable:true,value:typeof value==='function'&&['getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia'].includes(key)?value.bind(page):value});
}
function event(){const listeners=new Set();return{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn),emit:(...args)=>{for(const fn of listeners)fn(...args);}};}
const changes=event(),profile=emptyProfile();profile.nameData.firstName='Runtime';profile.nameData.lastName='Candidate';
const candidate={id:'profile',revision:1,profile,document:profileToStudio(profile,'profile',{})},now=Date.now();
const saved={profile,dailyGoal:10,'ui-theme:v1':'light',appliedList:[
  {id:'application',jobTitle:'Runtime Engineer',companyName:'Example',jobLink:'https://example.test/job',companyLink:'https://example.test',date:new Date(now-1000).toString(),createdAt:new Date(now-1000).toISOString(),status:'applied',profileName:'Default'},
  {id:'screen',jobTitle:'Platform Engineer',companyName:'Acme',jobLink:'https://acme.test/job',companyLink:'https://acme.test',date:new Date(now-86400000).toString(),status:'screen',profileName:'Default'}
], 'meeting-details:v1':{screen:{kind:'screen',round:1,mode:'phone',phone:'+12025550123',startsAt:new Date(now+1800000).toISOString(),endsAt:new Date(now+3600000).toISOString(),result:'pending'}},'meeting-timezone:v1':'UTC'};
const local={get:async keys=>keys==null?structuredClone(saved):Object.fromEntries((typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys)).filter(key=>key in saved).map(key=>[key,structuredClone(saved[key])])),set:async patch=>{Object.assign(saved,patch);changes.emit(Object.fromEntries(Object.entries(patch).map(([key,newValue])=>[key,{newValue}])),'local');},remove:async()=>{}};
const actions=[];
globalThis.indexedDB=new IDBFactory();
globalThis.chrome={runtime:{id:'web-runtime',getURL:value=>'chrome-extension://web-runtime/'+value.replace(/^\//,''),getManifest:()=>({version:'2.1.24',commands:{}}),onMessage:event(),onConnect:event(),sendMessage:async message=>{
  const result={requestId:message.requestId,ok:true};
  if(message.operation==='DOCK_RECORDS_STATE')result.result={candidate:{id:candidate.id,name:'Runtime Candidate'},candidates:[],jobs:[],applications:saved.appliedList.map(row=>({id:row.id,type:'applications',workflowApplicationId:row.id,revision:'1',role:row.jobTitle,company:row.companyName,status:row.status,url:row.jobLink,createdAt:row.createdAt||new Date(row.date).toISOString(),updatedAt:row.createdAt||new Date(row.date).toISOString(),salary:'USD 100000',description:'Build reliable services.',resume:null,events:[]}))};
  else if(message.operation==='PROFILE_STATE')result.result={candidate,profile};
  else if(message.operation==='PROMPT_SETTINGS')result.result={candidate,library:{templates:[DEFAULT_PROMPT],selectedId:DEFAULT_PROMPT.id,revision:1}};
  else if(message.operation==='CANDIDATE_GET')result.result={candidate};
  else if(message.operation==='OPEN_STUDIO_PREVIEW'){actions.push(message);result.result={};}
  else if(message.operation==='DOCK_RECORDS_MUTATE'){actions.push(message);result.result={applications:[],jobs:[]};}
  else{actions.push(message);result.result={candidate};}
  return result;
}},storage:{local,session:local,onChanged:changes},commands:{getAll:async()=>[{name:'read-job-page',shortcut:'Ctrl+Shift+F'}]},windows:{getCurrent:async()=>({id:41,type:'normal'})},tabs:{query:async()=>[],getCurrent:async()=>({id:7,windowId:41}),create:async value=>{actions.push(value);return{id:7,...value};},update:async(id,value)=>({id,...value})}};
function assert(value,message){if(!value)throw Error(message);}
try{
  await import('../extension/web-app.js');
  for(let index=0;index<100&&!document.querySelector('.web-app-main');index++)await delay(10);
  await delay(200);
  if(action==='sidebar-toggle'){
    const toggle=document.querySelector('.workspace-sidebar-toggle');assert(toggle,'Sidebar toggle missing');toggle.click();await delay(20);
    assert(document.documentElement.dataset.webSidebarCollapsed==='true','Sidebar did not collapse');location.hash='/settings/other';await delay(30);assert(document.documentElement.dataset.webSidebarCollapsed==='true','Navigation lost the sidebar preference');
  }
  if(action==='filters'){
    const search=document.querySelector('[data-test=applications-table-filter-input]');assert(search,'Application search missing');
    const setter=Object.getOwnPropertyDescriptor(page.HTMLInputElement.prototype,'value').set;setter.call(search,'Acme');search.dispatchEvent(new page.Event('input',{bubbles:true}));await delay(30);
    assert(!document.querySelector('tbody')?.textContent.includes('Runtime Engineer'),'Application search did not filter rows');
  }
  if(action==='application-board'){
    document.querySelector('[data-record-view=board]').click();
    for(let attempt=0;attempt<100&&!document.querySelector('[data-test=applications-board-column-applied] .application-status-tag');attempt++)await delay(10);
    assert(document.querySelector('[data-test=applications-board]'),'Application board missing');assert(document.querySelector('[data-test=applications-board-column-applied] .application-status-tag')?.textContent==='Applied','An application was rendered as a pending meeting');
  }
  if(action==='application-transfer'){
    const button=label=>[...document.querySelectorAll('.application-manage-menu button')].find(node=>node.textContent===label);
    assert(button('Import')&&button('Export'),'Applications Manage is missing import or export');
    let exported,filename;URL.createObjectURL=blob=>{exported=blob;return'blob:test-export';};URL.revokeObjectURL=()=>{};page.HTMLAnchorElement.prototype.click=function(){filename=this.download;};
    button('Export').click();await delay(30);
    const full=document.querySelector('[aria-label="Export the application data"]');assert(full&&!full.checked,'Full application export must be opt-in');
    full.click();document.querySelector('[aria-label="Select all shown records"]').click();document.querySelector('.record-export-confirm').click();await delay(30);
    assert(filename?.endsWith('.json'),'Full application export did not download JSON');const data=JSON.parse(await exported.text());assert(data.applications[0].status==='applied'&&data.applications[0].created_at,'Full export lost status or created_at');
    button('Import').click();await delay(20);const file=document.querySelector('.queue-import-dialog input[type=file]');assert(file?.accept.includes('.json'),'Applications importer does not accept JSON');document.querySelector('.queue-import-dialog .record-delete-close').click();
    document.querySelector('[data-record-view=cards]').click();await delay(80);assert(button('Import')&&button('Export'),'Card view has no import/export');
    document.querySelector('[data-record-view=board]').click();await delay(100);assert(button('Import')&&button('Export'),'Board view has no import/export');
  }
  if(action==='calendar-ranges'){
    assert(document.querySelector('.meeting-calendar-view'),'Calendar missing');
    const controls=[...document.querySelectorAll('button')];for(const label of ['Day','Week','Month'])assert(controls.some(button=>button.textContent.trim()===label),label+' calendar control missing');
  }
  if(action==='header-actions'){
    document.querySelector('.web-theme-toggle').click();await delay(30);assert(saved['ui-theme:v1']==='dark','Theme did not save');
    assert(!document.querySelector('.web-sign-in,.web-db-button'),'Retired account controls are still present');
  }
  if(action==='studio')assert(actions.some(value=>value.operation==='OPEN_STUDIO_PREVIEW'),'Resume Studio navigation did not open its preview');
  const report={route,errors,headings:[...document.querySelectorAll('h1,h2')].map(node=>node.textContent),text:document.querySelector('.web-app-main')?.textContent,applicationBoard:!!document.querySelector('[data-test=applications-board]')};
  originalError(JSON.stringify(report));if(errors.length)process.exitCode=1;
}catch(error){originalError(error);process.exitCode=1;}finally{console.error=originalError;await page.happyDOM.abort();process.exit(process.exitCode||0);}
