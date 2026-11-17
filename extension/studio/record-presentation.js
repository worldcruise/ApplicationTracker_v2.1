import {meetingApplicationId} from './meeting-model.js';
export function applicationDocumentRecord(record,applications=[]){
  const id=record.applicationId||meetingApplicationId(record)||record.id;
  const match=applications.find(row=>row.id===record.id||row.workflowApplicationId===id||row.workflowApplicationId===record.id)
    ||applications.find(row=>row.company===(record.companyName||record.company)&&row.role===(record.jobTitle||record.role)&&(!record.jobLink||row.url===record.jobLink));
  return match||{...record,company:record.companyName||record.company,role:record.jobTitle||record.role,url:record.jobLink||record.url,description:record.description||record.jobDescription||'',coverLetterRaw:record.coverLetterRaw??record.resume?.coverLetterRaw,coverLetterEnabled:record.coverLetterEnabled??record.resume?.coverLetterEnabled};
}
export function companyInitials(name='') {return name.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()||'J';}
export function companyHue(name='') {return [...name].reduce((sum,char)=>sum+char.charCodeAt(0)*17,0)%360;}
export function recordDocumentText(record={},kind){
  if(kind==='jd')return record.description||record.jobDescription||'No job description saved with this application.';
  if(kind==='letter')return record.coverLetterRaw||record.resume?.coverLetterRaw||'No cover letter was submitted.';
  const cv=record.resume?.snapshot?.resume;if(!cv)return 'No resume was saved with this application.';
  const profile=record.resume.snapshot.profile||{},lines=[record.resume.snapshot.candidate?.name||'',cv.title||record.role||'',...(profile.contact||[]),'',cv.summary||''];
  if(cv.skills?.length)lines.push('\nSkills',...cv.skills.flatMap(group=>Object.entries(group).map(([key,values])=>`${key}: ${Array.isArray(values)?values.join(', '):values}`)));
  for(const [key,label] of [['experience','Experience'],['education','Education']])if(cv[key]?.length){lines.push(`\n${label}`);cv[key].forEach((entry,index)=>{const facts=profile[key]?.find(item=>item.id===record.resume.snapshot.bindings?.[key]?.[index])||{};lines.push([entry.title||facts.role||entry.degree||facts.degree,entry.company||facts.company||facts.school].filter(Boolean).join(' · '),...(entry.sentences||[]).map(sentence=>`• ${sentence}`),'');});}
  return lines.join('\n');
}
export function createRecordDocuments(React){
  const h=React.createElement;
  return function RecordDocuments({record,kind}){return h('section',{className:'record-document-content','aria-label':kind==='jd'?'Job description':kind==='letter'?'Cover letter':'Resume'},h('h3',null,kind==='jd'?'Job description':kind==='letter'?'Submitted cover letter':'Submitted resume'),h('p',{className:'record-document-note'},kind==='jd'?'Saved with this application.':'Submitted documents are read only.'),h('div',{className:'record-document-copy'},recordDocumentText(record,kind)));};
}
