import {emptyProfile,normalizeProfile} from './profile-model.js';
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export const PROFILE_OPERATIONS=new Set(['PROFILE_STATE','PROFILE_SAVE','PROFILE_RESUME_UPLOAD']);
export function isProfileSettingsSender(sender,browser=globalThis.chrome){
  try{const url=new URL(sender.url),base=new URL(browser.runtime.getURL('options.html'));return sender.id===browser.runtime.id&&(sender.frameId??0)===0&&url.protocol===base.protocol&&url.host===base.host&&url.pathname===base.pathname&&['#/settings/profile','#/settings/profile/new'].includes(url.hash.split('?')[0]);}catch{return false;}
}
export function mergeResumeProfile(previous,parsed,resume){
  const base=normalizeProfile(previous||emptyProfile()),next={...base};
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw Error('The resume parser returned no profile.');
  for(const key of ['nameData','contactData','addressData','websiteData'])if(parsed[key]&&typeof parsed[key]==='object'&&!Array.isArray(parsed[key]))next[key]={...base[key],...parsed[key]};
  for(const key of ['jobData','educationData','skillsData','languageData'])if(Array.isArray(parsed[key]))next[key]=structuredClone(parsed[key]);
  next.resumeData={resumeBase64:resume.base64,fileName:resume.fileName,fileSize:Math.floor(resume.base64.replace(/=+$/,'').length*3/4),dateUploaded:new Date().toISOString()};
  return normalizeProfile(next);
}
export function createSingleProfileService({profiles,parseResume}){
  return {async handle(operation,payload){
    const current=await profiles.bootstrap();if(operation==='PROFILE_STATE')return{candidate:current};
    let profile,filename;
    if(operation==='PROFILE_RESUME_UPLOAD'){
      if(payload.expectedRevision!==(current?.revision??null))throw Error('The profile changed. Reload Profile before replacing its resume.');
      const {base64,fileName}=payload;
      if(typeof base64!=='string'||!base64||base64.length>8*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)||typeof fileName!=='string'||!/^.{1,180}\.(pdf|docx)$/i.test(fileName))throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
      profile=mergeResumeProfile(current?.profile,await parseResume({base64,fileName}),{base64,fileName});filename=fileName;
    }else if(operation==='PROFILE_SAVE'){
      const expected=payload.expectedProfile?normalizeProfile(payload.expectedProfile):null;
      if(stable(expected)!==stable(current?.profile??null))throw Error('The profile changed. Reload Profile before saving your edits.');
      profile=normalizeProfile(payload.profile);
      if(current)profile.profileName=current.profile.profileName;
      if(profile.resumeData.resumeBase64&&profile.resumeData.resumeBase64!==current?.profile.resumeData.resumeBase64){
        const resume={base64:profile.resumeData.resumeBase64,fileName:profile.resumeData.fileName};
        if(resume.base64.length>8*1024*1024||!/^.{1,180}\.(pdf|docx)$/i.test(resume.fileName))throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
        profile=mergeResumeProfile(profile,await parseResume(resume),resume);filename=resume.fileName;
      }
    }else throw Error('Unknown profile request.');
    return{candidate:await profiles.replaceProfile({profile,expectedRevision:current?.revision??null,mutationId:payload.mutationId,filename})};
  }};
}
