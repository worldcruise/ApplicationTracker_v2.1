const bytes=value=>new TextEncoder().encode(value).length;
const sameLabel=(a,b)=>a.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US')===b.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');
const fail=(code,message)=>{throw Object.assign(Error(message),{code});};

export function parseQueueCoverLetter(raw,candidateId,jobId){
  if(typeof raw!=='string'||bytes(raw)>128*1024||!raw.trim())fail('LETTER_REQUIRED','Enter cover-letter text or turn Cover letter off.');
  return {schemaVersion:1,candidateId,jobId,paragraphs:raw.split(/\r?\n(?:[ \t]*\r?\n)+/).map(part=>part.trim()).filter(Boolean)};
}

export function createQueueResumeEditor({profiles,drafts,validateResume,makeSnapshot,parseCoverLetter=parseQueueCoverLetter}){
  async function inspect(record,input){
    const candidate=await profiles.get(record.candidateId),active=await profiles.bootstrap();
    if(!candidate||active?.id!==candidate.id)fail('CANDIDATE_CONFLICT','Select this job’s candidate before updating its resume.');
    const candidateInfo={id:candidate.id,name:candidate.document.candidate.name,exportDirectory:candidate.document.applicationPreferences?.exportDirectory||''};
    const cvJsonRaw=input.cvJsonRaw,coverLetterRaw=input.coverLetterRaw??'',coverLetterEnabled=input.coverLetterEnabled===true;
    if(typeof cvJsonRaw!=='string'||bytes(cvJsonRaw)>1024*1024)fail('INVALID_CV','CV JSON must be at most 1 MiB.');
    if(typeof coverLetterRaw!=='string'||bytes(coverLetterRaw)>128*1024)fail('INVALID_LETTER','Cover letter must be at most 128 KiB.');
    const parsed=validateResume(cvJsonRaw);
    if(!parsed.value)return {candidate:candidateInfo,validation:{state:parsed.state||(!cvJsonRaw.trim()?'empty':'schema_error'),message:parsed.message||'Paste valid six-field CV JSON.',fieldPath:parsed.fieldPath||'$'}};
    const cv=parsed.value;if(typeof cv.company!=='string'||!cv.company.trim()||cv.company.trim().length>300||typeof cv.title!=='string'||!cv.title.trim()||cv.title.trim().length>500)fail('INVALID_CV','Enter a company (up to 300 characters) and job title (up to 500 characters) in the CV JSON.');
    let letter=null;
    try{if(coverLetterEnabled)letter=parseCoverLetter(coverLetterRaw,candidate.id,`queue-resume:${record.id}`);}catch(error){return {candidate:candidateInfo,validation:{state:'letter_error',message:error.message,company:cv.company,title:cv.title,fieldPath:'coverLetterRaw'}};}
    const base=(await drafts.bootstrap(candidate.id)).record.draft;
    const draft={...base,id:`queue-resume:${record.id}`,candidateId:candidate.id,jobInputRaw:`${record.url}\n${record.description}`,cvJsonRaw,coverLetterRaw,coverLetterEnabled,
      documentTemplate:record.resume?.documentTemplate||base.documentTemplate,formattingOverrides:record.resume?.snapshot?.formattingOverrides||base.formattingOverrides||{},bindings:record.resume?.snapshot?.bindings||{experience:[],education:[]}};
    let snapshot;
    try{snapshot=makeSnapshot(candidate,draft,`queue-input:${record.id}`,1).snapshot;}catch(error){return {candidate:candidateInfo,validation:{state:'schema_error',message:error.message,fieldPath:error.fieldPath||'$'}};}
    return {candidate:candidateInfo,validation:{state:'valid',message:'CV ready to update or download.',company:cv.company,title:cv.title},prepared:{candidate,draft,snapshot,letter,
      company:sameLabel(record.company,cv.company)?record.company:cv.company.trim(),role:sameLabel(record.role,cv.title)?record.role:cv.title.trim()}};
  }
  return {inspect,async prepare(record,input){const result=await inspect(record,input);if(!result.prepared)fail('INVALID_CV',result.validation.message);return result.prepared;}};
}
