import test from 'node:test';
import assert from 'node:assert/strict';
import {parseManualResume} from '../extension/ai-apply/src/manual-documents.mjs';
import {validateGeneration} from '../extension/ai-apply/src/generation-data.mjs';
import {DOCUMENT_CONTRACT_VERSION} from '../extension/ai-apply/src/document-contract.mjs';

const profile={name:'Candidate',role:'Engineer',summary:'Original profile summary.',skills:['JavaScript'],experience:[{title:'Engineer',company:'Original employer',startDate:'2020',endDate:'2024',location:'Original city',sentences:['Original responsibility.']}],education:[{degree:'Original degree',institution:'Original university',startDate:'2015',endDate:'2019'}],contact:{email:'original@example.test'}};
const request={id:'job',input:{profile,job:{company:'Original target',role:'Engineer',url:'https://original.example/job',description:'Original listing text.'}}};
const resume={company:'Updated target',title:'Technical Writer',summary:'Updated summary.',skills:[{Documentation:['Technical Documentation','SharePoint','Jira']}],experience:[{title:'Senior Technical Writer',company:'Updated employer',sentences:['Edited responsibility.']},{title:'Documentation Engineer',company:'Additional employer',sentences:['Additional experience.']}],education:[{degree:'Updated degree and major'},{degree:'Additional education'}]};

test('manual resume imports accept all edited content without comparing it to the profile or job',()=>{
  const before=structuredClone(request),value={...resume,contact:{email:'updated@example.test'}};
  const parsed=parseManualResume(JSON.stringify(value),request);
  assert.equal(parsed.company,'Updated target');assert.deepEqual(parsed.skills,resume.skills);
  assert.equal(parsed.experience.length,2);assert.equal(parsed.experience[0].company,'Updated employer');assert.equal(parsed.education.length,2);
  assert.equal(parsed.contact.email,'updated@example.test');assert.deepEqual(request,before);
  assert.doesNotThrow(()=>parseManualResume(JSON.stringify({...resume,experience:[],education:[]}),request));
});

test('automatic and full manual retrieval accept edited resume, application URL and salary text',()=>{
  const document={job:{company:'Updated target',title:'Technical Writer',applyUrl:'https://updated.example/application',description:'Updated listing text.',salary:{min:72000,max:108000,currency:'USD',period:'year',sourceText:'Updated compensation wording.'}},resume,coverLetter:'Edited cover letter.'};
  const result=validateGeneration(JSON.stringify(document),request,'run','combined-json',{selectedModules:['job','resume','coverLetter']},{contractVersion:DOCUMENT_CONTRACT_VERSION});
  assert.deepEqual(result.document,document);assert.equal(result.job.url,document.job.applyUrl);assert.equal(result.job.salaryEvidence,'Updated compensation wording.');
  assert.deepEqual(result.resume.skills,resume.skills);assert.equal(result.resume.experience[0].title,'Senior Technical Writer');
});

test('edited dates, locations, institutions and contact values are accepted without profile equality checks',()=>{
  const value={...resume,experience:[{...resume.experience[0],startDate:'2005',endDate:'2007',location:'Updated city'}],education:[{degree:'Updated degree',institution:'Updated university',startDate:'1999',endDate:'2003'}],contact:{phone:'+10000000000'}};
  const parsed=parseManualResume(JSON.stringify(value),request);
  assert.equal(parsed.experience[0].startDate,'2005');assert.equal(parsed.experience[0].location,'Updated city');assert.equal(parsed.education[0].institution,'Updated university');assert.equal(parsed.contact.phone,'+10000000000');
});
