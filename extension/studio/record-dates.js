export function isoRecordDate(...values){
  for(const value of values){if(!value)continue;const time=Date.parse(value);if(Number.isFinite(time))return new Date(time).toISOString();}
  return null;
}
export function applicationCreatedAt(record){return isoRecordDate(record.createdAt,record.date,record.appliedAt);}
export function deletionRecords(records,{type='applications',period='24hours',from='',to='',query=''}={},now=Date.now()){
  const hours={'24hours':24,'7days':168,'90days':2160}[period];
  const lower=hours?Number(now)-hours*3600000:from?new Date(`${from}T00:00:00`).getTime():-Infinity;
  const upper=hours?Number(now):to?new Date(`${to}T23:59:59.999`).getTime():Infinity;
  const terms=query.trim().toLocaleLowerCase().split(/\s+/);
  return records.filter(record=>{
    const time=Date.parse(type==='queue'?record.createdAt:applicationCreatedAt(record));
    return Number.isFinite(time)&&time>=lower&&time<=upper&&terms.every(term=>`${record.company} ${record.role}`.toLocaleLowerCase().includes(term));
  }).sort((a,b)=>Date.parse(type==='queue'?b.createdAt:applicationCreatedAt(b))-Date.parse(type==='queue'?a.createdAt:applicationCreatedAt(a))||a.id.localeCompare(b.id));
}
