import { resumePromptIssue } from "./resume-prompt-profile";
import { upgradeCandidateWorkHistory } from "./candidate-work-history";
import { resumeDataIssue } from "./candidate-resume-contract";
export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
export type JsonObject = { [key: string]: JsonValue };
export type CandidateDocument = JsonObject & {
  schemaVersion: 1 | 2;
  kind: "application-tracker-candidate";
  candidate: JsonObject & { id: string; name: string };
};
export type StoredCandidate = {
  document: CandidateDocument;
  revision: number;
  originalFilename: string;
  importedAt: string;
  updatedAt: string;
  lastMutationId: string;
};
export const CANDIDATE_LIMIT = 2 * 1024 * 1024;

export class CandidateError extends Error {
  constructor(public code: string, message: string, public fieldPath?: string, public currentRevision?: number) {
    super(message);
  }
}

export function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
}
function fail(message: string, path = "$", code = "INVALID_CANDIDATE"): never {
  throw new CandidateError(code, message, path);
}

// JSON.parse first checks the grammar. This second bounded walk compares decoded
// object keys, including escaped aliases, before any document can be written.
export function strictJson(raw: string): JsonValue {
  let parsed: JsonValue;
  try { parsed = JSON.parse(raw); } catch { return fail("Invalid JSON syntax. Select a valid candidate JSON file.", "$", "INVALID_JSON"); }
  let index = 0;
  const whitespace = () => { while (/\s/.test(raw[index] ?? "") && index < raw.length) index++; };
  function string() {
    const start = index++;
    while (index < raw.length) {
      if (raw[index] === "\\") index += 2;
      else if (raw[index++] === '"') break;
    }
    return JSON.parse(raw.slice(start, index)) as string;
  }
  function walk(depth: number, path: string) {
    if (depth > 64) fail("Candidate JSON nesting exceeds 64 levels.", path);
    whitespace();
    if (raw[index] === "{") {
      index++; whitespace();
      const keys = new Set<string>();
      while (raw[index] !== "}") {
        const key = string();
        if (keys.has(key)) fail("Duplicate JSON key. Remove the repeated field.", path + "." + key, "DUPLICATE_KEY");
        keys.add(key); whitespace(); index++;
        walk(depth + 1, path + "." + key); whitespace();
        if (raw[index] !== ",") break;
        index++; whitespace();
      }
      index++;
    } else if (raw[index] === "[") {
      index++; whitespace(); let item = 0;
      while (raw[index] !== "]") {
        walk(depth + 1, `${path}[${item++}]`); whitespace();
        if (raw[index] !== ",") break;
        index++; whitespace();
      }
      index++;
    } else if (raw[index] === '"') string();
    else { while (index < raw.length && !/[\s,}\]]/.test(raw[index]!)) index++; }
  }
  walk(0, "$");
  return parsed;
}

export function parseCandidate(raw: string): CandidateDocument {
  if (new TextEncoder().encode(raw).length > CANDIDATE_LIMIT) fail("Candidate JSON must be at most 2 MiB.", "$", "TOO_LARGE");
  return validateCandidate(upgradeCandidateWorkHistory(validateCandidate(strictJson(raw))));
}

export function decodeCandidate(bytes: Uint8Array): string {
  if (bytes.byteLength > CANDIDATE_LIMIT) fail("Candidate JSON must be at most 2 MiB.", "$", "TOO_LARGE");
  let raw: string;
  try { raw = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return fail("The file is not valid UTF-8. Export it as UTF-8 JSON and try again.", "$", "INVALID_UTF8"); }
  parseCandidate(raw);
  return raw;
}

export function validateCandidate(value: unknown): CandidateDocument {
  function obj(entry: unknown, path: string): JsonObject {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) fail("Expected an object.", path);
    return entry as JsonObject;
  }
  function text(entry: unknown, path: string, required = false) {
    if (entry === undefined && !required) return;
    if (typeof entry !== "string" || (required && !entry.trim())) fail(required ? "A nonblank value is required." : "Expected text.", path);
  }
  function fields(entry: JsonObject, path: string, names: string[]) {
    for (const name of names) text(entry[name], `${path}.${name}`);
  }
  function strings(entry: unknown, path: string) {
    if (entry === undefined) return;
    if (!Array.isArray(entry)) fail("Expected an array of text values.", path);
    entry.forEach((item, index) => text(item, `${path}[${index}]`, true));
  }
  function date(entry: unknown, path: string, day = false) {
    if (entry === undefined || entry === "") return;
    text(entry, path);
    const pattern = day ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/;
    if (!pattern.test(entry as string)) fail(day ? "Use YYYY-MM-DD." : "Use YYYY-MM.", path);
    const [year, month, dayValue] = (entry as string).split("-").map(Number);
    const days = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
    if (!year || !month || month > 12 || (day && (!dayValue || dayValue > days))) fail("Invalid calendar date.", path);
  }
  function address(entry: unknown, path: string) {
    if (entry !== undefined) fields(obj(entry, path), path, ["street", "city", "state", "postalCode", "country"]);
  }
  function records(entry: unknown, path: string, check: (item: JsonObject, path: string) => void): JsonObject[] {
    if (entry === undefined) return [];
    if (!Array.isArray(entry)) fail("Expected an array of records.", path);
    const ids = new Set<string>();
    return entry.map((item, index) => {
      const itemPath = `${path}[${index}]`; const result = obj(item, itemPath);
      text(result.id, itemPath + ".id", true);
      if (ids.has(result.id as string)) fail("Record IDs must be unique within their section.", itemPath + ".id");
      ids.add(result.id as string); check(result, itemPath); return result;
    });
  }
  function safeJson(entry: unknown, path: string, depth = 0) {
    if (depth > 64) fail("Candidate JSON nesting exceeds 64 levels.", path);
    if (typeof entry === "number" && (!Number.isFinite(entry) || (Number.isInteger(entry) && !Number.isSafeInteger(entry)))) fail("Number cannot be preserved safely; use a JSON string for large identifiers.", path);
    if (entry !== null && typeof entry === "object") {
      if (Array.isArray(entry)) entry.forEach((item, index) => safeJson(item, `${path}[${index}]`, depth + 1));
      else for (const [key, item] of Object.entries(entry)) safeJson(item, path + "." + key, depth + 1);
    } else if (entry !== null && !["string", "number", "boolean"].includes(typeof entry)) fail("Expected a JSON value.", path);
  }
  const doc = obj(value, "$");
  if (doc.schemaVersion !== 1 && doc.schemaVersion !== 2) fail("Unsupported candidate schemaVersion. Use candidate schemaVersion 2; legacy version 1 can also be imported.", "$.schemaVersion", "UNSUPPORTED_SCHEMA");
  if (doc.kind !== "application-tracker-candidate") fail("Select a candidate master document, rather than a generated CV or registry.", "$.kind");
  const identity = obj(doc.candidate, "$.candidate");
  const resumeIssueFile = resumeDataIssue(doc.resumeData); if (resumeIssueFile) fail(resumeIssueFile, "$.resumeData");
  text(identity.id, "$.candidate.id", true); text(identity.name, "$.candidate.name", true);
  if (identity.metadata !== undefined) obj(identity.metadata, "$.candidate.metadata");
  if (doc.personalDetails !== undefined) {
    const details = obj(doc.personalDetails, "$.personalDetails");
    fields(details, "$.personalDetails", ["email", "phone"]);
    date(details.dateOfBirth, "$.personalDetails.dateOfBirth", true);
    address(details.address, "$.personalDetails.address");
    if (details.onlinePresence !== undefined) fields(obj(details.onlinePresence, "$.personalDetails.onlinePresence"), "$.personalDetails.onlinePresence", ["linkedin", "github", "website"]);
  }
  const companies = records(doc.companies, "$.companies", (item, path) => {
    fields(item, path, ["name", "phone", "employmentContext"]); address(item.address, path + ".address");
    if (doc.schemaVersion === 2) {
      fields(item, path, ["title", "location", "shortDetail"]);
      date(item.startDate, path + ".startDate"); if (item.endDate !== null) date(item.endDate, path + ".endDate");
      if (item.current !== undefined && typeof item.current !== "boolean") fail("Expected true or false.", path + ".current");
      if (item.current === true && item.endDate !== undefined && item.endDate !== null && item.endDate !== "") fail("A current role cannot have an end date.", path + ".endDate");
      strings(item.highlights, path + ".highlights"); strings(item.aliases, path + ".aliases");
      if (item.companyId !== undefined || item.company !== undefined) fail("Use name and the work fields directly in companies; company/companyId associations are retired.", path);
    }
  });
  if (doc.professionalProfile !== undefined) {
    const profile = obj(doc.professionalProfile, "$.professionalProfile");
    if (doc.schemaVersion === 2 && profile.experience !== undefined) fail("Work history belongs in companies, not professionalProfile.experience.", "$.professionalProfile.experience");
    fields(profile, "$.professionalProfile", ["summary"]); strings(profile.skills, "$.professionalProfile.skills");
    records(profile.experience, "$.professionalProfile.experience", (item, path) => {
      fields(item, path, ["company", "title", "companyId"]);
      if (item.companyId !== undefined && !companies.some(company => company.id === item.companyId)) fail("Company association must reference this candidate's company record.", path + ".companyId");
      date(item.startDate, path + ".startDate"); if (item.endDate !== null) date(item.endDate, path + ".endDate");
      if (item.current !== undefined && typeof item.current !== "boolean") fail("Expected true or false.", path + ".current");
      if (item.current === true && item.endDate !== undefined && item.endDate !== null && item.endDate !== "") fail("A current role cannot have an end date.", path + ".endDate");
      strings(item.highlights, path + ".highlights");
    });
    records(profile.education, "$.professionalProfile.education", (item, path) => {
      fields(item, path, ["school", "degree"]); date(item.startDate, path + ".startDate"); date(item.endDate, path + ".endDate");
    });
    records(profile.certifications, "$.professionalProfile.certifications", (item, path) => {
      text(item.name, path + ".name", true);
      fields(item, path, ["name", "issuer", "url"]); date(item.issuedOn, path + ".issuedOn", true); date(item.expiresOn, path + ".expiresOn", true);
    });
    records(profile.projects, "$.professionalProfile.projects", (item, path) => {
      text(item.name, path + ".name", true);
      fields(item, path, ["name", "description", "url"]); strings(item.skills, path + ".skills");
    });
  }
  records(doc.customPromptInstructions, "$.customPromptInstructions", (item, path) => fields(item, path, ["title", "text"]));
  records(doc.customAnswers, "$.customAnswers", (item, path) => fields(item, path, ["question", "answer"]));
  if (doc.applicationPreferences !== undefined) {
    const preferences = obj(doc.applicationPreferences, "$.applicationPreferences");
    if (preferences.assignedPromptTemplateId !== null) text(preferences.assignedPromptTemplateId, "$.applicationPreferences.assignedPromptTemplateId");
    text(preferences.preferredDocumentTemplateId, "$.applicationPreferences.preferredDocumentTemplateId");
    text(preferences.exportDirectory, "$.applicationPreferences.exportDirectory");
  }
  safeJson(doc, "$");
  const resumeIssue = resumePromptIssue(doc as CandidateDocument);
  if (resumeIssue) fail(resumeIssue.message, resumeIssue.path);
  if (new TextEncoder().encode(JSON.stringify(doc)).length > CANDIDATE_LIMIT) fail("Candidate JSON must be at most 2 MiB.", "$", "TOO_LARGE");
  return doc as CandidateDocument;
}

export function sameJson(left: JsonValue, right: JsonValue): boolean {
  if (left === right) return true;
  if (left === null || right === null || typeof left !== "object" || typeof right !== "object" || Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left); const otherKeys = Object.keys(right);
  return keys.length === otherKeys.length && keys.every(key => Object.hasOwn(right, key)
    && sameJson((left as JsonObject)[key]!, (right as JsonObject)[key]!));
}
