import {emptyProfile,normalizeProfile} from './profile-model.js';

// Apply only returned sections, preserving the current profile's other fields.
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
const display=value=>value==null||value===''?null:typeof value==='boolean'?value?'Yes':'No':Array.isArray(value)?value.length?value.join(', '):null:String(value);
export function applyParsedResumeProfile(previous,parsed){
  if(!record(parsed))throw Error('The resume parser returned no profile.');
  const profile=normalizeProfile(previous||emptyProfile());
  for(const section of ['nameData','contactData','addressData','websiteData']){
    if(!record(parsed[section]))continue;
    for(const [field,value]of Object.entries(parsed[section])){
      if(section==='websiteData'&&field==='websites')continue;
      if(display(value)!==null&&display(value)!==display(profile[section][field]))profile[section][field]=structuredClone(value);
    }
  }
  const websites=parsed.websiteData?.websites;
  if(Array.isArray(websites)&&websites.length){
    const existing=new Set(profile.websiteData.websites);
    profile.websiteData.websites.push(...websites.filter(value=>!existing.has(value)));
  }
  if(Array.isArray(parsed.skillsData)&&parsed.skillsData.length){
    const existing=new Set(profile.skillsData);
    profile.skillsData=[...profile.skillsData,...parsed.skillsData.filter(value=>!existing.has(value))].slice(0,25);
  }
  for(const section of ['jobData','educationData','languageData']){
    if(Array.isArray(parsed[section])&&parsed[section].length)profile[section]=structuredClone(parsed[section]);
  }
  profile.jobData.sort((left,right)=>{
    if(left.currentlyWorkHere&&!right.currentlyWorkHere)return -1;
    if(!left.currentlyWorkHere&&right.currentlyWorkHere)return 1;
    if(left.currentlyWorkHere&&right.currentlyWorkHere)return new Date(right.startDate).getTime()-new Date(left.startDate).getTime();
    if(left.endDate&&right.endDate)return new Date(right.endDate).getTime()-new Date(left.endDate).getTime();
    return 0;
  });
  return normalizeProfile(profile);
}
