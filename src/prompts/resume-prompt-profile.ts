import type { CandidateDocument, JsonObject } from "./candidate-contract";
import { formatResumePeriod } from "./resume-dates";
const object = (value: unknown): JsonObject => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const records = (value: unknown) => Array.isArray(value) ? value.map(object) : [];
const own = (entry: JsonObject, key: string, fallback: unknown) => Object.hasOwn(entry, key) ? entry[key] : fallback;
const employer = (value: string) => value.normalize("NFKC").toLocaleLowerCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
export const RESUME_PROMPT_PATH = ["applicationPreferences", "resumePrompt"];
export const resumePromptPath = (...parts: string[]) => "$.applicationPreferences.resumePrompt" + parts.map(part => `[${JSON.stringify(part)}]`).join("");
export const SHORT_DETAIL_PLACEHOLDER = "Brief role context, team scope, or career progression.";
export function resumePromptIssue(document: CandidateDocument): { message: string; path: string } | null {
  const value = object(document.applicationPreferences).resumePrompt;
  if (value === undefined) return null;
  const issue = (message: string, parts: string[]) => ({ message, path: resumePromptPath(...parts) });
  if (!value || typeof value !== "object" || Array.isArray(value)) return issue("Resume prompt preferences must be an object.", []);
  for (const key of ["name", "location", "seniority", "shortBio"]) if (value[key] !== undefined && typeof value[key] !== "string") return issue("Enter text for " + key + ".", [key]);
  if (value.yearsOfExperience !== undefined && value.yearsOfExperience !== null && (typeof value.yearsOfExperience !== "number" || !Number.isFinite(value.yearsOfExperience) || value.yearsOfExperience < 0)) return issue("Enter nonnegative years of experience, or leave the field blank.", ["yearsOfExperience"]);
  for (const kind of ["roles", "education"]) {
    if (value[kind] === undefined) continue;
    if (!value[kind] || typeof value[kind] !== "object" || Array.isArray(value[kind])) return issue("Resume prompt overrides must be keyed by stable record ID.", [kind]);
    for (const [id, raw] of Object.entries(value[kind])) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return issue("Expected a resume prompt override object.", [kind, id]);
      for (const key of kind === "roles" ? ["company", "location", "title", "dates", "shortDetail", "responsibilities"] : ["degree", "school", "description", "dates"]) if (raw[key] !== undefined && typeof raw[key] !== "string") return issue("Enter text for " + key + ".", [kind, id, key]);
      const minimum = raw.minimumBullets;
      if (kind === "roles" && minimum !== undefined && minimum !== null && (typeof minimum !== "number" || !Number.isSafeInteger(minimum) || minimum < 1)) return issue("Minimum Bullets must be a whole number of at least 1, or blank for no minimum.", [kind, id, "minimumBullets"]);
    }
  }
  return null;
}
export function resumePromptProfile(document: CandidateDocument) {
  const profile = object(document.professionalProfile), settings = object(object(document.applicationPreferences).resumePrompt);
  const roleOverrides = object(settings.roles), educationOverrides = object(settings.education);
  const address=object(object(document.personalDetails).address);
  const roles=records(document.companies),education=records(profile.education);
  while(roles.length<2)roles.push({id:`prompt-company-${roles.length+1}`});
  if(!education.length)education.push({id:'prompt-education-1'});
  const legacyYears = profile.yearsOfExperience ?? profile.years;
  const knownYears = (typeof legacyYears === "number" || typeof legacyYears === "string" && /^\d+(?:\.\d+)?$/.test(legacyYears)) && Number.isFinite(Number(legacyYears)) && Number(legacyYears) >= 0 ? Number(legacyYears) : null;
  return {
    name: text(own(settings,"name",document.candidate.name)),
    location: text(own(settings,"location",[address.city,address.state,address.country].map(text).filter(Boolean).join(', '))),
    seniority: text(own(settings, "seniority", profile.seniority)),
    yearsOfExperience: own(settings, "yearsOfExperience", knownYears),
    shortBio: text(own(settings, "shortBio", profile.shortBio ?? profile.bio ?? profile.summary)),
    roles: roles.map((entry,index) => {
      const id = text(entry.id), override = {...object(roleOverrides[`prompt-company-${index+1}`]),...object(own(roleOverrides, id, {}))};
      const company = text(entry.name);
      const highlights = Array.isArray(entry.highlights) ? entry.highlights.filter(value => typeof value === "string") as string[] : [];
      const defaultMinimum = employer(company) === "honeywell" ? 16 : employer(company) === "l3harris" ? 8 : null;
      return { id, company: text(own(override, "company", company)), title: text(own(override, "title", entry.title)),
        dates: text(own(override, "dates", formatResumePeriod({ startDate: text(entry.startDate), endDate: text(entry.endDate), current: entry.current === true }))),
        location: text(own(override,"location",text(entry.location) || [text(object(entry.address).city), text(object(entry.address).state)].filter(Boolean).join(", "))), employmentContext: text(entry.employmentContext), minimumBullets: own(override, "minimumBullets", defaultMinimum),
        responsibilities: text(own(override, "responsibilities", [text(entry.shortDetail), ...highlights].filter(Boolean).join("\n"))),
        shortDetail: text(own(override, "shortDetail", "")), highlights };
    }),
    education: education.map((entry,index) => {
      const id = text(entry.id), override = {...object(educationOverrides[`prompt-education-${index+1}`]),...object(own(educationOverrides, id, {}))};
      const legacy=text(override.description).split(' | '),degree=text(own(override,'degree',legacy[0]||entry.degree)),school=text(own(override,'school',legacy.slice(1).join(' | ')||entry.school));
      return { id, degree, school, description: Object.hasOwn(override,'degree')||Object.hasOwn(override,'school')?[degree,school].filter(Boolean).join(' | '):text(own(override,"description",[degree,school].filter(Boolean).join(' | '))), dates: text(own(override, "dates", formatResumePeriod({ startDate: text(entry.startDate), endDate: text(entry.endDate) }))) };
    }),
  };
}
