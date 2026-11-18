import {parseQueueCsv,queueImportMessage} from './queue-import.js';
import {withRequestDeadline} from './request-deadline.js';
import {parseApplicationImport,APPLICATION_TRANSFER_MAX_BYTES} from './application-transfer.js';

export function openQueueImport(host,{browser=globalThis.chrome,onImported=()=>{},type='queue'}={}){
  const applications=type==='applications',noun=applications?'applications':'jobs';
  const doc=host.ownerDocument,el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const dialog=el('dialog',null,'record-delete-dialog queue-import-dialog');dialog.dataset.compact=String(!!host.closest?.('#at-reference-dock'));dialog.setAttribute('aria-labelledby','queue-import-title');
  const header=el('header'),title=el('h2',applications?'Import applications':'Import queue jobs');title.id='queue-import-title';const close=el('button','\u00d7','record-delete-close');close.type='button';close.setAttribute('aria-label','Close import dialog');header.append(title,close);
  const help=el('p',applications?'Choose a five-column job CSV or a full Applications JSON export. Full JSON restores documents, status, and created_at. CSV imports become Applied with the current creation time. Existing records and repeated rows are skipped.':'Choose a CSV with Company, Role, JD, Salary, and Application link columns. Previously added jobs and repeated rows are skipped.','record-delete-help');
  const label=el('label',applications?'CSV or JSON file':'CSV file'),file=el('input');file.type='file';file.accept=applications?'.csv,.json,text/csv,application/json':'.csv,text/csv';file.setAttribute('aria-label',applications?'Applications import file':'Queue CSV file');label.append(file);
  const report=el('p',null,'queue-import-report');report.setAttribute('role','status');const errors=el('ul',null,'record-delete-error');
  const error=el('p',null,'record-delete-error');error.setAttribute('role','alert');error.hidden=true;
  const footer=el('footer'),cancel=el('button','Cancel','web-button'),submit=el('button','Import','web-button record-export-confirm');cancel.type=submit.type='button';submit.disabled=true;footer.append(cancel,submit);
  dialog.append(header,help,label,report,errors,error,footer);host.append(dialog);
  let rows=[],busy=false,reading=false,completed=false,revision=0,mutationId;
  function sync(){submit.disabled=busy||reading||completed||!rows.length;submit.textContent=busy?'Importing...':'Import';file.disabled=busy;cancel.disabled=close.disabled=busy;}
  file.onchange=async()=>{
    const current=++revision;rows=[];completed=false;reading=true;error.hidden=true;errors.replaceChildren();report.textContent='';mutationId=crypto.randomUUID();sync();
    try{
      const selected=file.files[0];if(!selected)return;
      if(selected.size>(applications?APPLICATION_TRANSFER_MAX_BYTES:5*1024*1024))throw Error(applications?'Choose a file no larger than 50 MB.':'Choose a CSV no larger than 5 MB.');
      const parsed=(applications?parseApplicationImport:parseQueueCsv)(await selected.text());if(current!==revision)return;rows=parsed;report.textContent=`${rows.length} ${noun} ready to import.`;cancel.textContent='Cancel';
    }catch(reason){if(current===revision){error.textContent=reason.message;error.hidden=false;}}
    finally{if(current===revision){reading=false;sync();}}
  };
  submit.onclick=async()=>{
    if(submit.disabled)return;busy=true;error.hidden=true;sync();
    try{
      const reply=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_MUTATE',payload:{action:'import',type,rows,mutationId}}),30000);
      if(!reply?.ok)throw Error(reply?.error?.message||'The import could not complete. Try again.');
      const result=reply.result,message=applications?queueImportMessage(result.importReport).replace(' jobs.',' applications.'):queueImportMessage(result.importReport);completed=true;report.textContent=message;errors.replaceChildren(...result.importReport.errors.map(item=>el('li',`Row ${item.row}: ${item.message}`)));cancel.textContent='Done';await onImported(result,message);
    }catch(reason){error.textContent=reason.message;error.hidden=false;}
    finally{busy=false;sync();}
  };
  close.onclick=cancel.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});dialog.addEventListener('close',()=>{revision++;dialog.remove();},{once:true});dialog.showModal();return dialog;
}
