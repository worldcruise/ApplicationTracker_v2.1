import {mountJobRecords} from './job-records-view.js';
import {readWorkspaceSummary} from './workspace-summary.js';
import {applicationDocumentRecord,companyInitials,companyHue} from './record-presentation.js';
import {openSubmittedDocument} from './submitted-document-view.js';
import {openMeetingWorkflow} from './meeting-workflow-view.js';
import {JOB_RECORD_ICONS} from './job-records-markup.js';

const applicationStatusIcons={applied:'check-check',screen:'scan-text',interview:'video',offer:'badge-check',rejected:'circle-x',archived:'archive'};

export async function openApplicationRecord(record,command='details'){
  const summary=await readWorkspaceSummary(),saved=applicationDocumentRecord(record,summary.applications);
  if(command==='resume'||command==='letter')return openSubmittedDocument(document.body,saved,command);
  if(command==='update'||command.startsWith('workflow:')){
    return openMeetingWorkflow(document.body,{applicationId:saved.workflowApplicationId||record.applicationId||record.id,initialAction:command.split(':')[1]});
  }
  const dialog=document.createElement('dialog');dialog.className='application-record-dialog web-queue';dialog.setAttribute('aria-label',`Application details for ${saved.company}`);
  const close=document.createElement('button');close.type='button';close.className='web-button application-record-close';close.textContent='Close';close.onclick=()=>dialog.close();
  const host=document.createElement('div');dialog.append(close,host);document.body.append(dialog);
  const view=mountJobRecords(host,{stateKeyPrefix:'web-application-detail:v1',onDashboard:()=>dialog.close()});
  dialog.addEventListener('close',()=>{view.close();dialog.remove();},{once:true});dialog.showModal();
  await view.select(saved.id);
  if(command==='jd')host.querySelector('#jr-view-description')?.click();
  if(command==='update')host.querySelector('[data-command="edit"]')?.click();
  return dialog;
}
export function createApplicationRecordUI(React){
  const h=React.createElement;
  const icon=name=>h('span',{className:'application-action-icon','aria-hidden':true,dangerouslySetInnerHTML:{__html:JOB_RECORD_ICONS[name]||''}});
  function Main({record,field}){
    const [error,setError]=React.useState('');
    return h('div',null,h('button',{type:'button',className:'application-record-main',onClick:()=>openApplicationRecord(record).catch(reason=>setError(reason.message))},
      field!=='role'&&h('span',{className:'company-logo',style:{'--company-hue':companyHue(record.companyName)}},companyInitials(record.companyName)),
      field?h('span',null,field==='role'?record.jobTitle||'Untitled role':record.companyName||'Company not specified'):h('span',null,h('strong',null,record.companyName||'Company not specified'),h('span',null,record.jobTitle||'Untitled role'),h('small',null,record.salary||'Salary not listed'))),error&&h('p',{role:'alert'},error));
  }
  function DocumentButton({record,kind,label}){
    const [error,setError]=React.useState('');
    const available=kind==='jd'?!!record.description:kind==='resume'?!!record.resume?.snapshot:!!(record.coverLetterRaw||record.resume?.coverLetterRaw)?.trim();
    return h('span',null,available?h('button',{type:'button',className:'web-button record-document-button',onClick:()=>openApplicationRecord(record,kind).catch(reason=>setError(reason.message))},icon(kind==='jd'?'scan-text':kind==='resume'?'file-check-2':'file-text'),label):h('span',{className:'record-document-missing','aria-label':`No ${label.toLowerCase()} saved`},'—'),error&&h('span',{role:'alert'},error));
  }
  function Actions({record,onDelete,documents=true}){
    const [error,setError]=React.useState(''),[busy,setBusy]=React.useState(false);
    const run=async action=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(reason){setError(reason.message);}finally{setBusy(false);}};
    return h('div',{className:'application-record-actions'},...[...documents?[['Resume','resume',!!record.resume?.snapshot],['Cover letter','letter',(record.coverLetterEnabled??record.resume?.coverLetterEnabled)!==false&&!!(record.coverLetterRaw||record.resume?.coverLetterRaw)?.trim()]]:[],['Update','update',true]].map(([label,action,available])=>h('button',{key:action,type:'button',className:'web-button','aria-label':label,disabled:busy||!available,onClick:()=>run(()=>openApplicationRecord(record,action))},icon(action==='update'?'square-pen':'file-text'),label)),
      h('button',{type:'button',className:'web-button application-delete',disabled:busy,onClick:()=>run(()=>onDelete(record.id))},icon('trash-2'),'Delete'),error&&h('p',{role:'alert'},error));
  }
  function Status({record}){
    return h('span',{className:'record-status-tag application-status-tag','data-result':record.status,'data-test':'applications-table-status-cell'},icon(applicationStatusIcons[record.status]),({screen:'Screening',archived:'Failed',applied:'Applied',interview:'Interview',offer:'Offer',rejected:'Rejected'})[record.status]||record.status);
  }
  function columns(app,documents=[],view='list'){
    const full=row=>{const saved=applicationDocumentRecord(row,documents);return {...row,resume:saved.resume,coverLetterRaw:saved.coverLetterRaw,coverLetterEnabled:saved.coverLetterEnabled,salary:saved.salary,description:saved.description};};
    return [...view==='cards'?[{id:'job',header:'Company & role',className:'record-main-cell',cell:row=>h(Main,{record:full(row)})}]:[
      {id:'company',header:'Company',className:'record-company-cell',cell:row=>h(Main,{record:full(row),field:'company'})},
      {id:'role',header:'Role',className:'record-role-cell',cell:row=>h(Main,{record:full(row),field:'role'})},
      {id:'salary',header:'Salary',className:'record-salary-cell',cell:row=>full(row).salary||'—'}],
      {id:'status',header:'Status',className:'record-status-cell',cell:row=>h(Status,{record:full(row)})},
      {id:'updated',header:'Updated',className:'record-updated-cell',cell:row=>h('time',{dateTime:Number.isFinite(Date.parse(row.updatedAt||row.appliedAt))?new Date(row.updatedAt||row.appliedAt).toISOString():undefined},view==='cards'?'Updated ':'',Number.isFinite(Date.parse(row.updatedAt||row.appliedAt))?new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(row.updatedAt||row.appliedAt)):'—')},
      ...view==='list'?[['jd','JD'],['resume','Resume'],['letter','Cover letter']].map(([kind,label])=>({id:kind,header:label,className:'record-document-cell',cell:row=>h(DocumentButton,{record:full(row),kind,label})})):[],
      {id:'actions',header:'Actions',className:'record-actions-cell',cell:row=>h(Actions,{record:full(row),onDelete:app.onDelete,documents:view==='cards'})}];
  }
  return {Main,Actions,Status,columns};
}
