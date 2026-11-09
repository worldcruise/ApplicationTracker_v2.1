import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createDockApplyApi} from '../extension/studio/dock-apply-api.js';
import {emptyProfile} from '../extension/studio/profile-model.js';

test('dock resume parsing uses the existing multipart endpoint and AI refuses a different synced candidate',async()=>{
  const profile=emptyProfile();profile.profileName='Candidate';profile.nameData.firstName='Jordan';let request,generated=0;
  const dependencies={request:async value=>{request=value;return{skillsData:['Testing']};},profileSchema:{partial:()=>({partial:true})},authenticated:async()=>true,selectedProfile:async()=>({id:'remote-profile'}),lastSyncedProfile:async()=>null,fetchProfile:async()=>structuredClone(profile),storeJob:async()=>{},generate:async()=>{generated++;return{text:'Factual draft'};}};
  const api=createDockApplyApi(dependencies);assert.deepEqual(await api.parseResume({base64:btoa('PDF'),fileName:'Resume.pdf'}),{skillsData:['Testing']});assert.equal(request.path,'/api/ext/resume');assert.equal(request.auth,false);assert.equal(request.requestOptions.body.get('resume').name,'Resume.pdf');
  assert.equal(await api.generateAnswer({profile,tabId:7,url:'https://example.test/job',description:'Job description',title:'Engineer',prompt:'Why this job?'}),'Factual draft');
  await assert.rejects(api.generateAnswer({profile:{...profile,profileName:'Another candidate'},tabId:7,prompt:'Why?'}),/differs from this run/);assert.equal(generated,1);
  dependencies.authenticated=async()=>false;await assert.rejects(createDockApplyApi(dependencies).generateAnswer({profile}),/Sign in/);
});

test('the real packaged background exposes working dock persistence from its bundle scope',async()=>{
  const values={appliedList:[]},event={addListener(){},removeListener(){}};
  const local={get(keys,callback){const result=keys==null?values:Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,values[key]]));callback?.(result);return Promise.resolve(result);},set(input,callback){Object.assign(values,input);callback?.();return Promise.resolve();},remove(){return Promise.resolve();}};
  const chrome={runtime:{id:'background-test',getURL:path=>`chrome-extension://background-test/${path}`,getManifest:()=>({version:'2.1.15'}),onMessage:event,onConnect:event,onInstalled:event},storage:{local,session:local,onChanged:event}};
  // Avoid installation/startup registrations; exercise the unchanged real bundle
  // definitions and its public adapters against Chrome-style local persistence.
  const source=(await readFile('extension/background.js','utf8')).replace(/^import[^\n]+\n/gm,'').replace(/export const /g,'var ').replace('yg=_g.main()','yg=void 0');
  const context=vm.createContext({chrome,createDockApplyApi,console,URL,URLSearchParams,Headers,Request,Response,WebSocket,fetch:()=>{throw Error('Unexpected network request');},Blob,File,FormData,TextEncoder,TextDecoder,atob,btoa,setTimeout,clearTimeout,setInterval:()=>0,clearInterval,crypto,structuredClone});
  vm.runInContext(source,context);
  const application={jobTitle:'Engineer',jobLink:'https://example.test/job',companyName:'Company',companyLink:'https://example.test',appliedDate:new Date('2026-11-08T18:00:00Z'),profileDetails:{profileName:'Candidate'},duplicateCheck:true};
  await context.saveDockApplication(application);await context.saveDockApplication(application);
  assert.equal(values.appliedList.length,1);assert.equal(values.appliedList[0].profileName,'Candidate');assert.equal(typeof context.parseDockResume,'function');assert.equal(typeof context.generateDockAnswer,'function');
});
