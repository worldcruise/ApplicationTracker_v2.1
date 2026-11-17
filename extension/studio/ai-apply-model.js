import {normalizeExperienceSentences} from '../ai-apply/src/experience-text.mjs';
import {isJobReady} from '../ai-apply/src/job-readiness.mjs';

// The template is a projection of the existing queue, never another database.
export function aiProfile(candidate) {
  if (!candidate) return null;
  const doc=candidate.document, professional=doc.professionalProfile||{}, personal=doc.personalDetails||{};
  const experience=(doc.companies||[]).map(item=>({title:item.title||'Role',company:item.name||'Company',
    sentences:normalizeExperienceSentences([...(item.highlights||[]),item.shortDetail||''],{splitLong:true}),
    ...(item.startDate?{startDate:item.startDate}:{}),...(item.current?{endDate:'Present'}:item.endDate?{endDate:item.endDate}:{}),...(item.location?{location:item.location}:{})}));
  const data={name:doc.candidate.name,role:professional.role||experience[0]?.title||'Professional',
    summary:professional.summary||professional.shortBio||professional.bio||experience[0]?.sentences[0]||'Prepare a resume using the facts in this profile.',
    skills:(professional.skills||[]).map(item=>typeof item==='string'?item:item.name).filter(Boolean),experience,
    education:(professional.education||[]).map(item=>({degree:item.degree||'Education',...(item.school?{institution:item.school}:{}),...(item.startDate?{startDate:item.startDate}:{}),...(item.endDate?{endDate:item.endDate}:{})})),
    contact:Object.fromEntries(Object.entries({email:personal.email,phone:personal.phone,location:[personal.address?.city,personal.address?.state].filter(Boolean).join(', '),website:personal.onlinePresence?.website,linkedin:personal.onlinePresence?.linkedin}).filter(([,v])=>v))};
  if(!Object.keys(data.contact).length)delete data.contact;
  return {id:candidate.id,data,filename:candidate.originalFilename||'Current resume',isExample:false,createdAt:Date.parse(candidate.createdAt)||0};
}
export function aiJob(record,profile,index=0) {
  const extra=record.aiApply||{},job={...extra.input?.job,company:record.company,role:record.role,url:record.url,description:record.description,salary:record.salary||''};
  if(job.salary!==extra.input?.job?.salary){delete job.salaryDetails;job.salarySource='user';job.salaryEvidence='';job.salaryBasis='';}
  let resume=null;
  if(record.resume){try{resume=JSON.parse(record.resume.cvJsonRaw);}catch{/* The existing record remains untouched. */}}
  const currentResume=record.resume&&record.resume.inputRevision===record.inputRevision;
  const ready=isJobReady({...record,documentsStale:!currentResume});
  return {...extra,id:record.id,input:{...extra.input,candidateId:record.candidateId,profile:extra.input?.profile||profile?.data,
    tailor:extra.input?.tailor??true,resumeTemplate:extra.input?.resumeTemplate||'kakuna',promptTemplate:extra.input?.promptTemplate||'focused',
    prompt:extra.input?.prompt||record.promptSnapshot?.text||'Use only the facts in this profile.',job},
    state:ready||record.status==='Ready'&&currentResume?'ready':record.status==='Failed'?'attention':extra.state==='cancelled'?'cancelled':'queued',
    ...ready?{needsAction:false,error:''}:{},
    resume:currentResume?(extra.sharedResumeVersion===record.resume.version&&extra.resume?extra.resume:resume&&{...resume,...profile?.data.contact?{contact:profile.data.contact}:{},experience:resume.experience.map((item,i)=>({...profile?.data.experience[i],...item})),education:resume.education.map((item,i)=>({...profile?.data.education[i],...item}))}):null,documentsStale:!!record.resume&&!currentResume,
    coverLetter:record.resume?.coverLetterRaw||record.coverLetterRaw||'',coverLetterEnabled:record.resume?.coverLetterEnabled??record.coverLetterEnabled===true,
    manualChatUrl:record.conversationUrl||extra.manualChatUrl||'',createdAt:Date.parse(record.createdAt)||0,updatedAt:Date.parse(record.updatedAt)||0,
    canonicalRevision:record.revision,sequence:extra.sequence||index+1};
}
export function aiQueueState(saved,candidate) {
  const profile=aiProfile(candidate);
  return {profiles:profile?[profile]:[],control:{selectedCandidateId:profile?.id||null},
    requests:saved.jobs.filter(item=>!item.deletedAt&&!item.applicationId&&item.candidateId===profile?.id).map((item,i)=>aiJob(item,profile,i))};
}
export function nativeResume(resume) {
  return {company:resume.company,title:resume.title,summary:resume.summary,skills:resume.skills,
    experience:resume.experience.map(({title,company,sentences})=>({title,company,sentences})),education:resume.education.map(({degree})=>({degree}))};
}
