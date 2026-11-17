import {openSubmittedDocument} from './submitted-document-view.js';
import {recordDocumentText} from './record-presentation.js';

export function createApplicationDocuments(React){
  const h=React.createElement;
  return function ApplicationDocuments({record,browser=globalThis.chrome}){
    const open=(event,kind)=>{const target=event.currentTarget,root=target.closest('dialog')||target.getRootNode().querySelector('#dock-meetings')||target.ownerDocument.body;openSubmittedDocument(root,record,kind,{browser});};
    return h('section',{className:'application-documents','aria-label':'Application documents'},
      h('div',{className:'application-document-actions'},record.resume?.snapshot?h('button',{type:'button',className:'web-button',onClick:event=>open(event,'resume')},'Resume'):h('span',null,'No saved resume'),
        (record.coverLetterRaw||record.resume?.coverLetterRaw)?.trim()&&h('button',{type:'button',className:'web-button',onClick:event=>open(event,'letter')},'Cover letter')),
      h('h3',null,'Job description'),h('div',{className:'record-document-copy'},recordDocumentText(record,'jd')));
  };
}
