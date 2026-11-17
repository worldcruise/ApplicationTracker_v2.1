import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPrompt,candidatePromptValues} from '../extension/studio/resume-prompt-builder.js';
import {createGenerationService} from '../extension/ai-apply/src/generation-service.mjs';
import {event,memoryStorage} from './helpers/dock-records-fixture.mjs';

function candidate(){return {candidate:{id:'one',name:'Taylor Example'},personalDetails:{address:{city:'Austin',state:'Texas',country:'US'}},companies:[{id:'a',name:'Employer One',location:'Remote',startDate:'2021-01',current:true},{id:'b',name:'Employer Two',location:'Boston',startDate:'2018-06',endDate:'2020-12'}],professionalProfile:{seniority:'Senior',yearsOfExperience:8,education:[{id:'school',degree:'Bachelor of Science',school:'Example University',startDate:'2014-09',endDate:'2018-05'}]},applicationPreferences:{}};}
test('candidate placeholders default to saved facts and preserve explicit blank and zero overrides',()=>{
  const source=candidate(),before=structuredClone(source),values=candidatePromptValues(source);
  assert.equal(values.candidate_name,'Taylor Example');assert.equal(values.candidate_location,'Austin, Texas, US');assert.equal(values.years_of_experience,'8');
  assert.equal(values.company_1,'Employer One, Jan 2021 - Present - Remote.');assert.equal(values.company_2_name,'Employer Two');assert.equal(values.education_university,'Example University');
  assert.equal(values.education_period,'Sep 2014 - May 2018');assert.deepEqual(source,before);
  source.applicationPreferences.resumePrompt={name:'Prompt Name',location:'',yearsOfExperience:0,roles:{a:{company:'Prompt Employer',location:'NY',dates:'2022 - Present',minimumBullets:12},b:{minimumBullets:6}},education:{school:{degree:'BS',school:'Prompt University',dates:'2014 - 2018'}}};
  const result=candidatePromptValues(source);assert.equal(result.candidate_name,'Prompt Name');assert.equal(result.candidate_location,'');assert.equal(result.years_of_experience,'0');
  assert.equal(result.company_1_bullets,'12');assert.equal(result.bullet_counts,'Company 1 - 12\nCompany 2 - 6');assert.equal(result.education,'BS | Prompt University. 2014 - 2018.');
  source.companies.reverse();assert.equal(candidatePromptValues(source).company_2_name,'Prompt Employer','Overrides stay attached to the company ID');
});
test('missing history exposes two company slots and one education slot, without inventing facts',()=>{
  const source={candidate:{id:'one',name:'New Candidate'},applicationPreferences:{resumePrompt:{roles:{'prompt-company-2':{company:'Second employer',minimumBullets:5}},education:{'prompt-education-1':{degree:'BS',school:'University'}}}}};
  const values=candidatePromptValues(source);assert.equal(values.company_1,'');assert.equal(values.company_2_name,'Second employer');assert.equal(values.education_university,'University');
  assert.equal(buildPrompt(source,'',{id:'test',text:'{{candidate_name}} / {{company_3}} / {{years_of_experience}}'}).text,'New Candidate /  / ');
  source.companies=[{id:'new-one',name:'Imported First'},{id:'new-two',name:'Imported Second'}];source.professionalProfile={education:[{id:'new-school',degree:'Imported degree',school:'Imported school'}]};
  assert.equal(candidatePromptValues(source).company_2_name,'Second employer');assert.equal(candidatePromptValues(source).education_university,'University');
});
test('placeholder replacement is single pass and invalid defaults block prompt generation',()=>{
  const source=candidate();source.applicationPreferences.resumePrompt={name:'Literal {{company_1}} $&',roles:{a:{minimumBullets:0}}};
  assert.throws(()=>buildPrompt(source,'',{id:'test',text:'{{candidate_name}}'}),/Minimum Bullets/);
  source.applicationPreferences.resumePrompt.roles.a.minimumBullets=4;
  assert.equal(buildPrompt(source,'JD',{id:'test',text:'{{candidate_name}} / {{candidate_name}} / {{company_1_bullets}}'}).text,'Literal {{company_1}} $& / Literal {{company_1}} $& / 4');
  assert.throws(()=>buildPrompt(source,'',{id:'test',text:'{{unknown_default}}'}),/Unknown placeholder/);
});
test('Copy resolves candidate defaults across selected prompts using one saved profile snapshot',async t=>{
  const source=candidate(),events=event(),copied=[];let reads=0;
  const browser={runtime:{sendMessage:async()=>({})},storage:{local:memoryStorage({'ai-writing-prompts:v1':{jdAnalysis:'Analyze for {{candidate_location}}',coverLetter:'Write as {{candidate_name}} at {{candidate_seniority}} level.'}})},tabs:{onUpdated:events,onRemoved:events}};
  const job={id:'job',input:{profile:{name:'Taylor Example'},job:{company:'Target',description:'Original JD'}}};
  const service=createGenerationService({browser,jobs:{getJob:async()=>job},readResumePrompt:async()=>{reads++;return buildPrompt(source,'Original JD',{id:'test',text:'Resume for {{candidate_name}} using {{company_1_name}}.'});},clipboard:async(op,text)=>copied.push(text)});t.after(()=>service.dispose());
  await service.copyPrompt('job');assert.equal(reads,1);assert.match(copied[0],/Analyze for Austin, Texas, US/);assert.match(copied[0],/Resume for Taylor Example using Employer One/);assert.match(copied[0],/Write as Taylor Example at Senior level/);assert.doesNotMatch(copied[0],/{{candidate_/);
});
