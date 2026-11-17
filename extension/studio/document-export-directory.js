import {studioStorage} from './storage.js';
import {createQueueDirectoryStore} from './queue-export-folder.js';
import {defaultExportRoot,DEFAULT_EXPORT_ROOT_KEY} from './default-export-root.js';
import {documentCompanyFolder,documentExportCompany} from './document-paths.js';

async function exportRoot(candidateId,storage,directories){
  if(!candidateId)return null;
  const profileKey=`autofill-profile:${candidateId}`,saved=await storage.get([DEFAULT_EXPORT_ROOT_KEY,profileKey]),configured=saved[DEFAULT_EXPORT_ROOT_KEY],preference=saved[profileKey]?.studio?.applicationPreferences?.exportDirectory;
  let root=preference?await directories.matching(candidateId,preference):null;
  if(!root&&(!preference||preference===configured?.name))root=await defaultExportRoot(candidateId,storage,directories);
  if(!root&&(configured||preference))throw Error('The selected export folder is unavailable. Choose it again in Settings → Other.');
  return root;
}

// Explicit downloads can renew a saved handle's permission in the visible UI.
// Automatic background exports never open a permission prompt.
export async function requestDocumentExportAccess(candidateId,{storage=studioStorage,directories=createQueueDirectoryStore()}={}){
  const root=await exportRoot(candidateId,storage,directories);if(!root)return;
  if(!root.handle.queryPermission||await root.handle.queryPermission({mode:'readwrite'})==='granted')return;
  let permission;
  try{permission=await root.handle.requestPermission?.({mode:'readwrite'});}catch{throw Error('Allow folder access by choosing your export folder again in Settings → Other, then retry Download.');}
  if(permission!=='granted')throw Error('Folder access was not allowed. Choose your export folder in Settings → Other, then retry Download.');
}

export function createDocumentDirectoryWriter({storage=studioStorage,directories=createQueueDirectoryStore()}={}){
  let pending=Promise.resolve();
  async function write(file,run){
    const root=await exportRoot(run.job?.input?.candidateId,storage,directories);if(!root)return null;
    if(root.handle.queryPermission&&await root.handle.queryPermission({mode:'readwrite'})!=='granted')throw Error('Allow access to your export folder in Settings before exporting.');
    if(typeof file.filename!=='string'||!file.filename||/[\\/\0]/.test(file.filename)||['.','..'].includes(file.filename))throw Error('The document filename is invalid.');
    const companyFolder=documentCompanyFolder(documentExportCompany(run));
    const folder=await root.handle.getDirectoryHandle(companyFolder,{create:true});
    const extension=file.filename.match(/\.[^.]+$/)?.[0]||'',stem=extension?file.filename.slice(0,-extension.length):file.filename;
    let filename=file.format==='pdf'?file.filename:undefined;
    for(let index=0;!filename&&index<1000;index++){
      const name=index?`${stem} (${index})${extension}`:file.filename;
      try{await folder.getFileHandle(name);}catch(error){if(error.name!=='NotFoundError')throw error;filename=name;break;}
    }
    if(!filename)throw Error('The export folder already contains too many files with this name.');
    const handle=await folder.getFileHandle(filename,{create:true}),stream=await handle.createWritable();
    try{await stream.write(new Uint8Array(file.bytes));await stream.close();}catch(error){await Promise.resolve(stream.abort?.()).catch(()=>{});throw error;}
    const actual=await handle.getFile();if(actual.size!==file.bytes.length)throw Error('The exported file could not be verified.');
    return {rootName:root.name,companyFolder,filename,relativePath:`${companyFolder}/${filename}`};
  }
  return (file,run)=>{const task=pending.catch(()=>{}).then(()=>write(file,run));pending=task.catch(()=>{});return task;};
}
