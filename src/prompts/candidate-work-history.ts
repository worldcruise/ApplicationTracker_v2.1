import type { CandidateDocument, JsonObject, JsonValue } from "./candidate-contract";
import { normalizedCompanyName } from "./company-name";
const object = (value: unknown): JsonObject => value !== null && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const records = (value: unknown) => Array.isArray(value) ? value.map(object) : [];

// The only legacy join. Active forms, prompts and rendering use companies[]
// directly after this boundary. Never mutate the imported/saved source.
export function upgradeCandidateWorkHistory(source: CandidateDocument): CandidateDocument {
  const document = structuredClone(source);
  if (document.schemaVersion === 2) return document;
  const companies = records(document.companies), profile = object(document.professionalProfile), work = records(profile.experience);
  const used = new Set<JsonObject>();
  const history = work.map(entry => {
    const names = companies.filter(company => text(entry.company).trim() && normalizedCompanyName(text(company.name)) === normalizedCompanyName(text(entry.company)));
    const company = typeof entry.companyId === "string" ? companies.find(company => company.id === entry.companyId) : names.length === 1 ? names[0] : undefined;
    if (company) used.add(company);
    const result: JsonObject = { ...company, ...entry }, companyFields: JsonObject = Object.create(null), workFields: JsonObject = Object.create(null);
    // Preserve collisions, including unknown fields, rather than silently
    // choosing a value and losing the other original record's data.
    for (const [key, value] of Object.entries(company ?? {})) if (Object.hasOwn(entry, key) && key !== "id" && JSON.stringify(entry[key]) !== JSON.stringify(value)) companyFields[key] = value;
    for (const key of ["company", "companyId"]) if (company && Object.hasOwn(company, key)) companyFields[key] = company[key]!;
    if (Object.hasOwn(entry, "name")) workFields.name = entry.name!;
    result.name = text(entry.company) || text(company?.name);
    delete result.company; delete result.companyId;
    if (company) {
      if (Object.hasOwn(entry, "legacyCompanyId")) workFields.legacyCompanyId = entry.legacyCompanyId!;
      else if (Object.hasOwn(company, "legacyCompanyId")) companyFields.legacyCompanyId = company.legacyCompanyId!;
      result.legacyCompanyId = company.id!;
      const aliases = [...new Set([...(Array.isArray(company.aliases) ? company.aliases.filter(value => typeof value === "string") as string[] : []), text(company.name)].filter(name => name.trim() && name !== result.name))];
      if (aliases.length) {
        if (Object.hasOwn(entry, "aliases")) workFields.aliases = entry.aliases!;
        if (Object.hasOwn(company, "aliases") && JSON.stringify(company.aliases) !== JSON.stringify(aliases)) companyFields.aliases = company.aliases!;
        result.aliases = aliases;
      }
    }
    if (Object.keys(companyFields).length || Object.keys(workFields).length) {
      let key = "legacyFields"; while (Object.hasOwn(result, key)) key += "_";
      result[key] = { ...(Object.keys(companyFields).length ? { company: { ...companyFields } } : {}), ...(Object.keys(workFields).length ? { work: { ...workFields } } : {}) };
    }
    return result;
  });
  const ids = new Set(history.map(entry => text(entry.id)));
  for (const company of companies.filter(company => !used.has(company))) {
    const entry = { ...company };
    if (ids.has(text(entry.id))) {
      let id = "company-" + text(entry.id); while (ids.has(id)) id += "-company";
      const previous = entry.id!; entry.id = id;
      let key = "legacyCompanyId"; while (Object.hasOwn(entry, key)) key += "_";
      entry[key] = previous;
    }
    ids.add(text(entry.id)); history.push(entry);
  }
  if (document.companies !== undefined || work.length) document.companies = history as JsonValue[];
  if (document.professionalProfile !== undefined) delete object(document.professionalProfile).experience;
  document.schemaVersion = 2;
  return document;
}
