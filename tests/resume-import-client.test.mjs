import test from 'node:test';
import assert from 'node:assert/strict';
import {parseResumeUpload} from '../extension/studio/resume-import-client.js';
import {prepareResumeProfile} from '../extension/studio/single-profile-service.js';
import {emptyProfile} from '../extension/studio/profile-model.js';

const input={fileName:'resume.pdf',base64:btoa('%PDF-1.7 synthetic resume')};
const profile={nameData:{firstName:'Parsed',lastName:'Person',preferredName:false},skillsData:['Python','SQL'],jobData:[{company:'Acme',jobTitle:'Engineer',location:'Boston',startDate:'01/2020',endDate:'12/2022',currentlyWorkHere:false,description:'• Built reliable services.\n• Improved latency.'}],educationData:[{school:'University of North Florida',degree:"Bachelor's",fieldOfStudy:'Science in Electrical Engineering',currentlyAttending:false}]};

test('parsed uploads produce the current six-field Studio JSON without the retired extraction engine',async()=>{
 const parsed=await parseResumeUpload({...input,includeMetadata:true},{parse:async()=>profile});assert.deepEqual(parsed.profile,profile);assert.equal(parsed.cv.company,'Unknown');assert.equal(parsed.cv.title,'Engineer');assert.deepEqual(parsed.cv.skills,[{Skills:['Python','SQL']}]);assert.deepEqual(parsed.cv.experience[0].sentences,['Built reliable services.','Improved latency.']);
});
test('service errors do not silently invoke the local parser or overwrite a saved profile',async()=>{
  await assert.rejects(parseResumeUpload(input,{parse:async()=>{throw Error('Service unavailable');}}),/Application Tracker.*Service unavailable/);
  assert.deepEqual(await parseResumeUpload(input,{parse:async()=>({})}),{});
  const empty={nameData:{firstName:'',lastName:'',preferredName:false},jobData:[],educationData:[]};assert.deepEqual(await parseResumeUpload(input,{parse:async()=>empty}),empty);
  await assert.rejects(parseResumeUpload(input,{parse:async()=>null}),/invalid profile/);
  let requests=0;await assert.rejects(parseResumeUpload({...input,base64:btoa('%PDF-'+ 'x'.repeat(1024*1024))},{parse:async()=>requests++}),/1 MB/);assert.equal(requests,0);
  const saved=emptyProfile();saved.nameData.firstName='Original';saved.resumeData.resumeBase64=btoa('%PDF-original');const parsed=await parseResumeUpload({...input,includeMetadata:true},{parse:async()=>structuredClone(profile)}),next=prepareResumeProfile(saved,parsed.profile,input,{cv:parsed.cv});assert.equal(next.profile.nameData.firstName,'Parsed');assert.deepEqual(next.profile.jobData,profile.jobData);assert.deepEqual(next.profile.educationData,profile.educationData);assert.equal(saved.resumeData.resumeBase64,btoa('%PDF-original'));assert.equal(JSON.parse(next.profile.resumeData.cvJsonRaw).title,'Engineer');
});
