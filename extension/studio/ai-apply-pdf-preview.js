import {createDocumentFileStore} from '../ai-apply/src/document-file-store.mjs';

export async function readAIApplyPDF(key,{store=createDocumentFileStore(),digest=bytes=>crypto.subtle.digest('SHA-256',bytes)}={}){
  const file=await store.get(key);
  if(!file||!['complete','preview'].includes(file.state)||file.format!=='pdf'||!(file.bytes instanceof Uint8Array)||!file.bytes.length)throw Error('This PDF is unavailable. Generate or download the document again.');
  let binary='';for(let offset=0;offset<file.bytes.length;offset+=16384)binary+=String.fromCharCode(...file.bytes.subarray(offset,offset+16384));
  const hash=new Uint8Array(await digest(file.bytes));
  return {file,pdf:{base64:btoa(binary),sha256:[...hash].map(byte=>byte.toString(16).padStart(2,'0')).join(''),pageCount:0,documentRevision:1,filename:file.filename}};
}

// Studio and AI Apply share Chrome's PDF viewer and its built-in controls.
export function createAIApplyPDFPreview(React,PDFView,Header){
  const h=React.createElement;
  return function AIApplyPDFPreview(){
    const params=new URLSearchParams(location.search),key=params.get('aiFile'),embedded=params.get('embedded')==='1';
    const [state,setState]=React.useState(null),[error,setError]=React.useState(''),[message,setMessage]=React.useState('');
    const overlayToken=params.get('overlayToken');
    React.useEffect(()=>{if(!embedded||!overlayToken)return;const escape=event=>{if(event.key==='Escape'){event.preventDefault();parent.postMessage({type:'tracker.document-preview.close',token:overlayToken},'*');}};document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);},[embedded,overlayToken]);
    React.useEffect(()=>{let alive=true;document.documentElement.dataset.previewState='loading';readAIApplyPDF(key).then(next=>{if(alive){setState(next);document.title=next.file.filename+' · Resume Studio';}}).catch(reason=>{if(alive){setError(reason.message);document.documentElement.dataset.previewState='error';}});return()=>{alive=false;};},[key]);
    const open=()=>{chrome.downloads.open(state.file.downloadId,()=>{setMessage(chrome.runtime.lastError?'The downloaded file is no longer available.':'Opened the downloaded file.');});};
    const content=h('section',{className:'current-resume-preview ai-apply-pdf-preview','aria-label':'Document PDF preview'},h('header',{className:'current-resume-toolbar'},h('p',{className:'current-resume-label'},state?.file.filename||'PDF preview'),state?.file.state==='complete'&&Number.isInteger(state.file.downloadId)&&h('button',{className:'web-button',type:'button',onClick:open},'Open downloaded file')),error?h('p',{role:'alert'},error):state?h(PDFView,{key:state.pdf.sha256,pdf:state.pdf,onRendered:()=>{document.documentElement.dataset.previewState='ready';},onFailure:()=>{setError('This PDF could not be rendered. Try generating it again.');document.documentElement.dataset.previewState='error';}}):h('p',{role:'status'},'Loading PDF…'),message&&h('p',{role:'status'},message));
    return embedded?content:h('main',{className:'preview-web-page'},h(Header,{active:'/resume-studio'}),content);
  };
}
