import {normalizeProfile,profileToStudio} from './profile-model.js';
import {profileResumeCV} from './profile-resume-json.js';

export function createProfileResumeRenderer({makeSnapshot,renderRecordPDF}){
  return async({profile,documentStyle},current)=>{
    const source=normalizeProfile(profile||current?.profile),id=current?.id||'profile-resume-preview';
    const document=profileToStudio(source,id,current?.studio||{});
    const candidate={...current,id,revision:current?.revision||1,profile:source,document};
    const preferences=current?.document?.applicationPreferences||document.applicationPreferences||{},style=documentStyle||preferences.defaultDocumentStyle;
    const cv=profileResumeCV(source);
    const draft={id:'current-resume:'+id,candidateId:id,revision:1,jobInputRaw:'',jobInputKind:'job_description',sourceUrl:'',
      cvJsonRaw:JSON.stringify(cv),coverLetterRaw:'',coverLetterEnabled:false,
      documentTemplate:style?.documentTemplate||{id:preferences.preferredDocumentTemplateId||'rendercv-classic',version:1},
      formattingOverrides:style?.formattingOverrides||{},bindings:{experience:[],education:[]}};
    const {snapshot}=makeSnapshot(candidate,draft,'profile-resume-preview',1);
    return renderRecordPDF({resume:{snapshot}},'resume');
  };
}
