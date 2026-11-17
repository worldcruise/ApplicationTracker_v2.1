import {deletionRecords,applicationCreatedAt} from './record-dates.js';
import {withRequestDeadline} from './request-deadline.js';
import {downloadRecordsCsv} from './record-export.js';

export function openRecordDeletion(host,options={}){return openRecordSelection(host,{...options,mode:'delete'});}
export function openRecordExport(host,options={}){if(options.type&&options.type!=='queue')return Promise.reject(Error('Export is available for Job Queues only.'));return openRecordSelection(host,{...options,type:'queue',mode:'export'});}
async function openRecordSelection(host,{type='applications',mode,browser=globalThis.chrome,onDeleted=()=>{},onExport=downloadRecordsCsv}={}){
  const exporting=mode==='export',verb=exporting?'Export':'Delete';
  const doc=host.ownerDocument||host,el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  async function request(operation,payload={}){
    const reply=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation,payload}));
    if(!reply?.ok)throw Error(reply?.error?.message||'The records could not be loaded.');return reply.result;
  }
  const data=await request('DOCK_RECORDS_STATE'),records=type==='queue'?data.jobs:data.applications;
  const dialog=el('dialog',null,'record-delete-dialog');dialog.dataset.recordOperation=mode;dialog.dataset.compact=String(!!host.closest?.('#at-reference-dock'));dialog.setAttribute('aria-labelledby',`record-${mode}-title`);
  const header=el('header'),title=el('h2',`${verb} ${type==='queue'?'queue jobs':'applications'}`);title.id=`record-${mode}-title`;
  const close=el('button','\u00d7','record-delete-close');close.type='button';close.setAttribute('aria-label',`Close ${exporting?'export':'deletion'} dialog`);header.append(title,close);
  const help=el('p',`Choose records to ${mode}, newest first. Select all shown or Shift-click checkboxes to select a range.${exporting?' CSV includes only Company, Role, JD, Salary, and Application link.':''}`,'record-delete-help');
  const filters=el('div',null,'record-delete-filters');
  function field(label,control){const wrapper=el('label');wrapper.append(el('span',label),control);filters.append(wrapper);return control;}
  const period=field('Period',el('select'));period.setAttribute('aria-label',exporting?'Export period':'Deletion period');
  for(const [value,label]of [['24hours','Last 24 hours'],['7days','Last 7 days'],['90days','Last 90 days'],['custom','Custom dates']]){const option=el('option',label);option.value=value;period.append(option);}
  const from=field('From',el('input')),to=field('To',el('input'));from.type=to.type='date';from.setAttribute('aria-label','Created from');to.setAttribute('aria-label','Created to');
  const search=el('input');search.type='search';search.placeholder='Search company or role';search.setAttribute('aria-label',`Search records to ${mode}`);search.className='record-delete-search';
  const selection=el('div',null,'record-delete-selection'),selectLabel=el('label'),selectAll=el('input'),count=el('span');selectAll.type='checkbox';selectAll.setAttribute('aria-label','Select all shown records');selectLabel.append(selectAll,doc.createTextNode('Select all shown'));selection.append(selectLabel,count);
  const scroll=el('div',null,'record-delete-table-scroll'),table=el('table'),thead=el('thead'),head=el('tr');table.setAttribute('aria-label',`${type==='queue'?'Queue jobs':'Applications'} to ${mode}`);
  for(const label of ['Select','Company','Role','Salary','Status',type==='queue'?'Added':'Submitted']){const th=el('th',label);th.scope='col';head.append(th);}thead.append(head);const tbody=el('tbody');table.append(thead,tbody);scroll.append(table);
  const empty=el('p','No records in this date range. Try another period or custom dates.','record-delete-empty');
  const error=el('p',null,'record-delete-error');error.setAttribute('role','alert');error.hidden=true;
  const footer=el('footer'),cancel=el('button','Cancel','web-button'),remove=el('button',`${verb} selected`,`web-button record-${mode}-confirm`);cancel.type=remove.type='button';footer.append(cancel,remove);
  dialog.append(header,help,filters,search,selection,scroll,empty,error,footer);host.append(dialog);
  let visible=[],selected=new Set(),busy=false,lastIndex=null;
  function sync(){
    from.disabled=to.disabled=busy||period.value!=='custom';
    selectAll.checked=visible.length>0&&selected.size===visible.length;selectAll.indeterminate=selected.size>0&&selected.size<visible.length;selectAll.disabled=!visible.length||busy;
    count.textContent=`${selected.size} selected \u00b7 ${visible.length} shown`;remove.textContent=busy?(exporting?'Exporting...':'Deleting...'):selected.size?`${verb} selected (${selected.size})`:`${verb} selected`;remove.disabled=busy||!selected.size;
    tbody.querySelectorAll('input').forEach(input=>{input.checked=selected.has(input.dataset.id);input.disabled=busy;});
  }
  function render(){
    selected.clear();lastIndex=null;error.hidden=true;tbody.replaceChildren();from.max=to.value;to.min=from.value;
    if(from.value&&to.value&&from.value>to.value){visible=[];error.textContent='From must be on or before To.';error.hidden=false;}
    else visible=deletionRecords(records,{type,period:period.value,from:from.value,to:to.value,query:search.value});
    for(const [index,record]of visible.entries()){
      const row=el('tr'),checkCell=el('td'),check=el('input');check.type='checkbox';check.dataset.id=record.id;check.setAttribute('aria-label',`Select ${record.company}, ${record.role}`);
      check.addEventListener('click',event=>{
        const checked=check.checked;
        if(event.shiftKey&&lastIndex!==null)for(let i=Math.min(lastIndex,index);i<=Math.max(lastIndex,index);i++){if(checked)selected.add(visible[i].id);else selected.delete(visible[i].id);}
        else if(checked)selected.add(record.id);else selected.delete(record.id);
        lastIndex=index;sync();
      });checkCell.append(check);row.append(checkCell);
      const statusLabels={applied:'Applied',screen:'Screening',interview:'Interview',archived:'Failed',offer:'Offer',rejected:'Rejected'};
      for(const value of [record.company,record.role,record.salary||'\u2014',statusLabels[record.status]||record.status])row.append(el('td',value));
      const date=type==='queue'?record.createdAt:applicationCreatedAt(record),cell=el('td'),time=el('time',new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(date)));time.dateTime=date;cell.append(time);row.append(cell);tbody.append(row);
    }
    empty.hidden=!!visible.length;scroll.hidden=!visible.length;sync();
  }
  period.onchange=()=>{from.value=to.value='';render();};from.onchange=to.onchange=()=>{period.value='custom';render();};search.oninput=render;
  selectAll.onchange=()=>{selected=selectAll.checked?new Set(visible.map(record=>record.id)):new Set();sync();};
  close.onclick=cancel.onclick=()=>{if(!busy)dialog.close();};dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  remove.onclick=async()=>{
    if(busy||!selected.size)return;busy=true;error.hidden=true;const targets=visible.filter(record=>selected.has(record.id));
    dialog.querySelectorAll('input,select,button').forEach(control=>control.disabled=true);sync();
    try{
      if(exporting)await onExport(targets,{type,document:doc});
      else{const next=await request('DOCK_RECORDS_MUTATE',{action:'delete-selected',type,records:targets.map(({id,revision})=>({id,revision})),mutationId:crypto.randomUUID()});await onDeleted(next,targets.length);}
      dialog.close();
    }
    catch(reason){error.textContent=reason.message;error.hidden=false;}
    finally{busy=false;dialog.querySelectorAll('input,select,button').forEach(control=>control.disabled=false);sync();}
  };
  dialog.addEventListener('close',()=>dialog.remove(),{once:true});render();dialog.showModal();return dialog;
}
