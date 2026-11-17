import {PROMPT_TOKENS,knownPromptToken,substitutePromptPlaceholders} from '../../extension/studio/prompt-placeholders.js';
export {PROMPT_TOKENS};
export function templateIssue(template: string, strict = true) {
  if (!template.trim()) return "Enter a resume prompt template.";
  // Placeholders are optional; never add candidate or job data implicitly.
  for (const token of [PROMPT_TOKENS.candidateProfile,PROMPT_TOKENS.jobDescription]) if (template.split(token).length > 2) return `Use ${token} at most once.`;
  const unknown = template.match(/{{[^{}]*}}/g)?.find(token => !knownPromptToken(token));
  return unknown ? `Unknown placeholder ${unknown}.` : null;
}
export function editableTemplate(template: string) {
  return template;
}
// Callback replacement is deliberately single pass. Tokens inside candidate/JD
// data and replacement-string metacharacters are never interpreted again.
export function composePromptTemplate(template: string, profile: string, job: string, values:Record<string,string>={}) {
  return substitutePromptPlaceholders(template,{...values,candidate_profile:profile,job_description:job},{emptyMissing:true});
}
