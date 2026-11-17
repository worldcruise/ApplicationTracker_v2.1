import {normalizeExperienceSentences} from './experience-text.mjs';

const plain = value => value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const fail = message => { throw new Error(message); };
function object(value, name, keys) {
  if (!plain(value)) fail(`${name} must be an object.`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${name}: unsupported field "${key}".`);
  return value;
}
function text(value, name, maximum = 12000, optional = false) {
  if (optional && value === undefined) return undefined;
  if (typeof value !== 'string' || value.length > maximum || (!optional && !value.trim())) fail(`${name} must be text${optional ? '' : ' and cannot be empty'} (up to ${maximum} characters).`);
  return value.trim();
}
function list(value, name, maximum, convert) {
  if (!Array.isArray(value) || value.length > maximum) fail(`${name} must be an array with up to ${maximum} entries.`);
  return value.map((item, index) => convert(item, `${name}[${index}]`));
}
const dates = ['startDate', 'endDate', 'location'];
function experience(value, name, {splitLong=false}={}) {
  object(value, name, ['title', 'company', 'sentences', ...dates]);
  const result = { title: text(value.title, `${name}.title`, 300), company: text(value.company, `${name}.company`, 300),
    sentences: list(normalizeExperienceSentences(value.sentences,{splitLong}), `${name}.sentences`, 100, (item, path) => text(item, path, 3000)) };
  for (const key of dates) if (value[key] !== undefined) result[key] = text(value[key], `${name}.${key}`, 300, true);
  return result;
}
function education(value, name) {
  object(value, name, ['degree', 'institution', ...dates]);
  const result = { degree: text(value.degree, `${name}.degree`, 500) };
  for (const key of ['institution', ...dates]) if (value[key] !== undefined) result[key] = text(value[key], `${name}.${key}`, 500, true);
  return result;
}
function contact(value) {
  object(value, 'contact', ['email', 'phone', 'location', 'website', 'linkedin']);
  return Object.fromEntries(Object.entries(value).map(([key, value]) => [key, text(value, `contact.${key}`, 500, true)]));
}
export function normalizeProfile(value) {
  object(value, 'Profile', ['schemaVersion', 'name', 'role', 'summary', 'skills', 'experience', 'education', 'contact', 'initials', 'filename', 'id', 'isExample']);
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1) fail('Unsupported profile schemaVersion. Use version 1.');
  const profile = { name: text(value.name, 'name', 200), role: text(value.role, 'role', 300), summary: text(value.summary, 'summary'),
    skills: list(value.skills, 'skills', 200, (item, path) => text(item, path, 200)),
    experience: list(value.experience, 'experience', 100, (item,path)=>experience(item,path,{splitLong:true})), education: list(value.education, 'education', 100, education) };
  if (value.contact !== undefined) profile.contact = contact(value.contact);
  if (JSON.stringify(profile).length > 200000) fail('The profile is too large. Use a file under 200 KB.');
  return profile;
}
export function parseProfile(source) {
  if (typeof source !== 'string' || source.length > 250000) fail('Import a profile JSON file under 250 KB.');
  let value;
  try { value = JSON.parse(source); } catch { fail('The profile file is not valid JSON. Download the example format.'); }
  return normalizeProfile(value);
}
function validateResume(source, request, {allowEmptySummary=false}={}) {
  if (typeof source !== 'string' || source.length > 500000) fail('The response is empty or exceeds 500 KB.');
  let raw = source.trim();
  const fenced = raw.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);
  if (fenced) raw = fenced[1].trim();
  let value;
  try { value = JSON.parse(raw); } catch { fail('The response is not one complete JSON object.'); }
  object(value, 'Response', ['schemaVersion', 'requestId', 'resume']);
  if (value.schemaVersion !== 1 || value.requestId !== request.id) fail('The response belongs to another request or schema version.');
  const resume = object(value.resume, 'resume', ['company', 'title', 'summary', 'skills', 'experience', 'education', 'contact']);
  if (typeof resume.company !== 'string') fail('resume.company must be text, including an empty string when the company is unknown.');
  const result = { company: text(resume.company, 'resume.company', 300, request.input.job.company === ''), title: text(resume.title, 'resume.title', 300), summary: allowEmptySummary&&resume.summary===''?'':text(resume.summary, 'resume.summary'),
    skills: list(resume.skills, 'resume.skills', 30, (group, name) => {
      if (!plain(group) || Object.keys(group).length !== 1) fail(`${name} must contain one named skill group.`);
      const [key] = Object.keys(group); text(key, name, 200);
      if (['__proto__', 'constructor', 'prototype'].includes(key)) fail('Invalid skill group name.');
      return { [key]: list(group[key], name, 200, (item, path) => text(item, path, 200)) };
    }), experience: list(resume.experience, 'resume.experience', 100, experience), education: list(resume.education, 'resume.education', 100, education) };
  if (resume.contact !== undefined) result.contact = contact(resume.contact);
  return result;
}
// Studio's six-field CV omits profile metadata. Restore it locally for validation
// and rendering, without adding it to the AI prompt or exported JSON.
export function restoreResumeMetadata(source,profile){
  const records=(items,original,keys)=>Array.isArray(items)?items.map((item,index)=>item&&typeof item==='object'?{...Object.fromEntries(keys.filter(key=>Object.hasOwn(original?.[index]||{},key)).map(key=>[key,original[index][key]])),...item}:item):items;
  return source&&typeof source==='object'?{...source,experience:records(source.experience,profile.experience,['startDate','endDate','location']),education:records(source.education,profile.education,['institution','startDate','endDate','location']),...!Object.hasOwn(source,'contact')&&profile.contact?{contact:profile.contact}:{}}:source;
}
export function parseResume(source, request, options) {
  try { return validateResume(source, request, options); }
  catch (error) { error.code = 'invalid-resume'; throw error; }
}
