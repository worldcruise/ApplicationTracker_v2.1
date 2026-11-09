import { profileValues } from './profile-values.js';

const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const text = value => typeof value === 'string' ? value : '';
const list = value => Array.isArray(value) ? value : [];
const omit = (value, keys) => Object.fromEntries(Object.entries(object(value)).filter(([key]) => !keys.includes(key)));

export function emptyProfile() {
  return {
    profileName: 'Default', nameData: { firstName: '', lastName: '', preferredName: false },
    addressData: { line1: '', city: '', state: '', postalCode: '', country: '' },
    contactData: { phoneDeviceType: '', phoneCountryCode: '', phoneNumber: '', email: '' },
    jobData: [], educationData: [], languageData: [], skillsData: [],
    resumeData: { resumeBase64: '', fileName: '', fileSize: 0, dateUploaded: '' },
    websiteData: { websites: [] }, employmentData: { gender: '', ethnicity: '' },
  };
}

export function normalizeProfile(value) {
  if (!value || !value.nameData || !value.contactData || !Array.isArray(value.jobData) || !Array.isArray(value.educationData)) {
    throw new Error('Choose a SpeedyApply profile JSON file.');
  }
  const defaults = emptyProfile(), result = {};
  for (const key of Object.keys(defaults)) {
    const input = value[key];
    result[key] = Array.isArray(defaults[key]) ? structuredClone(input ?? defaults[key])
      : typeof defaults[key] === 'object' ? { ...defaults[key], ...structuredClone(object(input)) } : input ?? defaults[key];
  }
  for (const key of ['jobData', 'educationData', 'languageData', 'skillsData']) if (!Array.isArray(result[key])) throw new Error(`Invalid SpeedyApply ${key}.`);
  if (typeof result.profileName !== 'string' || !result.profileName.trim()) throw new Error('Enter a profile name.');
  for (const [key, sample] of Object.entries(defaults)) {
    if (!sample || typeof sample !== 'object' || Array.isArray(sample)) continue;
    for (const [field, expected] of Object.entries(sample)) {
      if (Array.isArray(expected) ? !Array.isArray(result[key][field]) : typeof result[key][field] !== typeof expected) throw new Error(`Invalid SpeedyApply ${key}.${field}.`);
    }
  }
  if (result.addressData.country && !profileValues.countries.includes(result.addressData.country)) throw new Error('Use a country from the SpeedyApply profile editor.');
  if (result.skillsData.length > 25 || result.skillsData.some(skill => typeof skill !== 'string')) throw new Error('SpeedyApply profiles support up to 25 text skills.');
  if (!['', ...profileValues.genders].includes(result.employmentData.gender) || !['', ...profileValues.ethnicities].includes(result.employmentData.ethnicity)) throw new Error('Use employment answers from the SpeedyApply profile editor.');
  for (const key of ['eligibilityUS', 'sponsorship', 'disability', 'veteran', 'hispanicOrLatino']) {
    const answer = result.employmentData[key];
    if (answer !== undefined && typeof answer !== 'boolean' && answer !== 'undisclosed') throw new Error(`Invalid employment answer: ${key}.`);
  }
  const age = result.employmentData.age;
  if (age !== undefined && age !== 'undisclosed' && (typeof age !== 'number' || !Number.isFinite(age))) throw new Error('Invalid age answer.');
  for (const language of result.languageData) {
    if (!['', ...profileValues.languages].includes(language?.language) || !['', ...profileValues.proficiencies].includes(language?.proficiency) || typeof language.fluent !== 'boolean') throw new Error('Use language answers from the SpeedyApply profile editor.');
  }
  for (const key of ['prefix', 'middleName', 'suffix', 'preferredFirstName', 'preferredMiddleName', 'preferredLastName']) {
    if (result.nameData[key] !== undefined && typeof result.nameData[key] !== 'string') throw new Error(`Invalid name field: ${key}.`);
  }
  if (result.websiteData.websites.some(value => typeof value !== 'string')) throw new Error('Invalid profile website.');
  for (const job of result.jobData) {
    for (const key of ['jobTitle', 'company', 'location', 'startDate', 'description']) if (typeof job?.[key] !== 'string') throw new Error(`Invalid work history ${key}.`);
    if (typeof job.currentlyWorkHere !== 'boolean') throw new Error('Invalid current employment flag.');
    if (job.endDate !== undefined && typeof job.endDate !== 'string') throw new Error('Invalid work history endDate.');
  }
  for (const education of result.educationData) {
    for (const key of ['school', 'degree', 'fieldOfStudy']) if (typeof education?.[key] !== 'string') throw new Error(`Invalid education ${key}.`);
    if (typeof education.currentlyAttending !== 'boolean' || education.degree && !profileValues.degrees.includes(education.degree)) throw new Error('Use a degree from the SpeedyApply profile editor.');
    for (const key of ['startDate', 'endDate', 'gpa']) if (education[key] !== undefined && typeof education[key] !== 'string') throw new Error(`Invalid education ${key}.`);
  }
  return result;
}

export function profileName(profile) {
  const name = profile.nameData;
  const preferred = name.preferredName;
  return [preferred && name.preferredFirstName || name.firstName, preferred && name.preferredMiddleName || name.middleName, preferred && name.preferredLastName || name.lastName]
    .filter(Boolean).join(' ').trim() || profile.profileName;
}

function month(value) {
  const raw = text(value);
  if (/^\d{4}-(0[1-9]|1[0-2])/.test(raw)) return raw.slice(0, 7);
  const match = raw.match(/^(0?[1-9]|1[0-2])\/(\d{4})$/);
  return match ? `${match[2]}-${match[1].padStart(2, '0')}` : '';
}
function rows(values, identify, annotations, convert) {
  const used = new Map();
  return values.map((value, index) => {
    const key = identify(value), occurrence = used.get(key) || 0;
    used.set(key, occurrence + 1);
    const annotation = annotations.find(item => item.key === key && item.occurrence === occurrence);
    let hash = 2166136261;
    for (const character of `${key}:${occurrence}`) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return { ...object(annotation?.fields), id: annotation?.id || `profile-row-${(hash >>> 0).toString(16)}`, ...convert(value, index) };
  });
}
const jobKey = job => `${job.company}\0${job.jobTitle}`;
const educationKey = education => `${education.school}\0${education.degree}\0${education.fieldOfStudy}`;

// This document is a transient view for Studio's existing renderer, never the
// canonical stored profile. Autofill fields remain in SpeedyApply's structure.
export function profileToStudio(profile, id, extras = {}) {
  const contact = profile.contactData, address = profile.addressData, websites = profile.websiteData;
  const phone = [contact.phoneCountryCode, contact.phoneNumber].filter(Boolean).join(' ');
  return {
    ...object(extras.additional), schemaVersion: 2, kind: 'application-tracker-candidate',
    candidate: { ...object(extras.candidate), id, name: profileName(profile) },
    personalDetails: { ...object(extras.personalDetails), email: contact.email, phone,
      address: { street: [address.line1, address.line2].filter(Boolean).join(', '), city: address.city, state: address.state, postalCode: address.postalCode, country: address.country },
      onlinePresence: { linkedin: websites.linkedin || '', github: websites.github || '', website: websites.personal || websites.websites[0] || '' } },
    companies: rows(profile.jobData, jobKey, extras.roles || [], job => ({
      name: job.company, title: job.jobTitle, location: job.location, startDate: month(job.startDate), endDate: job.currentlyWorkHere ? null : month(job.endDate), current: job.currentlyWorkHere,
      shortDetail: job.description, highlights: [],
    })),
    professionalProfile: { ...object(extras.professionalProfile), skills: profile.skillsData,
      education: rows(profile.educationData, educationKey, extras.education || [], education => ({ school: education.school,
        degree: [education.degree, education.fieldOfStudy].filter(Boolean).join(' in '), startDate: month(education.startDate), endDate: education.currentlyAttending ? '' : month(education.endDate) })) },
    applicationPreferences: structuredClone(extras.applicationPreferences || {}),
    customPromptInstructions: structuredClone(extras.customPromptInstructions || []),
  };
}

function degree(value) {
  if (profileValues.degrees.includes(value)) return value;
  if (/bachelor|bsc|btech/i.test(value)) return "Bachelor's";
  if (/master|msc|mtech/i.test(value)) return "Master's";
  if (/phd|doctor/i.test(value)) return 'PhD';
  if (/associate/i.test(value)) return "Associate's";
  return value ? 'Other' : '';
}
function country(value) {
  const aliases = { US: 'United States of America', USA: 'United States of America', 'United States': 'United States of America', UK: 'United Kingdom' };
  return profileValues.countries.find(item => item.toLowerCase() === (aliases[value] || value).toLowerCase()) || '';
}

export function studioToProfile(document, previous = emptyProfile(), extras = {}) {
  const profile = structuredClone(previous), personal = object(document.personalDetails), professional = object(document.professionalProfile);
  const before = profileToStudio(previous, document.candidate.id, extras);
  if (document.candidate.name !== profileName(previous)) {
    const parts = document.candidate.name.trim().split(/\s+/);
    profile.nameData = { ...profile.nameData, firstName: parts.shift() || '', lastName: parts.length ? parts.pop() : '', middleName: parts.join(' '), preferredName: false };
  }
  if (personal.email !== before.personalDetails.email) profile.contactData.email = text(personal.email);
  if (personal.phone !== before.personalDetails.phone) { profile.contactData.phoneCountryCode = ''; profile.contactData.phoneNumber = text(personal.phone); }
  if (JSON.stringify(personal.address) !== JSON.stringify(before.personalDetails.address)) {
    const address = object(personal.address);
    profile.addressData = { ...profile.addressData, line1: text(address.street), line2: '', city: text(address.city), state: text(address.state), postalCode: text(address.postalCode), country: country(text(address.country)) };
  }
  const online = object(personal.onlinePresence);
  for (const [source, target] of [['linkedin', 'linkedin'], ['github', 'github'], ['website', 'personal']]) {
    if (online[source] !== before.personalDetails.onlinePresence[source]) profile.websiteData[target] = text(online[source]);
  }
  if (JSON.stringify(document.companies || []) !== JSON.stringify(before.companies)) profile.jobData = list(document.companies).map((job, index) => {
    const existing = previous.jobData[index], unchanged = before.companies[index];
    return { ...object(existing), jobTitle: text(job.title), company: text(job.name), location: text(job.location),
      startDate: unchanged?.startDate === job.startDate ? existing?.startDate || '' : text(job.startDate),
      endDate: unchanged?.endDate === job.endDate ? existing?.endDate || '' : text(job.endDate), currentlyWorkHere: job.current === true,
      description: [text(job.shortDetail), ...list(job.highlights).map(text)].filter(Boolean).join('\n') };
  });
  profile.skillsData = list(professional.skills).map(text).slice(0, 25);
  if (JSON.stringify(professional.education || []) !== JSON.stringify(before.professionalProfile.education)) profile.educationData = list(professional.education).map((education, index) => {
    const existing = previous.educationData[index], unchanged = before.professionalProfile.education[index];
    return { ...object(existing), school: text(education.school), degree: unchanged?.degree === education.degree ? existing?.degree || '' : degree(text(education.degree)),
      fieldOfStudy: unchanged?.degree === education.degree ? existing?.fieldOfStudy || '' : text(education.degree).split(/\s+in\s+/i).slice(1).join(' in ') || (!profileValues.degrees.includes(education.degree) ? text(education.degree) : ''), currentlyAttending: existing?.currentlyAttending || false,
      startDate: unchanged?.startDate === education.startDate ? existing?.startDate || '' : text(education.startDate),
      endDate: unchanged?.endDate === education.endDate ? existing?.endDate || '' : text(education.endDate) };
  });
  return normalizeProfile(profile);
}

export function studioExtras(document, profile) {
  const annotate = (values, profiles, identify, mapped) => {
    const used = new Map();
    return values.map((value, index) => {
      const key = identify(profiles[index]), occurrence = used.get(key) || 0;
      used.set(key, occurrence + 1);
      return { key, occurrence, id: value.id, fields: omit(value, ['id', ...mapped]) };
    });
  };
  return {
    candidate: omit(document.candidate, ['id', 'name']), personalDetails: omit(document.personalDetails, ['email', 'phone', 'address', 'onlinePresence']),
    professionalProfile: omit(document.professionalProfile, ['skills', 'education', 'experience']),
    applicationPreferences: structuredClone(document.applicationPreferences || {}), customPromptInstructions: structuredClone(document.customPromptInstructions || []),
    roles: annotate(list(document.companies), profile.jobData, jobKey, ['name', 'title', 'location', 'startDate', 'endDate', 'current', 'shortDetail', 'highlights']),
    education: annotate(list(document.professionalProfile?.education), profile.educationData, educationKey, ['school', 'degree', 'startDate', 'endDate']),
    additional: omit(document, ['schemaVersion', 'kind', 'candidate', 'personalDetails', 'companies', 'professionalProfile', 'applicationPreferences', 'customPromptInstructions']),
  };
}
