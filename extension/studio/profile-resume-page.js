import {normalizeProfile} from './profile-model.js';
import {mountAutofillProfile} from '../ai-apply/src/profile-editor.mjs';
import {profileStudioResumePreview} from '../ai-apply/src/resume-profile-upload.mjs';

export const profileEditorValue=profile=>profile?normalizeProfile(profile):null;
export async function profileRequest(operation,payload={}){
  const requestId=crypto.randomUUID();let response;
  try{response=await chrome.runtime.sendMessage({version:1,requestId,operation,payload,settingsRoute:globalThis.location?.hash.split('?')[0]});}catch{throw Error('The profile service disconnected. Reload the extension and this page, then try again.');}
  if(!response?.ok||response.requestId!==requestId)throw Error(response?.error?.message||'The profile request could not complete.');return response.result;
}
export function saveSingleProfile(profile,expectedProfile){return profileRequest('PROFILE_SAVE',{profile,expectedProfile,mutationId:crypto.randomUUID()});}

export function createProfileResumePage(React){
  const h=React.createElement;
  return function ProfileResumePage({initialSection}){
    const host=React.useRef(null);
    React.useEffect(()=>{
      const section={name:'personal',contact:'personal',address:'personal',website:'personal',job:'experience',education:'education',skills:'skills',employment:'employment'}[initialSection]||'resume';
      const editor=mountAutofillProfile(host.current,{mode:'page',initialSection:section,
        read:()=>profileRequest('PROFILE_STATE'),
        preview:payload=>profileRequest('PROFILE_RESUME_PREVIEW',payload),
        styledPreview:(profile,options)=>profileStudioResumePreview(profile,{...options,render:payload=>profileRequest('PROFILE_RESUME_RENDER',payload)}),
        save:payload=>profileRequest(payload.importResume?'PROFILE_RESUME_IMPORT':'PROFILE_SAVE',payload)});
      return()=>editor.dispose();
    },[initialSection]);
    return h('section',{className:'profile-resume-card profile-workspace','aria-label':'Create or update profile'},h('div',{ref:host}));
  };
}
