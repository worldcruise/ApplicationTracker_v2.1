import {parseQueueCsv,queueJobKey} from './queue-import.js';
import {applicationCreatedAt,isoRecordDate} from './record-dates.js';

export const APPLICATION_TRANSFER_TYPE='application-tracker-applications';
export const APPLICATION_TRANSFER_MAX_BYTES=50*1024*1024;
export const APPLICATION_IMPORT_STAGES=['applied','screen','interview','offer','rejected','archived'];
export function applicationImportKey(record){
  const link=queueJobKey(record.url||record.jobLink);
  return link?'url:'+link:'record:'+JSON.stringify([String(record.company||record.companyName||'').trim().toLowerCase(),String(record.role||record.jobTitle||'').trim().toLowerCase(),applicationCreatedAt({...record,createdAt:record.createdAt||record.created_at})]);
}
export function applicationsJson(records,now=new Date()){
  return JSON.stringify({type:APPLICATION_TRANSFER_TYPE,schemaVersion:1,exportedAt:now.toISOString(),applications:records.map(record=>({
    company:record.company,role:record.role,url:record.url||'',description:record.description||'',salary:record.salary||'',
    status:record.status,created_at:applicationCreatedAt(record),updated_at:record.updatedAt||applicationCreatedAt(record),
    candidateName:record.candidateName||'',notes:record.notes||'',conversationUrl:record.conversationUrl||'',
    resume:record.resume??null,coverLetterRaw:record.coverLetterRaw??record.resume?.coverLetterRaw??'',
    coverLetterEnabled:record.coverLetterEnabled??!!record.resume?.coverLetterEnabled,events:record.events||[],
  }))},null,2)+'\n';
}
export function parseApplicationImport(source){
  if(typeof source!=='string'||new TextEncoder().encode(source).length>APPLICATION_TRANSFER_MAX_BYTES)throw Error('Choose an application file no larger than 50 MB.');
  const text=source.replace(/^\uFEFF/,'').trim();
  if(!text.startsWith('{')&&!text.startsWith('['))return parseQueueCsv(source);
  let data;try{data=JSON.parse(text);}catch{throw Error('The application JSON is incomplete or invalid.');}
  if(data?.type!==APPLICATION_TRANSFER_TYPE||data.schemaVersion!==1||!Array.isArray(data.applications))throw Error('Choose a full Applications export from Application Tracker, or a five-column CSV.');
  if(!data.applications.length||data.applications.length>1000)throw Error('Import between 1 and 1,000 applications at a time.');
  return data.applications.map(row=>row&&typeof row==='object'&&!Array.isArray(row)?{...row,fullApplication:true}:row);
}
export function importedApplicationData(input,{now,validateResume}){
  const fail=message=>{throw Object.assign(Error(message),{code:'INVALID_APPLICATION_IMPORT'});};
  if(!input||typeof input!=='object'||Array.isArray(input))fail('Enter valid application fields.');
  const full=input.fullApplication===true;
  const status=full?input.status||'applied':'applied';
  if(!APPLICATION_IMPORT_STAGES.includes(status))fail('Choose a valid application status.');
  const createdAt=full&&input.created_at!=null?isoRecordDate(input.created_at):now;
  const updatedAt=full&&input.updated_at!=null?isoRecordDate(input.updated_at):createdAt;
  if(!createdAt||!updatedAt)fail('Use valid created_at and updated_at dates.');
  let resume=null;
  if(full&&input.resume!=null){
    const value=input.resume;
    if(typeof value!=='object'||Array.isArray(value)||typeof value.cvJsonRaw!=='string'||new TextEncoder().encode(JSON.stringify(value)).length>3*1024*1024)fail('The saved resume is invalid or exceeds 3 MB.');
    if(!validateResume(value.cvJsonRaw)?.value)fail('The saved resume CV JSON is invalid.');
    const snapshot=value.snapshot;
    if(!snapshot||snapshot.schemaVersion!==2||!snapshot.candidate?.id||typeof snapshot.candidate.name!=='string'||!snapshot.documentTemplate?.id||!snapshot.profile||!Array.isArray(snapshot.bindings?.experience)||!Array.isArray(snapshot.bindings?.education)||!validateResume(JSON.stringify(snapshot.resume))?.value)fail('The saved resume snapshot is incomplete.');
    resume=structuredClone(value);
  }
  const coverLetterRaw=full?(input.coverLetterRaw??resume?.coverLetterRaw??''):'';
  if(typeof coverLetterRaw!=='string'||coverLetterRaw.length>128*1024)fail('Cover letter must be text up to 128 KiB.');
  const events=full?(input.events??[]):[];
  if(!Array.isArray(events)||events.length>5000||events.some(event=>!event||typeof event.label!=='string'||event.label.length>2000||!isoRecordDate(event.at)))fail('The application history is invalid.');
  return {status,createdAt,updatedAt,resume,coverLetterRaw,coverLetterEnabled:full&&(input.coverLetterEnabled??!!resume?.coverLetterEnabled)===true,
    events:events.length?events.map(event=>({label:event.label,at:isoRecordDate(event.at)})):[{label:'Application imported',at:now}]};
}
