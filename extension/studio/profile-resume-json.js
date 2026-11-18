import {resumeCVJSON} from './resume-cv-json.js';

const text=value=>typeof value==='string'?value.trim():'';
const list=value=>Array.isArray(value)?value:[];
// Keep the resume in the same six-field JSON contract used by Resume Studio.
// The uploaded file remains separate and unchanged for application attachments.
export function profileResumeCV(profile,provided){
  let value=provided;
  if(!value&&profile.resumeData?.cvJsonRaw){try{value=JSON.parse(profile.resumeData.cvJsonRaw);}catch{}}
  value||=profile.resumeData?.cv||resumeCVJSON({profile});
  return {company:text(value.company)||'Unknown',title:text(value.title)||'Unknown',summary:text(value.summary),
    skills:list(value.skills).flatMap(group=>{const entries=Object.entries(group||{}).filter(([name,skills])=>text(name)&&Array.isArray(skills)).map(([name,skills])=>[text(name),skills.map(text).filter(Boolean)]).filter(([,skills])=>skills.length);return entries.length?[Object.fromEntries(entries)]:[];}),
    experience:list(value.experience).filter(row=>row&&typeof row==='object').map(row=>({title:text(row.title)||'Unknown',company:text(row.company)||'Unknown',sentences:list(row.sentences).map(text).map(line=>line.replace(/^\s*(?:[-•▪●◦‣]+|\d+[.)])\s*/,'' )).filter(Boolean)})),
    education:list(value.education).filter(row=>row&&typeof row==='object').map(row=>({degree:text(row.degree)||'Unknown'}))};
}
export function withProfileResumeJSON(profile,provided){
  if(!profile.resumeData?.resumeBase64&&!profile.resumeData?.cvJsonRaw&&!profile.resumeData?.cv)return profile;
  const cv=profileResumeCV(profile,provided);
  return {...profile,resumeData:{...profile.resumeData,cv,cvJsonRaw:JSON.stringify(cv,null,2)}};
}
