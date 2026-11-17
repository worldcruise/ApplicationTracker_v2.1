import {withRequestDeadline} from './request-deadline.js';

export async function readRecordPDF(record,kind,{browser=globalThis.chrome}={}){
  const requestId=crypto.randomUUID(),reply=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId,operation:'DOCK_RECORDS_DOCUMENT_PREVIEW',payload:{id:record.id,type:record.type,expectedRevision:record.revision,kind:kind==='letter'?'letter':'resume'}}),30000,'The PDF preview took too long. Close it and try again.');
  if(!reply?.ok||reply.requestId&&reply.requestId!==requestId)throw Error(reply?.error?.message||'The saved document could not be previewed.');
  return reply.result;
}
