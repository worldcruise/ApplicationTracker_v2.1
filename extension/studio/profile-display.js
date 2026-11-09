import {profileName} from './profile-model.js';
import {studioStorage} from './storage.js';

// Profile aliases remain storage/sync identities. Human-facing labels use the
// candidate's complete name, resolving old application aliases only if unique.
export function createProfileNameLookup(records=[],activeProfile=null) {
  const byId=new Map(),aliases=new Map();
  const add=(id,alias,name)=>{if(!name)return;if(id)byId.set(id,name);if(alias){const names=aliases.get(alias)||new Set();names.add(name);aliases.set(alias,names);}};
  for(const record of records){const profile=record.profile;add(record.id,profile?.profileName||record.profileName,profile?.nameData?profileName(profile):record.name||record.document?.candidate?.name);}
  if(activeProfile?.nameData)add(null,activeProfile.profileName,profileName(activeProfile));
  return value=>{
    if(value?.profile?.nameData)return profileName(value.profile);
    if(value?.nameData)return profileName(value);
    const id=value&&typeof value==='object'?(value.candidateId||value.id):null;
    if(id&&byId.has(id))return byId.get(id);
    const alias=typeof value==='string'?value:value?.profileName;
    const names=aliases.get(alias);if(names?.size===1)return [...names][0];
    return value?.document?.candidate?.name||value?.candidateName||value?.name||alias||'';
  };
}

let lookup=createProfileNameLookup(),revision=0;
const listeners=new Set();
async function refresh(){
  const current=++revision,browser=globalThis.chrome;
  const [records,active]=await Promise.allSettled([studioStorage.get(null),browser?.storage.local.get('profile')]);
  if(current!==revision)return;
  lookup=createProfileNameLookup(records.status==='fulfilled'?Object.entries(records.value).filter(([key])=>key.startsWith('autofill-profile:')).map(([,value])=>value):[],active.status==='fulfilled'?active.value?.profile:null);
  for(const listener of listeners)listener();
}
const privateChanged=changes=>{if(Object.keys(changes).some(key=>key.startsWith('autofill-profile:')))void refresh();};
const changed=(changes,area)=>{if(area==='local'&&changes.profile)void refresh();};
function subscribe(listener){
  if(!listeners.size){studioStorage.onChanged.addListener(privateChanged);globalThis.chrome?.storage.onChanged.addListener(changed);void refresh();}
  listeners.add(listener);listener();
  return()=>{listeners.delete(listener);if(!listeners.size){studioStorage.onChanged.removeListener(privateChanged);globalThis.chrome?.storage.onChanged.removeListener(changed);}};
}
export function useProfileNames(React){
  const [,update]=React.useState(0);
  React.useEffect(()=>subscribe(()=>update(value=>value+1)),[]);
  return value=>lookup(value);
}
export function ProfileFullName({React,profile,className}){
  const name=useProfileNames(React)(profile)||'—';
  return React.createElement('span',{className,title:name},name);
}
