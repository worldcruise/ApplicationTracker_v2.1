import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Window} from 'happy-dom';
import {emptyProfile,normalizeProfile,profileToStudio} from '../extension/studio/profile-model.js';
import {applyParsedResumeProfile} from '../extension/studio/resume-import-profile.js';
import {prepareResumeProfile} from '../extension/studio/single-profile-service.js';
import {mountAutofillProfile} from '../extension/ai-apply/src/profile-editor.mjs';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';

const file={base64:btoa('%PDF-1.7 replacement'),fileName:'replacement.pdf'};
const work=(company='Acme Corporation',startDate='2020-01')=>({company,jobTitle:'Electrical Engineer',location:'Jacksonville, FL',startDate,endDate:'2024-06',currentlyWorkHere:false,description:'Original achievements.'});
const school=(name='University of North Florida',startDate='2014-08')=>({school:name,degree:"Bachelor's",fieldOfStudy:'Electrical Engineering',startDate,endDate:'2018-05',currentlyAttending:false,gpa:'3.9'});
function existing(){const profile=emptyProfile();profile.nameData={firstName:'Alex',lastName:'Original',preferredName:true};profile.contactData.email='alex@example.test';profile.contactData.phoneNumber='5551234567';profile.addressData.postalCode='32224';profile.resumeData={resumeBase64:btoa('%PDF-1.7 original'),fileName:'original.pdf',fileSize:17,dateUploaded:'2026-01-01'};profile.jobData=[work()];profile.educationData=[school()];profile.skillsData=['SQL'];profile.websiteData.websites=['https://existing.example.test'];profile.employmentData.sponsorship=false;return profile;}

// Compare with the actual original bundle's review defaults and merge,
// rather than expectations from the removed custom field-protection policy.
const baseline=await readFile(new URL('../Baseline/SpeedyApply/chunks/application-profile-field-DNaeSVYA.js',import.meta.url),'utf8');
const originalFunctions=baseline.slice(baseline.indexOf('function vg('),baseline.indexOf('var wg='));
const originalSort=baseline.slice(baseline.indexOf('function Wh('),baseline.indexOf('function Gh('));
const recordSchema={safeParse:value=>({success:!!value&&typeof value==='object'&&!Array.isArray(value),data:value})};
const stringsSchema={safeParse:value=>({success:Array.isArray(value)&&value.every(item=>typeof item==='string'),data:value})};
const baselineUpdate=new Function('gg','_g',`const fg={},dg={},pg={},mg={},hg={};${originalFunctions}${originalSort}
  return (previous,parsed)=>{const enabled={};for(const section of xg(previous,parsed).sections){if(section.isArray)enabled[section.key]=true;else for(const field of section.fields)enabled[field.key]=true;}
  const result=Cg(previous,parsed,enabled);return {...result,jobData:Wh(result.jobData)};};`)(recordSchema,stringsSchema);

test('profile imports match SpeedyApply baseline for initial uploads and replacements',()=>{
  const cases=[
    [emptyProfile(),{nameData:{firstName:'Parsed',lastName:'Example'},jobData:[work()],educationData:[school()],skillsData:['SQL','React']}],
    [existing(),{nameData:{firstName:'Someone',lastName:'New',preferredName:false},contactData:{email:'new@example.test',phoneNumber:'0'},addressData:{postalCode:'0'},jobData:[{...work('New Employer','2025-01'),jobTitle:'Architect',location:'New York',currentlyWorkHere:true,endDate:'',description:'New achievements.'}],educationData:[{...school('New School','2020-01'),degree:"Master's",fieldOfStudy:'Science in Computer Engineering',endDate:'2022-01',currentlyAttending:true,gpa:'0'}],skillsData:['SQL','TypeScript']}],
    [existing(),{nameData:{firstName:'',lastName:null},jobData:[],educationData:[],skillsData:[],languageData:[]}],
    [existing(),{websiteData:{linkedin:'https://linkedin.example.test',websites:['https://existing.example.test','https://new.example.test']},skillsData:['SQL','React','React']}],
    [existing(),{languageData:[{language:'English',proficiency:'',fluent:false}],employmentData:{sponsorship:true},profileName:'Do not rename account profile'}],
    [existing(),{jobData:[work('Past','2010-01'),{...work('Current','2025-01'),currentlyWorkHere:true,endDate:''},{...work('Recent','2022-01'),endDate:'2025-06'}]}],
    [existing(),{}],
  ];
  for(const [previous,parsed]of cases){const before=structuredClone(previous),response=structuredClone(parsed);assert.deepEqual(applyParsedResumeProfile(previous,parsed),normalizeProfile(baselineUpdate(previous,parsed)));assert.deepEqual(previous,before);assert.deepEqual(parsed,response);}
  const full=existing();full.skillsData=Array.from({length:24},(_,index)=>'Skill '+index);assert.deepEqual(applyParsedResumeProfile(full,{skillsData:['New 1','New 2']}),normalizeProfile(baselineUpdate(full,{skillsData:['New 1','New 2']})));
});

test('profile upload uses returned fields without school/employer matching, degree rewriting, or fixed personal facts',()=>{
  const previous=existing(),parsed={nameData:{firstName:'Updated'},jobData:[work('Different Employer','2025-01')],educationData:[{...school('Different School','2020-01'),degree:"Master's",fieldOfStudy:'Science in Computer Engineering'}]};
  const prepared=prepareResumeProfile(previous,parsed,file);
  assert.equal(prepared.profile.nameData.firstName,'Updated');assert.deepEqual(prepared.profile.jobData,parsed.jobData);assert.deepEqual(prepared.profile.educationData,parsed.educationData);assert.deepEqual(prepared.warnings,[]);assert.equal(prepared.comparisons,undefined);assert.equal(prepared.profile.resumeData.fileName,'replacement.pdf');assert.equal(previous.resumeData.fileName,'original.pdf');
});

test('profile editor reviews SpeedyApply fields and allows discard or save with checkbox edits',async t=>{
  const win=new Window();t.after(()=>win.happyDOM.abort());const root=win.document.createElement('main');win.document.body.append(root);const profile=existing();let saved;
  const parsed={contactData:{phoneNumber:'0'},educationData:[{...school('New School'),degree:"Master's",fieldOfStudy:'Computer Engineering'}],jobData:[work('New Employer')]};
  const editor=mountAutofillProfile(root,{mode:'page',read:async()=>({candidate:{profile,revision:1}}),preview:async()=>({...prepareResumeProfile(profile,parsed,file),expectedProfile:profile,revision:1}),save:async input=>{saved=input.profile;return {candidate:{profile:saved,revision:2}};}});await editor.ready;
  await editor.upload(new win.File(['%PDF-1.7 replacement'],'replacement.pdf'));assert.equal(saved,undefined);assert.equal(root.querySelector('.af-comparisons'),null);
  root.querySelector('[data-section=personal]').click();assert.equal(root.querySelector('[name=phoneNumber]').value,'0');
  root.querySelector('.af-review-banner button').click();assert.equal(root.querySelector('[name=phoneNumber]').value,'5551234567');
  await editor.upload(new win.File(['%PDF-1.7 replacement'],'replacement.pdf'));root.querySelector('[data-section=education]').click();assert.equal(root.querySelector('[name=school]').value,'New School');assert.equal(root.querySelector('[name=degree]').value,"Master's");
  const attending=root.querySelector('[name=currentlyAttending]');assert.equal(attending.type,'checkbox');attending.click();root.querySelector('[data-section=experience]').click();root.querySelector('[name=currentlyWorkHere]').click();
  root.querySelector('form').dispatchEvent(new win.Event('submit',{cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));assert.equal(saved.educationData[0].currentlyAttending,true);assert.equal(saved.jobData[0].currentlyWorkHere,true);assert.equal(saved.jobData[0].company,'New Employer');assert.equal(saved.contactData.phoneNumber,'0');editor.dispose();
});
