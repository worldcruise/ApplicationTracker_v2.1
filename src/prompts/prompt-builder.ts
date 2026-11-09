import { CandidateError, object, type CandidateDocument, type JsonObject } from "./candidate-contract";
import { CV_CONTRACT } from "./cv-contract";
import { DEFAULT_PROMPT, type PromptTemplate } from "./prompt-templates";
import { composePromptTemplate, editableTemplate, templateIssue } from "./prompt-composer";
import { resumePromptIssue, resumePromptProfile } from "./resume-prompt-profile";

const select = (value: unknown, keys: string[]) => Object.fromEntries(Object.entries(object(value)).filter(([key]) => keys.includes(key)));
const records = (value: unknown, keys: string[]) => Array.isArray(value) ? value.map(item => select(item, keys)) : [];
export function buildPrompt(candidate: CandidateDocument, jobInputRaw: string, template: PromptTemplate = DEFAULT_PROMPT) {
  const profile = object(candidate.professionalProfile);
  const issue = resumePromptIssue(candidate), syntax = templateIssue(template.text, false);
  if (issue) throw new CandidateError("INVALID_RESUME_PROFILE", issue.message, issue.path);
  if (syntax) throw new CandidateError("INVALID_PROMPT", syntax);
  const resume = resumePromptProfile(candidate);
  const facts = {
    name: candidate.candidate.name, seniority: resume.seniority, yearsOfExperience: resume.yearsOfExperience, shortBio: resume.shortBio, skills: profile.skills ?? [],
    companies: resume.roles.map(role => ({ name: role.company, ...select(role, ["title", "dates", "location", "employmentContext", "shortDetail", "highlights"]), ...(role.minimumBullets === null ? {} : { minimumBullets: role.minimumBullets }) })),
    education: resume.education.map(entry => select(entry, ["description", "dates"])),
    certifications: records(profile.certifications, ["name", "issuer", "issuedOn", "expiresOn", "url"]),
    projects: records(profile.projects, ["name", "description", "url", "skills"]),
  };
  const instructions = Array.isArray(candidate.customPromptInstructions) ? candidate.customPromptInstructions
    .map(item => object(item) as JsonObject).filter(item => typeof item.text === "string" && item.text.trim()).map(item => ({ title: item.title ?? "", text: item.text })) : [];
  const assigned = object(candidate.applicationPreferences).assignedPromptTemplateId;
  const warning = typeof assigned === "string" && assigned && assigned !== template.id
    ? "The assigned prompt template is unavailable. Using the selected default prompt without changing your saved preference." : null;
  const candidateProfile = `${JSON.stringify(facts, null, 2)}

CANDIDATE INSTRUCTIONS
${JSON.stringify(instructions, null, 2)}

SIX-FIELD CV OUTPUT CONTRACT
${CV_CONTRACT}`;
  return { templateId: template.id, warning, text: composePromptTemplate(editableTemplate(template.text), candidateProfile, jobInputRaw) };
}
