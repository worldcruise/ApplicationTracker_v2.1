// Share Resume Studio's handle store; handles remain local to the extension.
const DATABASE='application-tracker-export-files-v1';
export function createQueueDirectoryStore(indexedDB=globalThis.indexedDB){
  async function transact(store,mode,action){
    const db=await new Promise((resolve,reject)=>{const request=indexedDB.open(DATABASE,1);request.onupgradeneeded=()=>{for(const name of ['roots','preferences','receipts'])if(!request.result.objectStoreNames.contains(name))request.result.createObjectStore(name);};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(store,mode),request=action(tx.objectStore(store));tx.oncomplete=()=>resolve(request.result);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Folder selection could not be saved.'));});}finally{db.close();}
  }
  const root=id=>transact('roots','readonly',store=>store.get(id));
  return {root,async matching(candidateId,preference){const id=await transact('preferences','readonly',store=>store.get(JSON.stringify([candidateId,preference])));return id?root(id):null;},
    async bind(record){await transact('roots','readwrite',store=>store.put(record,record.id));await transact('preferences','readwrite',store=>store.put(record.id,JSON.stringify([record.candidateId,record.preference])));},
    async remember(record){await transact('roots','readwrite',store=>store.add(record,record.id));}};
}
