// The integrated app renders PDFs through Resume Studio, including previews.
// The worker installs a direct backend; extension pages use its authorized bridge.
let backend;
export function setStudioPDFBackend(value){backend=value;}
export async function renderStudioPDF(run,kind,{browser=globalThis.chrome}={}){
  if(!['resume','cover-letter'].includes(kind))throw Error('Choose a resume or cover letter.');
  const profile=run.job?.input?.profile;
  const resume=run.result?.resume||(kind==='cover-letter'?{company:run.job.input.job.company,title:profile.role||run.job.input.job.role,summary:profile.summary||' ',skills:[],experience:[],education:[]}:null);
  const payload={jobId:run.jobId||run.job?.id,candidateId:run.job?.input?.candidateId,
    sourceJob:run.job?.input?.job,resume,coverLetter:run.result?.coverLetter||'',kind};
  const pdf=backend?await backend(payload):await browser.runtime.sendMessage({type:'ai-apply.pdf',payload}).then(reply=>{
    if(!reply?.ok)throw Error(reply?.error||'Resume Studio could not render this PDF. Reload the extension and retry.');
    return reply.value;
  });
  if(typeof pdf?.base64!=='string'||!atob(pdf.base64).startsWith('%PDF-'))throw Error('Resume Studio returned an invalid PDF.');
  return pdf;
}
