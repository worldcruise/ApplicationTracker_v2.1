// Isolated test adapters can opt into sample fixtures. Installed Chrome does not.
export const sampleDataEnabled=browser=>browser.sampleData?.enabled===true;
const mockId=value=>typeof value==='string'&&/^(?:mock-(?:application|meeting):|sample:)/.test(value);
export function isMockRecord(record){
  if(!record||typeof record!=='object')return false;
  if(record.isMock===true||mockId(record.id)||mockId(record.applicationId)||mockId(record.queueId))return true;
  // CSV imports predate the isMock marker. Match only the URLs our demos used.
  return [record.url,record.jobLink].some(value=>{
    try{const url=new URL(value);return url.hostname==='example.com'&&url.pathname.startsWith('/sample-jobs/')||url.hostname==='example.test'&&url.pathname.startsWith('/mock-meetings/');}catch{return false;}
  });
}
const cleanMap=(value,remove)=>value&&typeof value==='object'&&!Array.isArray(value)?Object.fromEntries(Object.entries(value).filter(([id,record])=>!remove(id,record))):value;
const pending=new WeakMap();
export function clearLocalMockData(browser){
  if(sampleDataEnabled(browser))return Promise.resolve();
  const local=browser.storage.local;if(pending.has(local))return pending.get(local);
  const run=(async()=>{
    const keys=['appliedList','meeting-mock-cards:v1','meeting-application-overrides:v1','meeting-application-documents:v1','meeting-details:v1','meeting-workflow-receipts:v1'];
    const saved=await local.get(keys),changes={};
    for(const key of ['appliedList','meeting-mock-cards:v1'])if(Array.isArray(saved[key])){
      const next=saved[key].filter(record=>!isMockRecord(record));if(next.length!==saved[key].length)changes[key]=next;
    }
    for(const key of ['meeting-application-overrides:v1','meeting-application-documents:v1','meeting-details:v1'])if(saved[key]){
      const next=cleanMap(saved[key],(id,record)=>mockId(id)||isMockRecord(record));if(JSON.stringify(next)!==JSON.stringify(saved[key]))changes[key]=next;
    }
    // This receipt store belongs exclusively to the demo meeting workflow.
    if(saved['meeting-workflow-receipts:v1']&&Object.keys(saved['meeting-workflow-receipts:v1']).length)changes['meeting-workflow-receipts:v1']={};
    if(Object.keys(changes).length)await local.set(changes);
  })().finally(()=>pending.delete(local));pending.set(local,run);return run;
}
export function withoutMockJobs(saved){
  const removed=new Set(saved.jobs.filter(isMockRecord).map(record=>record.id));
  const next={...saved,jobs:saved.jobs.filter(record=>!removed.has(record.id)),
    applications:cleanMap(saved.applications,(id,record)=>mockId(id)||isMockRecord(record)),
    aliases:cleanMap(saved.aliases,(_,id)=>mockId(id)||removed.has(id)),
    receipts:cleanMap(saved.receipts,(_,receipt)=>mockId(receipt?.id)||removed.has(receipt?.id)||isMockRecord(receipt?.deletedRecord))};
  delete next.sampleCandidates;
  return next;
}
