import {emptySalary,structuredSalary,validateSalary,migrateSalaryTemplate} from './salary-data.mjs';
export const DOCUMENT_CONTRACT_VERSION=5;

export function finalDocumentStructure({includeCoverLetter=true,requestId='CURRENT_JOB_ID'}={}){
  return {requestId,job:{company:'Example Company',title:'Software Engineer',applyUrl:'https://example.com/jobs/123/apply',description:'Build reliable services.',salary:emptySalary()},resume:{company:'Target employer',title:'Resume title',summary:'',skills:[{Category:['Skill']}],experience:[{title:'Job title',company:'Employer',sentences:['Achievement sentence']}],education:[{degree:'Degree and major'}]},coverLetter:includeCoverLetter?'I build reliable services and would bring that experience to this role.':''};
}

export function finalDocumentContract(settings={}){
  if(settings.selectedModules)return moduleDocumentContract(settings);
  const structure=settings.structure?JSON.parse(settings.structure):finalDocumentStructure();
  validateFinalDocumentShape(structure,{template:true,version:2});
  structure.requestId=settings.requestId||'CURRENT_JOB_ID';
  if(settings.includeJobAnalysis===false)structure.job=null;
  if(settings.includeResume===false)structure.resume=null;
  if(settings.includeCoverLetter===false)structure.coverLetter='';
  return [
    'FINAL JSON STRUCTURE',
    'Return exactly one JSON object with only requestId, job, resume, and coverLetter. Copy requestId exactly from the structure below. Replace example text with the final content. Do not add Markdown, commentary, schemaVersion, runId, candidate contact information, or formatting fields.',
    settings.includeJobAnalysis===false?'Job analysis is off. Return job as null; do not analyze or rewrite the job.':'job must contain exactly company, title, applyUrl, description, and salary. Use the analyzed employer, advertised title, full job description, and an observed application URL. If an application URL is unknown, use an empty string; never invent one. salary must contain exactly min, max, currency, period, and sourceText: {"min":0,"max":0,"currency":"USD","period":"year","sourceText":""}. min and max are nonnegative JSON numbers, not strings. Use the actual listed currency and pay period (hour, day, week, month, or year); do not annualize hourly pay. sourceText preserves the original salary wording from the supplied listing, while min and max contain its numeric amounts. For a single amount use the same number for min and max; use 0 for a missing bound. If pay is absent, use min 0, max 0, currency USD, period year, and empty sourceText. Estimate only if the selected JD instructions explicitly request it, keeping sourceText empty. Do not add value, source, evidence, basis, or any other salary fields. Never use the example employer, URL, or pay as actual job facts.',
    settings.includeResume===false?'Resume generation is off. Return resume as null; do not generate a resume.':'resume must contain exactly company, title, summary, skills, experience, and education. Company is the target employer. Company and title must be nonblank strings; summary is a string and may be empty.',
    'skills is an array of category objects, each with one nonblank category name mapped to a nonempty array of nonblank skill strings. experience is an array of objects with exactly title, company, and sentences; sentences contains plain text strings without bullet symbols. education is an array of objects with exactly degree. Outer arrays may be empty. Do not add fields inside experience or education.',
    settings.includeCoverLetter===false?'coverLetter must be an empty string because cover letter generation is off.':'coverLetter must be the complete cover letter as a nonblank plain text string. Separate paragraphs with escaped newline characters.',
    JSON.stringify(structure,null,2)
  ].join('\n\n');
}

export function validateFinalDocumentShape(value,{includeCoverLetter=true,includeResume=true,includeJobAnalysis=true,version=2,template=false,selectedModules,salaryVersion=version}={}){
  if(version>=4)return validateModuleDocument(value,selectedModules,version);
  const exact=(record,keys,label)=>{if(!record||typeof record!=='object'||Array.isArray(record)||Object.keys(record).length!==keys.length||keys.some(key=>!Object.hasOwn(record,key)))throw Error(`${label} must contain exactly ${keys.join(', ')}.`);};
  const text=(value,label,empty=false)=>{if(typeof value!=='string'||!template&&!empty&&!value.trim())throw Error(`${label} must be ${empty?'a string':'nonblank text'}.`);};
  const list=(value,label)=>{if(!Array.isArray(value))throw Error(`${label} must be an array.`);};
  exact(value,version===1?['resume','coverLetter']:['requestId','job','resume','coverLetter'],'Final JSON');
  if(version!==1){
    text(value.requestId,'requestId');
    if(version>=3&&!includeJobAnalysis){if(value.job!==null)throw Error('job must be null when Job analysis is off.');}
    else {
    exact(value.job,['company','title','applyUrl','description','salary'],'job');
    for(const key of ['company','title','description'])text(value.job[key],`job.${key}`);text(value.job.applyUrl,'job.applyUrl',true);
    if(salaryVersion>=5||structuredSalary(value.job.salary))validateSalary(value.job.salary);
    else {
      exact(value.job.salary,['value','source','evidence','basis'],'job.salary');for(const key of ['value','source','evidence','basis'])text(value.job.salary[key],`job.salary.${key}`,true);
      if(!['listed','estimated','unknown'].includes(value.job.salary.source))throw Error('job.salary.source must be listed, estimated, or unknown.');
    }
    }
  }
  if(version>=3&&!includeResume){if(value.resume!==null)throw Error('resume must be null when Resume is off.');}
  else {
  const resume=value.resume;exact(resume,['company','title','summary','skills','experience','education'],'resume');
  text(resume.company,'resume.company');text(resume.title,'resume.title');text(resume.summary,'resume.summary',true);
  list(resume.skills,'resume.skills');for(const group of resume.skills){if(!group||typeof group!=='object'||Array.isArray(group)||Object.keys(group).length!==1)throw Error('Each skills group must contain one category.');const [category]=Object.keys(group);text(category,'Skill category');list(group[category],'Skill values');if(!group[category].length)throw Error('Skill categories cannot be empty.');for(const skill of group[category])text(skill,'Skill');}
  list(resume.experience,'resume.experience');for(const entry of resume.experience){exact(entry,['title','company','sentences'],'Experience');text(entry.title,'Experience title');text(entry.company,'Experience company');list(entry.sentences,'Experience sentences');for(const sentence of entry.sentences){text(sentence,'Experience sentence');}}
  list(resume.education,'resume.education');for(const entry of resume.education){exact(entry,['degree'],'Education');text(entry.degree,'Education degree');}
  }
  text(value.coverLetter,'coverLetter',!includeCoverLetter);if(!template&&!includeCoverLetter&&value.coverLetter!=='')throw Error('coverLetter must be empty when disabled.');
}

export function finalDocumentTemplateIssue(raw){try{validateFinalDocumentShape(JSON.parse(raw),{template:true,version:2,salaryVersion:5});return null;}catch(error){return error instanceof SyntaxError?'Enter valid JSON for the final structure.':error.message;}}

export function selectedDocumentStructure(settings){
 const base=settings.structure?JSON.parse(migrateSalaryTemplate(settings.structure)):finalDocumentStructure();
 validateFinalDocumentShape(base,{template:true,version:2,salaryVersion:5});
 return Object.fromEntries(settings.selectedModules.map(key=>[key,base[key]]));
}
export function moduleDocumentContract(settings){
 const keys=settings.selectedModules;
 if(!keys?.length)throw Error('Select at least one section to generate.');
 const rules=finalDocumentContract({...settings,selectedModules:undefined,includeJobAnalysis:true,includeResume:true,includeCoverLetter:true}).split('\n\n');
 return ['OUTPUT CONTROLLER',
 'Return exactly one valid JSON object inside a single JSON code block, containing exactly these keys: '+keys.join(', ')+'. Omit all unselected sections. Do not include requestId, runId, commentary, extra top-level keys, or any text outside that code block. Do not use additional Markdown or multiple code blocks. Replace examples with complete content.',
 keys.includes('job')?rules[2]+' Clean the selected listing description by removing navigation, cookie notices, recommendations and duplicate text. Preserve the full responsibilities, requirements, benefits and listed pay. Use only the supplied listing evidence; never invent job facts.':'',keys.includes('resume')?[rules[3],rules[4]].join('\n\n'):'',keys.includes('coverLetter')?rules[5]:'',
 'Always use the original job description for tailoring and eligibility checks, even when JD output is not selected.',
 keys.includes('coverLetter')?(keys.includes('resume')?'Write the cover letter using the newly generated resume.':'Write the cover letter using the candidate context in the selected prompts or already in this conversation.'):'',
 'If eligibility rules reject this application, return only {"rejection":{"reason":"Specific reason"}}. Do not return partial document sections.',
 JSON.stringify(selectedDocumentStructure(settings),null,2)].filter(Boolean).join('\n\n');
}
export function validateModuleDocument(value,selectedModules,version=DOCUMENT_CONTRACT_VERSION){
 if(!Array.isArray(selectedModules)||!selectedModules.length)throw Error('This request has no saved generation selection.');
 if(Object.hasOwn(value,'rejection')){
  if(Object.keys(value).length!==1||!value.rejection||Object.keys(value.rejection).length!==1||typeof value.rejection.reason!=='string'||!value.rejection.reason.trim())throw Error('Invalid rejection response.');
  throw Object.assign(Error('Application rejected: '+value.rejection.reason.trim()),{code:'APPLICATION_REJECTED'});
 }
 const labels={job:'JD',resume:'Resume',coverLetter:'Cover letter'};
 for(const key of selectedModules)if(!Object.hasOwn(value,key))throw Error(labels[key]+' is missing.');
 if(Object.keys(value).some(key=>!selectedModules.includes(key)))throw Error('Unexpected output section. Expected only '+selectedModules.join(', ')+'.');
 const complete={...finalDocumentStructure(),...value};
 validateFinalDocumentShape(complete,{version:2,includeCoverLetter:true,salaryVersion:version});
}
