import {createQueueDirectoryStore} from './queue-export-folder.js';
const fail=message=>{throw Object.assign(Error(message),{code:'SAVED_FILE_UNAVAILABLE'});};
export async function readSavedQueueFile(job,store=createQueueDirectoryStore()){
  const reference=job.resume?.export;if(!reference)return null;
  if(reference.state!=='complete'||!reference.fileName)fail('The resume export is not complete. Finish Save & Export before importing from Queue.');
  if(!/^[^/\\]+\.pdf$/i.test(reference.fileName)||!reference.companyFolder||/[\/\\]/.test(reference.companyFolder)||['.','..'].includes(reference.companyFolder))fail('The saved resume file reference is invalid. Save & Export the resume again.');
  const root=await store.root(reference.bindingId);
  if(!root||root.candidateId!==job.candidateId)fail('Choose the export folder and Save & Export this resume again.');
  if(await root.handle.queryPermission({mode:'readwrite'})!=='granted')fail('Allow access to the export folder before importing the saved resume.');
  let file;try{const directory=await root.handle.getDirectoryHandle(reference.companyFolder);file=await(await directory.getFileHandle(reference.fileName)).getFile();}catch{fail('The saved resume file could not be found. Save & Export the resume again.');}
  if(file.size>6*1024*1024)fail('The saved resume PDF must be at most 6 MiB.');
  const bytes=new Uint8Array(await file.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return {resumeBase64:btoa(binary),fileName:reference.fileName};
}
