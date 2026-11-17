import {renderStudioPDF} from '../ai-apply/src/studio-pdf.mjs';

export async function savedCoverLetter(job) {
  const text=job.resume?.coverLetterRaw||job.coverLetterRaw||'';
  if(!text.trim())return null;
  if(!job.resume?.snapshot||job.resume.inputRevision!==job.inputRevision)return {text};
  const pdf=await renderStudioPDF({jobId:job.id,job:{input:{candidateId:job.candidateId}},result:{resume:job.resume.snapshot.resume,coverLetter:text}},'cover-letter');
  return {text,resumeBase64:pdf.base64,fileName:pdf.filename||'Cover letter.pdf'};
}
