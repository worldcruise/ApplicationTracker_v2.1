import { CandidateError, object, type CandidateDocument } from "./candidate-contract";
import { DEFAULT_PROMPT, type PromptTemplate } from "./prompt-templates";
import { composePromptTemplate, templateIssue } from "./prompt-composer";
import { resumePromptIssue, resumePromptProfile } from "./resume-prompt-profile";
import {formatCandidateTimeline} from '../../extension/studio/candidate-timeline.js';

export function candidatePromptValues(candidate:CandidateDocument){
  const profile=resumePromptProfile(candidate),values:Record<string,string>={candidate_name:profile.name,candidate_location:profile.location,candidate_seniority:profile.seniority,years_of_experience:profile.yearsOfExperience==null?'':String(profile.yearsOfExperience),candidate_profile:formatCandidateTimeline(profile)};
  profile.roles.forEach((role,index)=>{const prefix=`company_${index+1}`;values[prefix]=formatCandidateTimeline({roles:[role],education:[]});values[prefix+'_name']=role.company;values[prefix+'_location']=role.location;values[prefix+'_period']=role.dates;values[prefix+'_bullets']=role.minimumBullets==null?'':String(role.minimumBullets);});
  profile.education.forEach((entry,index)=>{const prefix=`education_${index+1}`;values[prefix]=formatCandidateTimeline({roles:[],education:[entry]});values[prefix+'_degree']=entry.degree;values[prefix+'_university']=entry.school;values[prefix+'_period']=entry.dates;});
  values.education=profile.education.map((_,index)=>values[`education_${index+1}`]).filter(Boolean).join('\n');
  values.education_degree=values.education_1_degree||'';values.education_university=values.education_1_university||'';values.education_period=values.education_1_period||'';
  values.bullet_counts=profile.roles.map((role,index)=>role.minimumBullets==null?'':`Company ${index+1} - ${role.minimumBullets}`).filter(Boolean).join('\n');
  return values;
}

export function buildPrompt(candidate: CandidateDocument, jobInputRaw: string, template: PromptTemplate = DEFAULT_PROMPT) {
  const issue = resumePromptIssue(candidate), syntax = templateIssue(template.text, false);
  if (issue) throw new CandidateError("INVALID_RESUME_PROFILE", issue.message, issue.path);
  if (syntax) throw new CandidateError("INVALID_PROMPT", syntax);
  const resume = resumePromptProfile(candidate);
  const assigned = object(candidate.applicationPreferences).assignedPromptTemplateId;
  const warning = typeof assigned === "string" && assigned && assigned !== template.id
    ? "The assigned prompt template is unavailable. Using the selected default prompt without changing your saved preference." : null;
  const candidateProfile = formatCandidateTimeline(resume);
  const values={...candidatePromptValues(candidate),job_description:jobInputRaw};
  return { templateId: template.id, warning, values, text: composePromptTemplate(template.text, candidateProfile, jobInputRaw,values) };
}
