import { parseResume,restoreResumeMetadata } from './resume-data.mjs';
import { normalizeDocumentSettings } from './document-settings.mjs';
import { applicationJobEvidence, validateJobFields } from './job-cleanup.mjs';
import {normalizeWritingPrompts} from './writing-prompts.mjs';
import {substitutePromptPlaceholders} from '../../studio/prompt-placeholders.js';
import {selectedDocumentSettings} from './generation-selection.mjs';
import {DOCUMENT_CONTRACT_VERSION,finalDocumentContract,validateFinalDocumentShape} from './document-contract.mjs';

export const providerHome = provider => ({ chatgpt: 'https://chatgpt.com/', deepseek: 'https://chat.deepseek.com/' })[provider] || null;
export function providerUrl(value, provider, conversationOnly = false) {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(providerHome(provider)).origin || url.username || url.password) return null;
    const conversation = provider === 'chatgpt' ? /^\/(?:g\/[\w-]+\/)?c\/[\w-]+\/?$/ : /^\/a\/chat\/s\/[\w-]+\/?$/;
    return conversation.test(url.pathname) || !conversationOnly && url.pathname === '/' ? url.origin + url.pathname : null;
  } catch { return null; }
}
export const runMarker = id => `DOCUMENT_RUN:${id}`;
export function generationPrompt(job, runId, settings, writingPrompts) {
  const selected=selectedDocumentSettings(job,normalizeDocumentSettings(settings));
  return generationInstructions(job,selected,writingPrompts);
}

// Shared by the queued-job workflow and Settings' combined prompt preview.
export function generationInstructions(job,settings,writingPrompts){
  const writing=normalizeWritingPrompts(writingPrompts),selected=selectedDocumentSettings(job,settings);
  const raw=job.input.job||{};
  const values={...job.input.promptValues,job_company:raw.company||'',job_title:raw.role||'',job_url:raw.url||'',job_description:raw.description||''};
  const tasks=[selected.includeJobAnalysis?['Task 1 (JD)',writing.jdAnalysis]:null,selected.includeResume?['Task 2 (Resume)',job.input.prompt||'Generate the resume using the saved candidate profile and the supplied job description.']:null,selected.includeCoverLetter?['Task 3 (Cover letter)',writing.coverLetter]:null].filter(Boolean).map(([title,text])=>title+'\n'+substitutePromptPlaceholders(text,values,{emptyMissing:!!job.input.promptValues})).join('\n\n');
  const sections={tasks,final_output:finalDocumentContract({...selected,requestId:job.id,structure:writing.finalJson}),job_description:job.input.job?.description||''};
  const instruction=substitutePromptPlaceholders(writing.instruction,{...values,...sections},{emptyMissing:true});
  // Existing custom templates can place these sections explicitly. Otherwise
  // always append them, so editing the instruction cannot drop selected tasks.
  const combined=[instruction,...Object.entries(sections).filter(([key])=>key!=='job_description'&&!writing.instruction.includes('{{'+key+'}}')).map(([key,text])=>key==='tasks'?text:'==========\nfinal output\n'+text)].filter(Boolean).join('\n\n');
  return combined+'\n\n==========\nCompany: '+values.job_company+'\nTitle: '+values.job_title+'\nURL: '+values.job_url+'\nDescription:\n'+values.job_description;
}

// A combined reply belongs to its bound chat turn; requestId also identifies its job.
export function combinedDocumentObject(raw){
  if(typeof raw!=='string'||raw.length>500000)throw Error('The reply exceeds 500 KB.');
  const text=raw.trim().replace(/^\x60\x60\x60(?:json)?\s*\n?([\s\S]*?)\n?\x60\x60\x60$/i,'$1');
  let value;try{value=JSON.parse(text);}catch(error){throw documentJSONError(text,error);}
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Return one complete JSON object containing the final documents.');
  return value;
}

function documentJSONError(text,error){
  const match=String(error.message).match(/position (\d+)/i);
  let position=match?Number(match[1]):null;
  // Some browser versions omit the character offset. Diagnose an extra final
  // brace by checking the preceding object, never by repairing the reply.
  if(position===null&&text.endsWith('}')){
    try{const prefix=JSON.parse(text.slice(0,-1));if(prefix&&typeof prefix==='object'&&!Array.isArray(prefix))position=text.length-1;}catch{}
  }
  let reason='Invalid JSON';
  if(position!==null){
    let prefix;try{prefix=JSON.parse(text.slice(0,position));}catch{}
    if(prefix&&typeof prefix==='object'&&!Array.isArray(prefix)){
      if(/^\s*}+\s*$/.test(text.slice(position)))reason='Extra closing brace after the final JSON object. Remove the extra trailing }';
      else if(text[position]==='{')reason='More than one JSON object was captured. Keep only the final document object';
      else reason='Unexpected text after the final JSON object. Keep only the JSON object or its single code block';
    }else if(/control character|unterminated string/i.test(error.message))reason='Invalid JSON string. Escape line breaks as \\n and quotation marks as \\"';
    const before=text.slice(0,position),line=before.split('\n').length,column=position-before.lastIndexOf('\n');
    return Object.assign(Error(reason+' (line '+line+', column '+column+'). Return one complete JSON object containing the final documents.'),{code:'invalid-document-json',line,column});
  }
  if(/unexpected end|unterminated/i.test(error.message))reason='The JSON is incomplete. Wait for the full reply or copy the complete object';
  return Object.assign(Error(reason+'. Return one complete JSON object containing the final documents.'),{code:'invalid-document-json'});
}

// Extract complete objects without repairing JSON or treating braces inside strings as structure.
export function jsonObjects(raw) {
  if (typeof raw !== 'string' || raw.length > 500000) throw new Error('The reply exceeds 500 KB.');
  const values = []; let start = -1, depth = 0, quoted = false, escaped = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (start < 0) { if (char === '{') { start = i; depth = 1; } continue; }
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) {
      try { values.push(JSON.parse(raw.slice(start, i + 1))); } catch { /* Invalid objects remain invalid. */ }
      start = -1;
    }
  }
  return values;
}
export function validateGeneration(raw, job, runId, format, settings, { requireJob = false, contractVersion = null } = {}) {
  if(contractVersion>=4){if(!Array.isArray(settings?.selectedModules))throw Error('This request has no saved generation selection.');settings=selectedDocumentSettings(null,settings);}
  const { includeCoverLetter } = normalizeDocumentSettings(settings);
  if(format==='combined-json'){
    const value=combinedDocumentObject(raw);
    if([1,2,3,4,DOCUMENT_CONTRACT_VERSION].includes(contractVersion))validateFinalDocumentShape(value,{...settings,includeCoverLetter,version:contractVersion});
    if(value.requestId!==undefined&&value.requestId!==job.id||value.runId!==undefined&&value.runId!==runId)throw Error('The document belongs to another job or run.');
    const nested=Object.hasOwn(value,'resume');
    const allowed=nested?['schemaVersion','requestId','runId','job','resume','coverLetter']:['schemaVersion','requestId','runId','job','company','title','summary','skills','experience','education','contact','coverLetter'];
    if(Object.keys(value).some(key=>!allowed.includes(key)))throw Error('The document object contains unsupported fields.');
    const details=value.job?validateJobFields(value.job,applicationJobEvidence(job.input),{allowMissingUrl:true,allowUnknownUrl:contractVersion>=2,allowMissingSalary:contractVersion>=2}):null;
    if(details&&contractVersion>=2){if(!details.url)details.url=job.input.job.url||'';if(details.salarySource==='unknown'&&job.input.job.salary){delete details.salaryDetails;Object.assign(details,Object.fromEntries(['salary','salaryDetails','salarySource','salaryBasis','salaryEvidence'].filter(key=>job.input.job[key]!==undefined).map(key=>[key,job.input.job[key]])));}}
    if(includeCoverLetter&&(typeof value.coverLetter!=='string'||!value.coverLetter.trim()||value.coverLetter.length>50000))throw Error('The cover letter must contain text under 50,000 characters.');
    const bare=Object.fromEntries(Object.entries(value).filter(([key])=>!['schemaVersion','requestId','runId','job','coverLetter'].includes(key)));
    const local=settings?.includeResume===false&&contractVersion>=3?null:restoreResumeMetadata(nested?value.resume:bare,job.input.profile);
    const resume=contractVersion>=3&&settings?.includeResume===false?null:parseResume(JSON.stringify({schemaVersion:value.schemaVersion??1,requestId:job.id,resume:local}),details?{...job,input:{...job.input,job:{...job.input.job,...details}}}:job,{allowEmptySummary:[1,2,4,DOCUMENT_CONTRACT_VERSION].includes(contractVersion)});
    return {resume,coverLetter:includeCoverLetter?value.coverLetter.trim():'',document:structuredClone(value),...(details?{job:details}:{})};
  }
  let objects;
  if (format === 'json-code-block') {
    try {
      const value = JSON.parse(raw);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
      objects = [value];
    }
    catch { throw new Error('The response code block must contain exactly one complete JSON object. Review the captured output.'); }
  }
  const candidates = (objects || jsonObjects(raw)).filter(value => value.requestId === job.id && value.runId === runId);
  if (candidates.length !== 1) throw new Error('Expected one complete document object matching this job and run.');
  const value = candidates[0];
  if (Object.keys(value).some(key => !['schemaVersion', 'requestId', 'runId', 'job', 'resume', 'coverLetter'].includes(key))) throw new Error('The document object contains unsupported fields.');
  if (requireJob && !value.job) throw new Error('The reply must include the cleaned job details and salary.');
  const details = value.job ? validateJobFields(value.job, applicationJobEvidence(job.input), { allowMissingUrl: true }) : null;
  if (includeCoverLetter && (typeof value.coverLetter !== 'string' || !value.coverLetter.trim() || value.coverLetter.length > 50000)) throw new Error('The cover letter must contain text under 50,000 characters.');
  const resume = parseResume(JSON.stringify({ schemaVersion: value.schemaVersion, requestId: value.requestId, resume: value.resume }),
    details ? { ...job, input: { ...job.input, job: { ...job.input.job, ...details } } } : job);
  return { resume, coverLetter: includeCoverLetter ? value.coverLetter.trim() : '', ...(details ? { job: details } : {}) };
}

export const runningPhases = ['opening', 'preparing', 'waiting-login', 'sending', 'submitted', 'generating'];
export const phaseLabel = run => run?.manualPrompt&&!run.sendIntentAt&&runningPhases.includes(run.phase)?'Prompt copied · paste and send it in AI chat':run?.manualAnswer&&runningPhases.includes(run.phase)?'Copy the AI reply to retrieve it automatically':runningPhases.includes(run?.phase) && run?.trackingState === 'suspended' ? (run.provider === 'deepseek' ? 'Tracking paused · use Resume' : 'Tracking paused · check AI tab') :
  runningPhases.includes(run?.phase) && run?.trackingState === 'reconnecting' ? 'Reconnecting to chat' : ({ opening: 'Opening chat', preparing: 'Preparing prompt', 'waiting-login': 'Sign in in the AI tab',
  sending: 'Confirming submission', submitted: 'Submitted · waiting for reply', generating: 'Generating documents',
  validating: 'Checking documents', complete: run?.downloads?.savedAt ? 'Documents saved' : 'Ready to review', invalid: 'Reply needs review', attention: 'Needs attention', stopped: 'Tracking stopped' })[run?.phase] || '';
