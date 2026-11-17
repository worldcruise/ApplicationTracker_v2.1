import {normalizeProfile,profileToStudio} from './profile-model.js';
import {openDashboard} from './dock.js';

export function createCurrentResumePreview(React,PDFView){
  const h=React.createElement;
  return function CurrentResumePreview(){
    const [profile,setProfile]=React.useState(null),[pdf,setPDF]=React.useState(null),[error,setError]=React.useState(''),[loaded,setLoaded]=React.useState(false);
    React.useEffect(()=>{let alive=true,revision=0;async function refresh(){const current=++revision;try{const saved=await chrome.storage.local.get('profile'),next=saved.profile?normalizeProfile(saved.profile):null,resume=next?.resumeData;let document=null;
      if(resume?.resumeBase64&&/\.pdf$/i.test(resume.fileName)){const bytes=Uint8Array.from(atob(resume.resumeBase64),letter=>letter.charCodeAt(0)),digest=await crypto.subtle.digest('SHA-256',bytes);document={base64:resume.resumeBase64,sha256:[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join(''),pageCount:0,documentRevision:Date.parse(resume.dateUploaded)||1};}
      if(alive&&revision===current){setProfile(next);setPDF(document);setError('');setLoaded(true);}
    }catch(reason){if(alive&&revision===current){setError(reason.message);setLoaded(true);}}}const changed=(changes,area)=>{if(area==='local'&&changes.profile)void refresh();};chrome.storage.onChanged.addListener(changed);void refresh();return()=>{alive=false;revision++;chrome.storage.onChanged.removeListener(changed);};},[]);
    if(pdf&&!error)return h('section',{className:'current-resume-preview','aria-label':'Current uploaded resume'},h('header',{className:'current-resume-toolbar'},h('p',{className:'current-resume-label'},'Current resume · ',profile.resumeData.fileName),h('button',{type:'button',className:'web-button',onClick:()=>openDashboard('/settings/profile')},'Profile settings')),h(PDFView,{key:pdf.sha256,pdf,onRendered:()=>{},onFailure:()=>setError('The PDF preview could not load. Your saved profile is shown below.')}));
    const document=profile&&profileToStudio(profile,'current');
    return h('section',{className:'current-resume-preview current-resume-paper','aria-label':'Current resume'},h('header',null,h('h2',null,'Current resume'),h('button',{type:'button',className:'web-button',onClick:()=>openDashboard('/settings/profile')},'Update profile')),error&&h('p',{role:'alert'},error),!loaded?h('p',null,'Loading your current resume…'):!document?h('p',null,'Upload your resume in Profile to see it here.'):h('article',null,h('h1',null,document.candidate.name),h('p',null,[document.personalDetails.email,document.personalDetails.phone].filter(Boolean).join(' · ')),profile.resumeData.fileName&&h('p',null,profile.resumeData.fileName),h('h3',null,'Experience'),...document.companies.map((job,index)=>h('section',{key:index},h('h4',null,`${job.title} · ${job.name}`),h('p',null,job.shortDetail))),h('h3',null,'Skills'),h('p',null,profile.skillsData.join(', ')),h('h3',null,'Education'),...document.professionalProfile.education.map((item,index)=>h('p',{key:index},`${item.degree} · ${item.school}`))));
  };
}
