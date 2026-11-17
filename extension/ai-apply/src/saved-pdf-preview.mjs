import {createDocumentFileStore} from './document-file-store.mjs';

export async function savedPDFPreview(request,{kind='resume',browser=chrome,store=createDocumentFileStore(),exporter}={}){
  const {exportDocuments}=exporter||await import('./document-export.mjs');
  const result=await exportDocuments({id:'preview',jobId:request.id,phase:'complete',job:request,result:{resume:request.resume,coverLetter:request.coverLetter},documentSettings:{formats:['pdf'],includeCoverLetter:true}},{kinds:[kind]});
  const file=result.files[0];if(!file)throw Error(result.errors[0]?.message||'This document cannot be previewed.');
  const key=`preview/${request.id}/${kind}.pdf`;
  await store.put({...file,key,state:'preview'});
  return browser.runtime.getURL('preview.html')+'?'+new URLSearchParams({aiFile:key,embedded:'1'});
}
