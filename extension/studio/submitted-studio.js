import {createUseWorkspaceSummary} from './workspace-summary.js';
import {readRecordPDF} from './record-pdf-preview.js';
import {createNativePDFView} from './native-pdf-view.js';
import {openDashboard} from './dock.js';

export function createSubmittedStudio(React,Header){
  const h=React.createElement,useSummary=createUseWorkspaceSummary(React),PDFView=createNativePDFView(React);
  return function SubmittedStudio(){
    const {state,error}=useSummary(),params=new URLSearchParams(location.search),id=params.get('submitted');
    const record=state?.applications.find(row=>row.id===id),[kind,setKind]=React.useState(params.get('kind')==='letter'?'letter':'resume'),[pdf,setPDF]=React.useState(null),[previewError,setPreviewError]=React.useState('');
    React.useEffect(()=>{let alive=true;setPDF(null);setPreviewError('');if(record){document.documentElement.dataset.previewState='loading';readRecordPDF(record,kind).then(next=>{if(alive)setPDF(next);}).catch(reason=>{if(alive){setPreviewError(reason.message);document.documentElement.dataset.previewState='error';}});}return()=>{alive=false;};},[record?.id,record?.revision,kind]);
    return h('div',{className:'preview-web-page'},h(Header,{active:'/resume-studio'}),
      h('main',{className:'submitted-studio-view'},h('header',{className:'submitted-studio-heading'},h('div',null,h('p',{className:'web-eyebrow'},'Submitted document · Read only'),h('h1',null,record?`${record.company} · ${record.role}`:'Resume Studio')),h('button',{type:'button',className:'web-button',onClick:()=>openDashboard('/')},'Back to Applications')),
        error?h('p',{role:'alert'},error):!state?h('p',null,'Loading document…'):!record?h('p',{role:'alert'},'This application is no longer available.'):h(React.Fragment,null,
          h('nav',{className:'record-view-switcher','aria-label':'Submitted documents'},h('button',{type:'button','aria-pressed':kind==='resume',onClick:()=>setKind('resume')},'Resume'),(record.coverLetterRaw||record.resume?.coverLetterRaw)?.trim()&&h('button',{type:'button','aria-pressed':kind==='letter',onClick:()=>setKind('letter')},'Cover letter')),
          previewError?h('p',{role:'alert'},previewError):h('div',{className:'submitted-studio-pdf','aria-label':kind==='resume'?'Submitted resume':'Submitted cover letter'},pdf?h(PDFView,{pdf,onRendered:()=>{document.documentElement.dataset.previewState='ready';},onFailure:(_revision,message)=>{setPreviewError(message);document.documentElement.dataset.previewState='error';}}):h('p',{role:'status'},'Preparing PDF preview…')))));
  };
}
