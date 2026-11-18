import {navigateWorkspace} from './workspace-summary.js';
import {openRecordDeletion,openRecordExport} from './record-delete-dialog.js';
import {openQueueImport} from './queue-import-dialog.js';
import {downloadRecordsCsv} from './record-export.js';

export function createApplicationsManage(React){
  const h=React.createElement;
  return function ApplicationsManage(){
    const [error,setError]=React.useState(''),[message,setMessage]=React.useState('');
    const run=(event,action)=>{event.currentTarget.closest('details').open=false;setError('');setMessage('');void Promise.resolve().then(action).catch(reason=>setError(reason.message));};
    return h('div',{className:'application-manage'},h('details',null,h('summary',{className:'web-button'},'Manage'),h('div',{className:'application-manage-menu'},
      h('button',{type:'button',onClick:()=>navigateWorkspace('/?add=1')},'+ Add'),
      h('button',{type:'button',onClick:event=>run(event,()=>openQueueImport(document.body,{type:'applications',onImported:(_result,text)=>setMessage(text)}))},'Import'),
      h('button',{type:'button',onClick:event=>run(event,()=>openRecordExport(document.body,{type:'applications',onExport:(records,options)=>{const result=downloadRecordsCsv(records,options);setMessage(`Exported ${result.count} applications.`);return result;}}))},'Export'),
      h('button',{type:'button',onClick:event=>run(event,()=>openRecordDeletion(document.body,{onDeleted:(_result,count)=>setMessage(`Deleted ${count} applications.`)}))},'Delete'))),
      error&&h('p',{role:'alert'},error),message&&h('p',{role:'status'},message));
  };
}
