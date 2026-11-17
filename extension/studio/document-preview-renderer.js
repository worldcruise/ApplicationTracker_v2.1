import {applicationPDFFilename} from './document-paths.js';

// Only the service worker may ask the offscreen renderer to render a frozen
// record. This path does not acquire editor ownership or start a download.
export function registerDocumentPreviewRenderer({browser=globalThis.chrome,validate,render}){
  const listener=(message,sender,respond)=>{
    if(sender.id!==browser.runtime.id||sender.tab||sender.url&&sender.url!==browser.runtime.getURL('service-worker.js')||message?.target!=='offscreen'||message.version!==1||message.operation!=='RENDER_DOCUMENT_PREVIEW'||typeof message.requestId!=='string'||message.requestId.length>128)return false;
    Promise.resolve().then(async()=>{
      const {snapshot,letter}=message.payload||{};validate(snapshot);
      if(letter&&(letter.schemaVersion!==1||letter.candidateId!==snapshot.candidate.id||letter.jobId!==snapshot.draftId||!Array.isArray(letter.paragraphs)||!letter.paragraphs.length||!letter.paragraphs.every(value=>typeof value==='string'&&value.trim())||JSON.stringify(letter).length>256*1024))throw Error('The saved cover letter is invalid.');
      const pdf=await render(snapshot,letter);let binary='';for(let offset=0;offset<pdf.bytes.length;offset+=16384)binary+=String.fromCharCode(...pdf.bytes.subarray(offset,offset+16384));
      return {base64:btoa(binary),sha256:pdf.sha256,pageCount:pdf.pageCount,documentRevision:snapshot.documentRevision};
    }).then(result=>respond({version:1,requestId:message.requestId,ok:true,result}),()=>respond({version:1,requestId:message.requestId,ok:false,message:'The saved PDF could not be prepared. Its original document is unchanged.'}));
    return true;
  };
  browser.runtime.onMessage.addListener(listener);return()=>browser.runtime.onMessage.removeListener(listener);
}

export function createRecordPDFRenderer({browser=globalThis.chrome,ensure}){
  return async(record,kind)=>{
    const snapshot=structuredClone(record.resume?.snapshot);
    if(!snapshot)throw Error('No saved resume is available for this record.');
    const raw=record.coverLetterRaw??record.resume?.coverLetterRaw??'';
    if(kind==='letter'&&!raw.trim())throw Error('No saved cover letter is available for this record.');
    const letter=kind==='letter'?{schemaVersion:1,candidateId:snapshot.candidate.id,jobId:snapshot.draftId,paragraphs:raw.split(/\r?\n(?:[ \t]*\r?\n)+/).map(value=>value.trim()).filter(Boolean)}:undefined;
    await ensure();const requestId=crypto.randomUUID(),reply=await browser.runtime.sendMessage({target:'offscreen',version:1,requestId,operation:'RENDER_DOCUMENT_PREVIEW',payload:{snapshot,letter}});
    if(!reply?.ok||reply.requestId!==requestId)throw Error(reply?.message||'The saved PDF could not be prepared.');
    return {...reply.result,filename:applicationPDFFilename(snapshot.candidate.name,kind)};
  };
}
