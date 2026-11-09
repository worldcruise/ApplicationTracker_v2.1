import { Window } from 'happy-dom';
import { dockFixture } from './dock-records-fixture.mjs';
import { createDockApplyService } from '../../extension/studio/dock-apply-service.js';
import { createApplyForm } from '../../extension/studio/dock-apply-form.js';
import { emptyProfile } from '../../extension/studio/profile-model.js';

export async function applyFixture(t) {
  const base=await dockFixture(t),{browser,deps,storage}=base;
  const first=await deps.profiles.bootstrap();first.profile={...emptyProfile(),profileName:'Profile One',nameData:{firstName:'Jordan',lastName:'Taylor',preferredName:false},contactData:{...emptyProfile().contactData,email:'jordan@example.test'}};
  const second={...structuredClone(first),id:'candidate-2',profile:{...structuredClone(first.profile),profileName:'Profile Two'},document:{candidate:{id:'candidate-2',name:'Second Candidate'}}};
  const profiles=new Map([[first.id,first],[second.id,second]]);let selected=first.id;
  Object.assign(deps.profiles,{bootstrap:async()=>structuredClone(profiles.get(selected)),get:async id=>structuredClone(profiles.get(id)),list:async()=>[...profiles.values()].map(profile=>({id:profile.id,name:profile.document.candidate.name})),select:async id=>{if(!profiles.has(id))throw Error('Missing profile');selected=id;},
    updateCanonical:async input=>{const record=profiles.get(input.candidateId);if(record.revision!==input.expectedRevision)throw Error('Profile conflict');record.profile=structuredClone(input.profile);record.revision++;return structuredClone(record);}});
  const pages=new Map(),openTabs=new Map(),sent=[],rendered=[],generated=[];let nextTab=101;
  browser.windows.get=async id=>({id,type:'normal'});
  function employer(html='<form><label>First name<input name="firstName" required></label><label>Email<input type="email" name="email" required></label><label>Resume<input type="file" name="resume" required></label><label>Why are you interested?<textarea name="why" required></textarea></label><label>When could you start?<input name="availability" required></label><button type="submit">Submit application</button></form>',url='https://example.test/application',id=7) {
    const page=new Window({url});page.document.body.innerHTML=html;let uploads=0,submits=0;
    page.document.querySelector('form')?.addEventListener('submit',event=>{event.preventDefault();submits++;});
    const form=createApplyForm(page.document,{uploadResume(node,resume){const file=new page.File(['%PDF fixture'],resume.fileName,{type:'application/pdf'}),transfer=new page.DataTransfer();transfer.items.add(file);node.files=transfer.files;uploads++;}});
    pages.set(id,{page,form,uploads:()=>uploads,submits:()=>submits});openTabs.set(id,{id,windowId:41,url,status:'complete',active:true,title:'Employer application'});t.after(()=>page.happyDOM.abort());return pages.get(id);
  }
  browser.tabs.query=async({windowId}={})=>[...openTabs.values()].filter(tab=>windowId===undefined||tab.windowId===windowId);
  browser.tabs.get=async id=>{if(!openTabs.has(id))throw Error('Tab not found');return structuredClone(openTabs.get(id));};
  browser.tabs.create=async input=>{base.tabs.push(input);const id=nextTab++;employer(undefined,input.url,id);const tab={id,windowId:41,...input,status:'complete'};openTabs.set(id,tab);return tab;};
  browser.tabs.update=async(id,input)=>{Object.assign(openTabs.get(id),input);return openTabs.get(id);};
  browser.scripting={executeScript:async({target})=>{if(!pages.has(target.tabId))throw Error('No employer page');return[{frameId:0,documentId:`document-${target.tabId}`}];}};
  browser.tabs.sendMessage=async(id,message,options)=>{sent.push({id,message,options});try{return{ok:true,result:await pages.get(id).form.request(message)};}catch(error){return{ok:false,error:error.message};}};
  const sender={id:browser.runtime.id,url:browser.runtime.getURL('dashboard.html')};
  const serviceDeps={browser,storage,profiles:deps.profiles,records:{handle:(...args)=>base.request(...args)},renderSnapshot:async snapshot=>{rendered.push(structuredClone(snapshot));return{base64:btoa('%PDF-1.7\nPrepared queue snapshot')}} ,parseResume:async()=>({skillsData:['Parsed skill']}),generateAnswer:async context=>{generated.push(context);return'I build reliable services and want to contribute.';}};
  let service=createDockApplyService(serviceDeps);
  const request=(operation,payload={})=>service.handle(operation,{windowId:41,...payload},sender);
  const action=(run,action,extra={})=>request('DOCK_APPLY_ACTION',{runId:run.id,action,...extra});
  return {...base,profiles,openTabs,pages,sent,rendered,generated,employer,serviceDeps,request,action,recordsRequest:base.request,start:job=>request('DOCK_APPLY_START',{jobId:job.id,tabId:7}),settled:()=>service.settled(41),restart(){service=createDockApplyService(serviceDeps);},bumpProfile(){profiles.get(selected).revision++;}};
}
