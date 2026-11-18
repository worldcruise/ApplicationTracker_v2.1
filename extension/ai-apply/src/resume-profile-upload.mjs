import {createDocumentFileStore} from './document-file-store.mjs';

export async function resumeUploadPayload(file){
  if(!file||!/^.{1,180}\.(pdf|docx)$/i.test(file.name)||file.size<=0||file.size>6*1024*1024)throw Error('Choose a PDF or DOCX resume up to 6 MiB.');
  if(/\.pdf$/i.test(file.name)&&file.size>1024*1024)throw Error('Application Tracker accepts PDF resumes up to 1 MB. Choose a smaller PDF.');
  const bytes=new Uint8Array(await file.arrayBuffer()),signature=new TextDecoder().decode(bytes.subarray(0,1024)),isPdf=/\.pdf$/i.test(file.name);
  if(isPdf?!signature.includes('%PDF-'):!signature.startsWith('PK'))throw Error(`Choose a valid ${isPdf?'PDF':'DOCX'} resume.`);
  let binary='';for(let i=0;i<bytes.length;i+=16384)binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return {base64:btoa(binary),fileName:file.name};
}

export async function profileResumePreview(profile,{browser=chrome,store=createDocumentFileStore(),key='preview/profile-resume.pdf'}={}){
  const resume=profile?.resumeData;if(!resume?.resumeBase64||!/\.pdf$/i.test(resume.fileName))return null;
  await store.put({key,bytes:Uint8Array.from(atob(resume.resumeBase64),value=>value.charCodeAt(0)),state:'preview',kind:'resume',format:'pdf',mime:'application/pdf',filename:resume.fileName});
  return browser.runtime.getURL('preview.html')+'?'+new URLSearchParams({aiFile:key,embedded:'1'});
}

export async function profileStudioResumePreview(profile,{render,store=createDocumentFileStore(),browser=chrome,key='preview/profile-studio-resume.pdf',expectedRevision=null}={}){
  const pdf=await render({profile,expectedRevision});
  if(typeof pdf?.base64!=='string'||!atob(pdf.base64).startsWith('%PDF-'))throw Error('Resume Studio could not prepare the current resume.');
  await store.put({key,bytes:Uint8Array.from(atob(pdf.base64),value=>value.charCodeAt(0)),state:'preview',kind:'resume',format:'pdf',mime:'application/pdf',filename:pdf.filename||'Current resume.pdf'});
  return browser.runtime.getURL('preview.html')+'?'+new URLSearchParams({aiFile:key,embedded:'1'});
}

const sectionKeys={personal:['nameData','contactData','addressData','websiteData'],education:['educationData'],experience:['jobData'],skills:['skillsData','languageData']};
export function changedProfileSections(before,after){return Object.entries(sectionKeys).filter(([,keys])=>keys.some(key=>JSON.stringify(before?.[key]??null)!==JSON.stringify(after?.[key]??null))).map(([section])=>section);}
