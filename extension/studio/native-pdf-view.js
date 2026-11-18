// AI Apply previews PDFs with Chrome's own viewer. Keep that same renderer in
// Studio and document dialogs; never convert an uploaded PDF to HTML or images.
export function pdfBytes(pdf) {
  const bytes=pdf?.bytes instanceof Uint8Array?pdf.bytes:
    typeof pdf?.base64==='string'?Uint8Array.from(atob(pdf.base64),char=>char.charCodeAt(0)):null;
  if(!bytes?.length||bytes.length>16*1024*1024||!new TextDecoder().decode(bytes.subarray(0,1024)).includes('%PDF-'))throw Error('This PDF is empty or invalid. Prepare the document again.');
  return bytes;
}

export function mountNativePDF(host,{url=globalThis.URL,onRendered=()=>{},onFailure=()=>{},title='PDF document'}={}) {
  const doc=host.ownerDocument,frames=new Map();let generation=0,active=null,disposed=false;
  host.classList.add('native-pdf-view');host.setAttribute('aria-label',title);
  function remove(frame){const objectURL=frames.get(frame);frame.remove();if(objectURL){url.revokeObjectURL(objectURL);frames.delete(frame);}}
  function show(pdf){
    const current=++generation;
    for(const frame of frames.keys())if(frame!==active)remove(frame);
    if(disposed||!pdf)return;
    let frame;
    try{
      const objectURL=url.createObjectURL(new Blob([pdfBytes(pdf)],{type:'application/pdf'}));
      frame=doc.createElement('iframe');frames.set(frame,objectURL);frame.className='native-pdf-frame';frame.title=pdf.filename||title;
      frame.loading='eager';
      // Chrome must be able to lay out the first PDF while its viewer starts.
      // Only hide a replacement when a completed document is already visible.
      if(active){frame.classList.add('native-pdf-pending');frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;}
      frame.addEventListener('load',()=>{
        if(disposed||current!==generation||!frames.has(frame))return;
        if(active&&active!==frame)remove(active);active=frame;
        frame.classList.remove('native-pdf-pending');frame.removeAttribute('aria-hidden');frame.tabIndex=0;
        host.dataset.documentRevision=String(pdf.documentRevision??1);host.dataset.pageCount=String(pdf.pageCount??0);host.setAttribute('aria-busy','false');
        onRendered(pdf.documentRevision??1);
      },{once:true});
      frame.addEventListener('error',()=>{if(!disposed&&current===generation){remove(frame);host.setAttribute('aria-busy','false');onFailure(pdf.documentRevision??1,'The PDF preview could not load. Prepare the document again.');}},{once:true});
      host.setAttribute('aria-busy','true');
      // Keep the completed revision visible until its replacement has loaded.
      frame.src=objectURL+'#view=FitH';host.append(frame);
    }catch(error){if(frame)remove(frame);host.setAttribute('aria-busy','false');onFailure(pdf.documentRevision??1,error.message);}
  }
  return {show,dispose(){disposed=true;generation++;for(const frame of frames.keys())remove(frame);active=null;}};
}

export function createNativePDFView(React){
  const h=React.createElement;
  return function NativePDFView({pdf,onRendered=()=>{},onFailure=()=>{}}){
    const root=React.useRef(null),viewer=React.useRef(null),callbacks=React.useRef({onRendered,onFailure});callbacks.current={onRendered,onFailure};
    React.useEffect(()=>{viewer.current=mountNativePDF(root.current,{onRendered:(...args)=>callbacks.current.onRendered(...args),onFailure:(...args)=>callbacks.current.onFailure(...args)});return()=>{viewer.current.dispose();viewer.current=null;};},[]);
    React.useEffect(()=>{viewer.current.show(pdf);},[pdf?.sha256,pdf?.documentRevision,pdf?.base64,pdf?.bytes]);
    return h('section',{ref:root,className:'document-pane native-pdf-view','aria-label':'PDF document','data-document-revision':0,'data-page-count':0});
  };
}
