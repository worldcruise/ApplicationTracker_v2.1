import {createQueueDirectoryStore} from './queue-export-folder.js';
export const DEFAULT_EXPORT_ROOT_KEY='default-export-root:v1';
export async function saveDefaultExportRoot(handle,storage,store=createQueueDirectoryStore()){
  const root={id:crypto.randomUUID(),candidateId:'default',name:handle.name,preference:handle.name,handle};
  await store.remember(root);
  const value={id:root.id,name:root.name};await storage.set({[DEFAULT_EXPORT_ROOT_KEY]:value});return value;
}
// Display metadata only: browser directory handles do not expose absolute paths.
export async function saveDefaultExportRootPath(id,path,storage){
  const value=(await storage.get(DEFAULT_EXPORT_ROOT_KEY))[DEFAULT_EXPORT_ROOT_KEY];
  if(!value?.id||value.id!==id)throw Error('The selected folder changed. Review it before saving its path.');
  const clean=String(path??'').trim().replace(/^"(.*)"$/,'$1');
  if(clean){
    const absolute=/^[a-z]:[\\/]/i.test(clean)||/^\\\\[^\\]+\\[^\\]+/.test(clean)||clean.startsWith('/');
    if(!absolute||/[\r\n\0]/.test(clean))throw Error('Enter a full folder path, such as D:\\Profiles\\Tom.');
    const leaf=clean.replace(/[\\/]+$/,'').split(/[\\/]/).pop();
    const windows=/^[a-z]:[\\/]/i.test(clean)||clean.startsWith('\\\\');
    if(leaf&&(windows?leaf.toLowerCase()!==value.name.toLowerCase():leaf!==value.name))throw Error(`The path must end with the selected folder name: ${value.name}.`);
  }
  const next={...value,path:clean};await storage.set({[DEFAULT_EXPORT_ROOT_KEY]:next});return next;
}
export async function defaultExportRoot(candidateId,storage,store=createQueueDirectoryStore()){
  const value=(await storage.get(DEFAULT_EXPORT_ROOT_KEY))[DEFAULT_EXPORT_ROOT_KEY];if(!value?.id||!candidateId)return null;
  const source=await store.root(value.id);if(!source)return null;
  const id=`${source.id}:${candidateId}`,existing=await store.root(id);
  if(existing)return existing;
  const root={...source,id,candidateId};await store.bind(root);return root;
}
