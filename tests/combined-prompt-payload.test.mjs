import test from 'node:test';
import assert from 'node:assert/strict';
import {generationPrompt,generationInstructions} from '../extension/ai-apply/src/generation-data.mjs';
import {substitutePromptPlaceholders} from '../extension/studio/prompt-placeholders.js';

test('AI prompt matches Copy combined prompt with only the four extracted fields substituted',()=>{
  const job={id:'request',input:{prompt:'My saved resume instructions.',promptValues:{candidate_name:'Configured Name'},profile:{name:'PRIVATE PROFILE NAME',contact:{email:'PRIVATE EMAIL'},skills:['PRIVATE SKILL']},job:{company:'COG Research',role:'Technical Writer',url:'https://job-boards.greenhouse.io/cogresearchfoundation/jobs/4383973009',description:'Full original description.\nSalary $77,625 to $112,620 per year. Literal {{candidate_name}}.',tabId:1147173641,provenance:{company:{kind:'user'}},salary:'PRIVATE INTERNAL SALARY'}}};
  const previewJob={input:{...job.input,job:{company:'{{job_company}}',role:'{{job_title}}',url:'{{job_url}}',description:'{{job_description}}'}}};
  const settings={selectedModules:['job','resume','coverLetter']};
  const writing={instruction:'My instruction',jdAnalysis:'My job analysis instructions.',coverLetter:'My cover letter instructions.'};
  const preview=generationInstructions(previewJob,settings,writing);
  const expected=substitutePromptPlaceholders(preview,{job_company:job.input.job.company,job_title:job.input.job.role,job_url:job.input.job.url,job_description:job.input.job.description});
  const actual=generationPrompt(job,'run',settings,writing);
  assert.equal(actual,expected);
  assert.ok(actual.startsWith('My instruction\n\nTask 1 (JD)'));
  assert.ok(actual.endsWith('Company: COG Research\nTitle: Technical Writer\nURL: '+job.input.job.url+'\nDescription:\n'+job.input.job.description));
  assert.doesNotMatch(actual,/REQUEST INPUT|candidateProfile|PRIVATE PROFILE NAME|PRIVATE EMAIL|PRIVATE SKILL|PRIVATE INTERNAL SALARY|1147173641|provenance/);
  assert.equal(actual.split(job.input.job.description).length,2,'Original description is included once and remains literal');
});
