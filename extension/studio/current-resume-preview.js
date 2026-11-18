import {openDashboard} from './dock.js';

export async function readCurrentResume(browser=globalThis.chrome){
  const requestId=crypto.randomUUID();
  const response=await browser.runtime.sendMessage({version:1,requestId,operation:'PREVIEW_CURRENT_RESUME',payload:{}});
  if(!response?.ok||response.requestId!==requestId)throw Error(response?.error?.message||'The current resume could not be prepared.');
  return response.result;
}

export function createCurrentResumePreview(React,PDFView,{read=readCurrentResume,browser=globalThis.chrome}={}){
  const h=React.createElement;
  return function CurrentResumePreview({controls}={}){
    const [pdf,setPDF]=React.useState(null),[error,setError]=React.useState(''),[loaded,setLoaded]=React.useState(false),[retry,setRetry]=React.useState(0);
    const settings=JSON.stringify([controls?.draft?.documentTemplate,controls?.draft?.formattingOverrides,controls?.profile?.links]);
    React.useEffect(()=>{
      let alive=true,revision=0;
      async function refresh(){const current=++revision;setLoaded(false);setError('');try{
        const result=await read(browser);
        if(alive&&revision===current){setPDF(result.pdf||null);setLoaded(true);}
      }catch(reason){if(alive&&revision===current){setError(reason.message);setLoaded(true);}}}
      const changed=(changes,area)=>{if(area==='local'&&changes.profile)void refresh();};
      browser.storage.onChanged.addListener(changed);void refresh();
      return()=>{alive=false;revision++;browser.storage.onChanged.removeListener(changed);};
    },[settings,retry]);
    return h('section',{className:'current-resume-preview','aria-label':'Current resume'},
      h('header',{className:'current-resume-toolbar'},
        h('p',{className:'current-resume-label'},'Current resume · ',pdf?.filename||'Resume Studio style'),
        h('button',{type:'button',className:'web-button',onClick:()=>openDashboard('/settings/profile')},'Profile settings')),
      !loaded&&h('p',{role:'status'},'Preparing your current resume…'),
      error?h('div',{className:'current-resume-error'},h('p',{role:'alert'},error),h('button',{type:'button',className:'web-button',onClick:()=>setRetry(value=>value+1)},'Retry preview')):
        pdf?h(PDFView,{pdf,onRendered:()=>{},onFailure:()=>setError('The PDF preview could not load. Retry the preview.')}):
          loaded&&h('p',null,'Upload your resume in Profile to see it here.'));
  };
}
