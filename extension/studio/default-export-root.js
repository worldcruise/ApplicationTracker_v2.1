import {createQueueDirectoryStore} from './queue-export-folder.js';
export const DEFAULT_EXPORT_ROOT_KEY='default-export-root:v1';
export async function saveDefaultExportRoot(handle,storage,store=createQueueDirectoryStore()){
  const root={id:crypto.randomUUID(),candidateId:'default',name:handle.name,preference:handle.name,handle};
  await store.remember(root);
  const value={id:root.id,name:root.name};await storage.set({[DEFAULT_EXPORT_ROOT_KEY]:value});return value;
}
export async function defaultExportRoot(candidateId,storage,store=createQueueDirectoryStore()){
  const value=(await storage.get(DEFAULT_EXPORT_ROOT_KEY))[DEFAULT_EXPORT_ROOT_KEY];if(!value?.id||!candidateId)return null;
  const source=await store.root(value.id);if(!source)return null;
  const id=`${source.id}:${candidateId}`,existing=await store.root(id);
  if(existing)return existing;
  const root={...source,id,candidateId};await store.bind(root);return root;
}
