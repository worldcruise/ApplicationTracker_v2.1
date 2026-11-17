import {resumeCVJSON} from './resume-cv-json.js';
import {normalizeImportedEducation} from './education-fields.js';

// Use the original multipart /api/ext/resume client and its response schema.
export async function parseResumeUpload(input,{parse}={}){
  const invoke=parse;
  if(typeof invoke!=='function')throw Error('The Application Tracker resume parser is unavailable. Reload the extension.');
  const pdf=/\.pdf$/i.test(input.fileName||''),docx=/\.docx$/i.test(input.fileName||'');
  if(!pdf&&!docx)throw Error('Choose a PDF or DOCX resume.');
  if(typeof input.base64!=='string'||!input.base64||!/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64))throw Error('The resume file could not be read.');
  const binary=atob(input.base64);
  if(binary.length>(pdf?1024*1024:6*1024*1024))throw Error(pdf?'Application Tracker accepts PDF resumes up to 1 MB. Choose a smaller PDF.':'Choose a DOCX resume up to 6 MiB.');
  if(pdf?!binary.slice(0,1024).includes('%PDF-'):!binary.startsWith('PK'))throw Error('Choose a valid '+(pdf?'PDF':'DOCX')+' resume.');
  let result;
  try{result=await invoke({base64:input.base64,fileName:input.fileName});}
  catch(error){throw Error('Application Tracker could not parse the resume. '+(error?.message||'Check your connection and try again.'));}
  const profile=result?.profile||result;
  if(!profile||typeof profile!=='object'||Array.isArray(profile))throw Error('Application Tracker returned an invalid profile. Try another PDF or enter your details manually.');
  if(!input.includeMetadata)return profile;
  // The optional CV JSON is a separate Studio export; keep the profile response unchanged.
  const cvProfile={...profile,educationData:(profile.educationData||[]).map(normalizeImportedEducation)};
  return {schemaVersion:1,source:{fileName:input.fileName,pageCount:null,parser:'speedyapply'},profile,cv:resumeCVJSON({profile:cvProfile}),warnings:[]};
}
