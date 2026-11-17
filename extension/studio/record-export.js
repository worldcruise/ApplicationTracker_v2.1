import {safeJobUrl} from './reference-dashboard-data.js';

const fields=['Company','Role','Application link','Salary','JD'];
export function recordApplicationLink(record){
  for(const value of [record.url,record.jobLink,record.applicationLink,record.sourceUrl]){
    const url=safeJobUrl(value);if(url)return url;
  }
  return '';
}
function cell(value){
  let text=String(value??'');
  if(/^[\s\uFEFF]*[=+\-@]/u.test(text))text="'"+text;
  return '"'+text.replaceAll('"','""')+'"';
}
export function recordsCsv(records){
  return '\uFEFF'+[fields,...records.map(record=>[record.company,record.role,recordApplicationLink(record),record.salary,record.description])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function downloadRecordsCsv(records,{type='queue',document=globalThis.document,urlApi=globalThis.URL,now=new Date()}={}){
  if(type!=='queue')throw Error('Export is available for Job Queues only.');
  const csv=recordsCsv(records),url=urlApi.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),anchor=document.createElement('a');
  anchor.href=url;anchor.download=`${type==='queue'?'job-queue':'applications'}-${now.toISOString().slice(0,10)}.csv`;anchor.hidden=true;document.body.append(anchor);
  try{anchor.click();}finally{anchor.remove();setTimeout(()=>urlApi.revokeObjectURL(url),1000);}
  return {count:records.length,filename:anchor.download};
}
