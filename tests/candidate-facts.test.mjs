import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCandidateTimeline} from '../extension/studio/candidate-timeline.js';
import {buildPrompt} from '../extension/studio/resume-prompt-builder.js';
import {generationPrompt} from '../extension/ai-apply/src/generation-data.mjs';


test('candidate_profile contains only employer, dates, location and education lines',()=>{
  const candidate={candidate:{id:'one',name:'Liam Clift'},companies:[
    {id:'first',name:'Honeywell',title:'Engineer',startDate:'2019-01',current:true,location:'Charlotte, North Carolina',shortDetail:'Built services.'},
    {id:'second',name:'National Instruments',title:'Engineer',startDate:'2018-06',endDate:'2018-12',location:'Austin, Texas'}],
    professionalProfile:{skills:['Estimating','Excel'],education:[{id:'school',degree:"Bachelor's in Electrical Engineering",school:'Colorado School of Mines',startDate:'2015-08',endDate:'2018-05'}]},
    applicationPreferences:{resumePrompt:{seniority:'Senior',yearsOfExperience:8,roles:{first:{minimumBullets:16,shortDetail:'Led teams.'},second:{minimumBullets:8}}}},customPromptInstructions:[{text:'Use concise factual bullets.'}]};
  const before=structuredClone(candidate),template={id:'custom',text:'{{candidate_profile}}\n{{job_description}}'};
  const expected="Honeywell, Jan 2019 - Present - Charlotte, North Carolina.\nNational Instruments, Jun 2018 - Dec 2018 - Austin, Texas.\nBachelor's in Electrical Engineering | Colorado School of Mines. Aug 2015 - May 2018.";
  assert.equal(buildPrompt(candidate,'Actual job description.',template).text,expected+'\nActual job description.');
  candidate.applicationPreferences.resumePrompt.roles.first.dates='2019 - current';
  assert.ok(buildPrompt(candidate,'',template).text.startsWith('Honeywell, 2019 - current - Charlotte, North Carolina.'));
  assert.equal(before.applicationPreferences.resumePrompt.roles.first.minimumBullets,16);
  candidate.applicationPreferences.resumePrompt.roles.first.dates=undefined;
  delete candidate.applicationPreferences.resumePrompt.roles.first.dates;
  assert.deepEqual(candidate,before);
});

test('career timeline omits missing fields and treats placeholder-like source text literally',()=>{
  assert.equal(formatCandidateTimeline({roles:[],education:[]}), '');
  assert.equal(formatCandidateTimeline({roles:[{company:'Employer',dates:'',location:''}],education:[{description:'Degree | School',dates:''}]}),'Employer.\nDegree | School.');
  const candidate={candidate:{id:'one',name:'Person'},companies:[{id:'role',name:'Employer {{job_description}}',location:'Remote'}],professionalProfile:{},applicationPreferences:{}};
  assert.equal(buildPrompt(candidate,'Actual JD',{id:'test',text:'{{candidate_profile}}\n{{job_description}}'}).text,'Employer {{job_description}}, Remote.\nActual JD');
});

test('document generation keeps saved prompts and appends only extracted job fields',()=>{
  const job={id:'job',input:{prompt:'My exact resume prompt.',profile:{name:'PRIVATE CANDIDATE'},job:{company:'PRIVATE COMPANY',description:'PRIVATE JD'}}};
  const writing={jdAnalysis:'Analyze the JD.',coverLetter:'My exact letter prompt.'};
  const prompt=generationPrompt(job,'run',{includeCoverLetter:true},writing);
  assert.match(prompt,/Analyze the JD\.\n\nTask 2 \(Resume\)\nMy exact resume prompt\.\n\nTask 3 \(Cover letter\)\nMy exact letter prompt\.\n\n==========\nfinal output\nOUTPUT CONTROLLER/);
  assert.doesNotMatch(prompt,/REQUEST INPUT|candidateProfile|PRIVATE CANDIDATE/);
  assert.ok(prompt.endsWith('Company: PRIVATE COMPANY\nTitle: \nURL: \nDescription:\nPRIVATE JD'));
  assert.doesNotMatch(generationPrompt(job,'run',{includeCoverLetter:false},writing),/My exact letter prompt/);
});

