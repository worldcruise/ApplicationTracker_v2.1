import test from 'node:test';
import assert from 'node:assert/strict';
import {aiProfile} from '../extension/studio/ai-apply-model.js';
import {normalizeProfile} from '../extension/ai-apply/src/resume-data.mjs';
import {normalizeExperienceSentences} from '../extension/ai-apply/src/experience-text.mjs';
import {parseManualResume} from '../extension/ai-apply/src/manual-documents.mjs';
import {generationPrompt} from '../extension/ai-apply/src/generation-data.mjs';
import {cleanupInput} from '../extension/ai-apply/src/job-cleanup.mjs';

const profile=sentences=>({name:'Test Candidate',role:'Engineer',summary:'Builds reliable software.',skills:['JavaScript'],
  experience:[{title:'Engineer',company:'Previous Employer',startDate:'2024-01',endDate:'Present',sentences}],education:[]});
const job=data=>({id:'job-1',input:{candidateId:'candidate-1',profile:data,tailor:true,prompt:'Use only supported facts.',
  job:{company:'Employer',role:'Engineer',url:'https://employer.test/job',description:'Build reliable software.'}}});

test('blank experience bullets are ignored without losing employment records or mutating the source',()=>{
  const source=profile(['',' \n\t ',' Built reliable software. ','  ']),original=structuredClone(source);
  const normalized=normalizeProfile(source);
  assert.deepEqual(normalized.experience[0].sentences,['Built reliable software.']);
  assert.equal(normalized.experience[0].startDate,'2024-01');assert.deepEqual(source,original);
  assert.deepEqual(normalizeProfile(profile(['','  '])).experience[0].sentences,[]);
});

test('long imported profile descriptions are split without discarding their content',()=>{
  const description='Built reliable software and tested production services. '.repeat(300).trim();
  const source=profile([' ',description]),normalized=normalizeProfile(source),sentences=normalized.experience[0].sentences;
  assert.ok(sentences.length>1);assert.ok(sentences.every(value=>value.length>0&&value.length<=3000));
  assert.equal(sentences.join(' '),description);
  assert.equal(source.experience[0].sentences[1],description);
  const unicode='\u{1F680}'.repeat(1800),parts=normalizeExperienceSentences([unicode],{splitLong:true});
  assert.equal(parts.join(''),unicode);assert.ok(parts.every(value=>value.isWellFormed()&&value.length<=3000));
});

test('the tracker profile adapter cleans whitespace and long multiline descriptions before capture and generation',()=>{
  const description='Built reliable systems. '.repeat(700).trim(),candidate={id:'candidate-1',document:{candidate:{name:'Test Candidate'},
    companies:[{name:'Previous Employer',title:'Engineer',highlights:[' \n ',' Supported production. '],shortDetail:'\n'+description+'\n\n',startDate:'2024-01',current:true}],professionalProfile:{skills:['JavaScript']}}};
  const original=structuredClone(candidate),adapted=aiProfile(candidate),sentences=adapted.data.experience[0].sentences;
  assert.equal(sentences[0],'Supported production.');assert.equal(sentences.slice(1).join(' '),description);
  assert.ok(sentences.every(value=>value.trim()&&value.length<=3000));assert.doesNotThrow(()=>normalizeProfile(adapted.data));assert.deepEqual(candidate,original);
  const request=job(adapted.data);assert.ok(!generationPrompt(request,'run-1').includes('Supported production.'),'Profile facts stay local unless included by the saved prompt');
  assert.doesNotThrow(()=>cleanupInput(request.input));
  candidate.document.companies[0].highlights=[];
  assert.doesNotThrow(()=>normalizeProfile(aiProfile(candidate).data),'A long description must not overflow the fallback summary');
});

test('existing queue snapshots with blank or long profile text work without being rewritten',()=>{
  const request=job(profile(['  ','Supported production. '.repeat(220)])),original=structuredClone(request);
  assert.doesNotThrow(()=>generationPrompt(request,'run-1'));
  const cleaned=cleanupInput(request.input);assert.ok(cleaned.profile.experience[0].sentences.every(value=>value.trim()&&value.length<=3000));
  assert.deepEqual(request,original);
});

test('resume imports skip empty bullets and accept tailored content while retaining readable JSON types',()=>{
  const request=job(profile(['','Supported production.'])),resume={company:'Employer',title:'Engineer',summary:'Builds reliable software.',skills:[{Technical:['JavaScript']}],
    experience:[{...request.input.profile.experience[0],sentences:['  ','Improved service reliability.','']}],education:[]};
  const parsed=parseManualResume(JSON.stringify(resume),request);assert.deepEqual(parsed.experience[0].sentences,['Improved service reliability.']);
  const tailored=structuredClone(resume);tailored.experience[0].title='Senior Technical Writer';
  assert.equal(parseManualResume(JSON.stringify(tailored),request).experience[0].title,'Senior Technical Writer');
  assert.equal(request.input.profile.experience[0].title,'Engineer','Tailoring does not rewrite the candidate profile');
  request.input.profile.education=[{degree:'Bachelor of Science',institution:'Example University',startDate:'2015',endDate:'2019'}];
  resume.education=[{degree:'Bachelor of Science in Electrical Engineering, Example University'}];
  assert.equal(parseManualResume(JSON.stringify(resume),request).education[0].degree,resume.education[0].degree);
  assert.equal(request.input.profile.education[0].degree,'Bachelor of Science');
  const changed=structuredClone(resume);changed.experience[0].company='Updated employer';assert.equal(parseManualResume(JSON.stringify(changed),request).experience[0].company,'Updated employer');
  changed.experience[0]={...resume.experience[0],sentences:[42]};assert.throws(()=>parseManualResume(JSON.stringify(changed),request),/must be text/);
  changed.experience[0].sentences=['x'.repeat(3001)];assert.throws(()=>parseManualResume(JSON.stringify(changed),request),/3000/);
  assert.throws(()=>normalizeProfile(profile([null])),/must be text/);
});
