// Keep the credential (Bachelor of Science) separate from the subject studied.
import {profileValues} from './profile-values.js';
const degreePattern=/\b(?:Bachelor(?:['’]s)?|Master(?:['’]s)?|Associate(?:['’]s)?|Doctor(?:ate)?|Ph\.?\s?D\.?|B\.?\s?Sc\.?|M\.?\s?Sc\.?|B\.?\s?Eng\.?|M\.?\s?Eng\.?|B\.?\s?[SA]\.?|M\.?\s?[SA]\.?)\b/i;
const schoolPattern=/\b(?:university|college|institute|polytechnic|academy|school)\b/i;
const trim=value=>String(value??'').replace(/^[\s.,|;:–—-]+|[\s.,|;:–—-]+$/g,'').trim();
export const hasDegree=value=>degreePattern.test(String(value||''));
export const hasSchool=value=>schoolPattern.test(String(value||''));

export function educationQualification(value,{school=''}={}){
  let source=trim(value),institution=trim(school),degree='',degreeName='',fieldOfStudy='';
  const match=source.match(degreePattern);
  if(match){
    const prefix=trim(source.slice(0,match.index));
    if(!institution&&hasSchool(prefix))institution=prefix;
    source=source.slice(match.index);
  }
  // A school may precede or follow the qualification on the same line.
  const pieces=source.split(/\s*[,|;–—]\s*/);
  const schoolIndex=pieces.findIndex(piece=>hasSchool(piece)&&!hasDegree(piece));
  if(schoolIndex>=0){institution||=trim(pieces.slice(schoolIndex).join(', '));source=pieces.slice(0,schoolIndex).join(', ');}
  if(institution){const at=source.toLowerCase().indexOf(institution.toLowerCase());if(at>=0)source=source.slice(0,at);}
  const token=source.match(degreePattern);
  if(token){
    const label=token[0].replace(/[.\s]/g,'').toLowerCase();
    degree=/^(?:bachelor|bsc|beng|bs|ba)/.test(label)?"Bachelor's":/^(?:master|msc|meng|ms|ma)/.test(label)?"Master's":/^associate/.test(label)?"Associate's":'PhD';
    let rest=trim(source.slice(token.index+token[0].length)).replace(/^(?:of|in)\s+/i,'');
    const award=rest.match(/^(Science|Arts|Engineering|Technology|Business Administration|Fine Arts|Applied Science|Education|Laws?|Medicine)(?:\s+in\s+(.+))?$/i);
    if(award){degreeName=trim(source.slice(0,source.length-(award[2]?.length||0)).replace(/\s+in\s*$/i,''));fieldOfStudy=trim(award[2]||'');}
    else {degreeName=trim(token[0]);fieldOfStudy=trim(rest);}
    // Abbreviated credentials still retain their original label.
    if(!degreeName)degreeName=trim(token[0]);
  }else fieldOfStudy=source;
  fieldOfStudy=trim(fieldOfStudy.replace(/^(?:of\s+)?(?:Science|Arts|Engineering|Technology|Applied Science)\s+in\s+/i,'').replace(/\s+(?:GPA|CGPA)\s*:?.*$/i,''));
  if(/^(?:Science|Arts)$/i.test(fieldOfStudy))fieldOfStudy='';
  return {school:institution,degree,degreeName,fieldOfStudy};
}

export function normalizeImportedEducation(entry){
  const qualification=educationQualification(entry.degreeName||entry.qualification||entry.degree||'',{school:entry.school});
  const subject=entry.fieldOfStudy?educationQualification(entry.fieldOfStudy,{school:qualification.school}):null;
  return {...entry,school:qualification.school,degree:qualification.degree||(profileValues.degrees.includes(entry.degree)?entry.degree:''),
    ...(qualification.degreeName?{degreeName:qualification.degreeName}:{}),fieldOfStudy:subject?.fieldOfStudy||qualification.fieldOfStudy||''};
}
