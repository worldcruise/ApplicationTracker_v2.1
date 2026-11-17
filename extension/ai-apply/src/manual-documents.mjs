import { parseResume,restoreResumeMetadata } from './resume-data.mjs';
import {combinedDocumentObject,validateGeneration} from './generation-data.mjs';
import {selectedDocumentSettings} from './generation-selection.mjs';
import {DOCUMENT_CONTRACT_VERSION} from './document-contract.mjs';


export function manualRetrievalContext(request,run,selectedModules){
  if(run&&run.jobId!==request.id)throw Error('This AI result belongs to another job.');
  if(run&&run.jobId!==request.id)throw Error('This AI result belongs to another job.');
  const settings=selectedDocumentSettings(null,{...run?.documentSettings,selectedModules:run?.selectedModules??run?.documentSettings?.selectedModules??selectedModules});
  return {request:{...request,input:run?.inputSnapshot||run?.job?.input||request.input},settings,runId:run?.id??null,contractVersion:run?.documentContractVersion??DOCUMENT_CONTRACT_VERSION};
}
export function validateManualRetrieval(source,context){
  return validateGeneration(source,context.request,context.runId,'combined-json',context.settings,{contractVersion:context.contractVersion});
}

export function parseManualDocuments(source,request){
  const value=combinedDocumentObject(source),includeCoverLetter=typeof value.coverLetter==='string'&&!!value.coverLetter.trim();
  return validateGeneration(source,request,null,'combined-json',{includeCoverLetter},{contractVersion:2});
}

export function manualDocumentValue(request){
  const job=request.input.job,resume=request.resume;
  const salary=job.salaryDetails?structuredClone(job.salaryDetails):['listed','estimated'].includes(job.salarySource)&&job.salary?{value:job.salary,source:job.salarySource,evidence:job.salaryEvidence||'',basis:job.salaryBasis||''}:{min:0,max:0,currency:'USD',period:'year',sourceText:''};
  return {requestId:request.id,job:{company:job.company,title:job.role,applyUrl:job.url||'',description:job.description,salary},
    resume:{company:resume.company,title:resume.title,summary:resume.summary,skills:resume.skills,
      experience:resume.experience.map(({title,company,sentences})=>({title,company,sentences})),education:resume.education.map(({degree})=>({degree}))},
    coverLetter:request.coverLetterEnabled?request.coverLetter||'':''};
}

// Manual imports accept the full chat reply or its resume object. The same
// candidate facts and company validation apply to both shapes.
export function parseManualResume(source, request) {
  if (typeof source !== 'string' || source.length > 500000) throw new Error('Use a resume JSON file under 500 KB.');
  const raw = source.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('Paste one complete resume JSON object.'); }
  const envelope = value && Object.hasOwn(value, 'resume') ? {schemaVersion:1,requestId:request.id,...value} : { schemaVersion: 1, requestId: request.id, resume: value };
  if (Object.hasOwn(envelope, 'coverLetter')) delete envelope.coverLetter;
  if (Object.hasOwn(envelope, 'runId')) delete envelope.runId;
  if (Object.hasOwn(envelope, 'job')) delete envelope.job;
  envelope.resume=restoreResumeMetadata(envelope.resume,request.input.profile);
  return parseResume(JSON.stringify(envelope), request,{allowEmptySummary:true});
}
