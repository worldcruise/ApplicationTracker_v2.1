import {normalizeProfile} from './profile-model.js';
import {applyParsedResumeProfile} from './resume-import-profile.js';
const stable=value=>JSON.stringify(value,(_,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
export const PROFILE_OPERATIONS=new Set(['PROFILE_STATE','PROFILE_SAVE','PROFILE_RESUME_PREVIEW','PROFILE_RESUME_UPLOAD','PROFILE_RESUME_IMPORT']);
export function isProfileSettingsSender(sender,browser=globalThis.chrome){
  try{const url=new URL(sender.url),base=new URL(browser.runtime.getURL('options.html'));return sender.id===browser.runtime.id&&(sender.frameId??0)===0&&url.protocol===base.protocol&&url.host===base.host&&url.pathname===base.pathname&&['#/settings/profile','#/settings/profile/new'].includes(url.hash.split('?')[0]);}catch{return false;}
}
export function mergeResumeProfile(previous,parsed,resume){
  return prepareResumeProfile(previous,parsed,resume).profile;
}
export function prepareResumeProfile(previous,parsed,resume,{cv}={}){
  const result={profile:applyParsedResumeProfile(previous,parsed),warnings:[]};
  result.profile.resumeData={resumeBase64:resume.base64,fileName:resume.fileName,fileSize:Math.floor(resume.base64.replace(/=+$/,'').length*3/4),dateUploaded:new Date().toISOString()};
  if(cv)result.profile.resumeData.cvJsonRaw=JSON.stringify(cv,null,2);
  return result;
}
export function createSingleProfileService({profiles,parseResume}){
  return {async handle(operation,payload){
    const current=await profiles.bootstrap();if(operation==='PROFILE_STATE')return{candidate:current};
    if(operation==='PROFILE_RESUME_PREVIEW'){
      if(payload.expectedRevision!==(current?.revision??null))throw Error('The profile changed. Reload Profile before replacing its resume.');
      const {base64,fileName}=payload;
      if(typeof base64!=='string'||!base64||base64.length>8*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)||typeof fileName!=='string'||!/^.{1,180}\.(pdf|docx)$/i.test(fileName))throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
      const signature=atob(base64).slice(0,1024),isPdf=/\.pdf$/i.test(fileName);
      if(isPdf?!signature.includes('%PDF-'):!signature.startsWith('PK'))throw Error(`Choose a valid ${isPdf?'PDF':'DOCX'} resume.`);
      const result=await parseResume({base64,fileName,includeMetadata:true}),parsed=result?.profile||result;
      const base=payload.profile?normalizeProfile(payload.profile):current?.profile;
      const prepared=prepareResumeProfile(base,parsed,{base64,fileName},{cv:result?.cv});
      return {profile:prepared.profile,expectedProfile:current?.profile??null,revision:current?.revision??null,
        source:{fileName,pageCount:result?.source?.pageCount??null},warnings:[...(Array.isArray(result?.warnings)?result.warnings.filter(item=>typeof item==='string'):[]),...prepared.warnings].slice(0,40)};
    }
    let profile,filename;
    if(operation==='PROFILE_RESUME_UPLOAD'){
      if(payload.expectedRevision!==(current?.revision??null))throw Error('The profile changed. Reload Profile before replacing its resume.');
      const {base64,fileName}=payload;
      if(typeof base64!=='string'||!base64||base64.length>8*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64)||typeof fileName!=='string'||!/^.{1,180}\.(pdf|docx)$/i.test(fileName))throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
      const result=await parseResume({base64,fileName,includeMetadata:true});profile=prepareResumeProfile(current?.profile,result.profile||result,{base64,fileName},{cv:result.cv}).profile;filename=fileName;
    }else if(operation==='PROFILE_SAVE'||operation==='PROFILE_RESUME_IMPORT'){
      const expected=payload.expectedProfile?normalizeProfile(payload.expectedProfile):null;
      if(stable(expected)!==stable(current?.profile??null))throw Error('The profile changed. Reload Profile before saving your edits.');
      profile=normalizeProfile(payload.profile);
      if(current)profile.profileName=current.profile.profileName;
      if(profile.resumeData.resumeBase64&&profile.resumeData.resumeBase64!==current?.profile.resumeData.resumeBase64){
        const resume={base64:profile.resumeData.resumeBase64,fileName:profile.resumeData.fileName};
        if(resume.base64.length>8*1024*1024||!/^.{1,180}\.(pdf|docx)$/i.test(resume.fileName))throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
        if(operation==='PROFILE_RESUME_IMPORT'){
          const isPdf=/\.pdf$/i.test(resume.fileName),signature=/^[A-Za-z0-9+/]*={0,2}$/.test(resume.base64)?atob(resume.base64).slice(0,1024):'';
          if(isPdf?!signature.includes('%PDF-'):!signature.startsWith('PK'))throw Error(`Choose a valid ${isPdf?'PDF':'DOCX'} resume.`);
          filename=resume.fileName;
        }else{const result=await parseResume({...resume,includeMetadata:true});profile=prepareResumeProfile(profile,result.profile||result,resume,{cv:result.cv}).profile;filename=resume.fileName;}
      }
    }else throw Error('Unknown profile request.');
    return{candidate:await profiles.replaceProfile({profile,expectedRevision:current?.revision??null,mutationId:payload.mutationId,filename})};
  }};
}
