export const PROMPT_TOKENS = { candidateProfile: "{{candidate_profile}}", jobDescription: "{{job_description}}" } as const;
export function templateIssue(template: string, strict = true) {
  if (!template.trim()) return "Enter a resume prompt template.";
  // Saved pre-placeholder templates keep their original append-style behavior.
  if (!strict && !Object.values(PROMPT_TOKENS).some(token => template.includes(token))) return null;
  for (const token of Object.values(PROMPT_TOKENS)) if (template.split(token).length !== 2) return `Include ${token} exactly once.`;
  const unknown = template.match(/{{[^{}]*}}/g)?.find(token => !Object.values(PROMPT_TOKENS).includes(token as typeof PROMPT_TOKENS[keyof typeof PROMPT_TOKENS]));
  return unknown ? `Unknown placeholder ${unknown}.` : null;
}
export function editableTemplate(template: string) {
  if (Object.values(PROMPT_TOKENS).some(token => template.includes(token))) return template;
  return `${template}\n\nSAVED PROFESSIONAL FACTS\n${PROMPT_TOKENS.candidateProfile}\n\nCURRENT JOB INPUT (verbatim, including its URL)\n${PROMPT_TOKENS.jobDescription}`;
}
// Callback replacement is deliberately single pass. Tokens inside candidate/JD
// data and replacement-string metacharacters are never interpreted again.
export function composePromptTemplate(template: string, profile: string, job: string) {
  return template.replace(/{{candidate_profile}}|{{job_description}}/g, token => token === PROMPT_TOKENS.candidateProfile ? profile : job);
}
