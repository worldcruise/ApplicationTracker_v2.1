import {emptyProfile} from './profile-model.js';
export async function profileRequest(operation,payload={}){
  const requestId=crypto.randomUUID();let response;
  try{response=await chrome.runtime.sendMessage({version:1,requestId,operation,payload});}catch{throw Error('The profile service disconnected. Reload the extension and this page, then try again.');}
  if(!response?.ok||response.requestId!==requestId)throw Error(response?.error?.message||'The profile request could not complete.');return response.result;
}
export function saveSingleProfile(profile,expectedProfile){return profileRequest('PROFILE_SAVE',{profile,expectedProfile,mutationId:crypto.randomUUID()});}
export function createProfileResumePage(React){
  const h=React.createElement;
  return function ProfileResumePage({profile}){
    const [candidate,setCandidate]=React.useState(null),[busy,setBusy]=React.useState(false),[message,setMessage]=React.useState(''),[error,setError]=React.useState('');
    const input=React.useRef(null),alive=React.useRef(true),writing=React.useRef(false);
    React.useEffect(()=>{alive.current=true;const refresh=()=>profileRequest('PROFILE_STATE').then(result=>{if(alive.current&&!writing.current)setCandidate(result.candidate);}).catch(cause=>{if(alive.current)setError(cause.message);});void refresh();const changed=(changes,area)=>{if(area==='local'&&changes.profile)void refresh();};chrome.storage.onChanged.addListener(changed);return()=>{alive.current=false;chrome.storage.onChanged.removeListener(changed);};},[]);
    async function run(action){if(writing.current)return;writing.current=true;setBusy(true);setMessage('');setError('');try{const result=await action();if(alive.current){setCandidate(result.candidate);setMessage('Profile updated. Your resume and profile details are saved.');}}catch(cause){if(alive.current)setError(cause.message);}finally{writing.current=false;if(alive.current)setBusy(false);}}
    function upload(file){if(!file)return;void run(async()=>{
      if(!/\.(pdf|docx)$/i.test(file.name)||file.size>6*1024*1024)throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
      const bytes=new Uint8Array(await file.arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=32768)text+=String.fromCharCode(...bytes.subarray(i,i+32768));
      return profileRequest('PROFILE_RESUME_UPLOAD',{base64:btoa(text),fileName:file.name,expectedRevision:candidate?.revision??null,mutationId:crypto.randomUUID()});
    });}
    const resume=profile?.resumeData||candidate?.profile.resumeData;
    return h('section',{className:'profile-resume-card','aria-labelledby':'profile-resume-heading','aria-busy':busy},
      h('div',null,h('h2',{id:'profile-resume-heading'},profile?'Update profile':'Create your profile'),h('p',null,'Upload your resume to fill your profile. Replacing the resume updates this same profile.')),
      resume?.fileName&&h('p',{className:'profile-resume-file'},resume.fileName),
      h('input',{ref:input,type:'file',accept:'.pdf,.docx',hidden:true,'aria-label':'Upload or replace resume',onChange:event=>{upload(event.target.files?.[0]);event.target.value='';}}),
      h('div',{className:'profile-resume-actions'},h('button',{type:'button',className:'web-button web-button-primary',disabled:busy||!!profile&&!candidate,onClick:()=>input.current.click()},busy?'Updating profile…':resume?.fileName?'Replace resume':'Upload resume'),
        !profile&&h('button',{type:'button',className:'web-button',disabled:busy,onClick:()=>void run(()=>saveSingleProfile(emptyProfile(),null))},'Create profile manually')),
      error&&h('p',{className:'web-message web-error',role:'alert'},error),message&&h('p',{className:'web-message',role:'status'},message));
  };
}
