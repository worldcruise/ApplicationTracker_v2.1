const fail=(code,message)=>{throw Object.assign(Error(message),{code});};
export function createQueueResumeExports({tickets,directories,safeCompanyFolder}){
  async function owned(record,id){const ticket=await tickets.status(id);if(ticket.candidateId!==record.candidateId||ticket.draftId!==`queue-resume:${record.id}`)fail('INVALID_EXPORT','This download belongs to another job.');return ticket;}
  return {
    async start(record,{ticketId,bindingId,selection}){
      const store=directories(),root=typeof bindingId==='string'?await store.root(bindingId):null;
      if(!root||root.candidateId!==record.candidateId||!root.preference||!root.name)fail('FOLDER_REQUIRED','Choose an export folder before downloading.');
      if(await root.handle.queryPermission({mode:'readwrite'})!=='granted')fail('FOLDER_PERMISSION','Allow access to the selected folder before downloading.');
      selection.destination={bindingId:root.id,candidateId:root.candidateId,preference:root.preference,rootName:root.name,companyFolder:safeCompanyFolder(selection.snapshot.resume.company)};
      const ticket=await tickets.request(ticketId,{source:'queue-cv-input',jobId:record.id,revision:record.revision,bindingId,cvJsonRaw:selection.cvJsonRaw,coverLetterRaw:selection.coverLetterRaw,coverLetterEnabled:selection.coverLetterEnabled},async()=>({selection,warning:null}));
      if(ticket.draftId!==selection.snapshot.draftId)fail('EXPORT_BUSY','Finish the current download before starting another.');
      void tickets.run(ticket.id).catch(()=>{});return ticket;
    },
    status:owned,
    async retry(record,id,kind){await owned(record,id);const ticket=await tickets.retry(id,kind);void tickets.run(id,kind).catch(()=>{});return ticket;},
  };
}
