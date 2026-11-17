import {JOB_RECORD_ICONS} from './job-records-markup.js';

export function mountAIApply(host,{browser=globalThis.chrome,onDashboard,access=''}) {
  const doc=host.ownerDocument,root=doc.createElement('section');root.className='dock-ai-apply';
  const header=doc.createElement('header');header.className='dock-workspace-header';
  header.innerHTML=`<button type="button">${JOB_RECORD_ICONS['chevron-left']}Dashboard</button><h2>Apply to Job</h2>`;
  header.querySelector('button').addEventListener('click',onDashboard);
  const frame=doc.createElement('iframe');frame.title='Apply to Job workspace';frame.className='dock-ai-apply-frame';
  const feedback=doc.createElement('p');feedback.className='dock-ai-apply-status';feedback.setAttribute('role','status');feedback.textContent='Loading Apply to Job…';
  const retry=doc.createElement('button');retry.type='button';retry.textContent='Retry';retry.hidden=true;retry.className='dock-ai-apply-retry';
  root.append(header,feedback,retry,frame);host.append(root);let loading,windowId,ready=false,alive=true,lastShow={};
  const nonce=crypto.randomUUID(),origin=browser.runtime.getURL('').replace(/\/$/,'');
  let resolveReady,loaded=new Promise(resolve=>{resolveReady=resolve;});
  const message=event=>{if(event.source===frame.contentWindow&&event.origin===origin&&event.data?.type==='ai-apply.ready'&&event.data.nonce===nonce){ready=true;feedback.hidden=true;retry.hidden=true;resolveReady();}};
  doc.defaultView.addEventListener('message',message);
  retry.addEventListener('click',()=>{loading=undefined;ready=false;loaded=new Promise(resolve=>{resolveReady=resolve;});void show(lastShow.jobId,lastShow.options).catch(()=>{});});
  async function show(jobId,{panel='apply',restore=false}={}){
    lastShow={jobId,options:{panel,restore}};
    root.hidden=false;
    let timer;
    try{
      if(!loading){feedback.hidden=false;feedback.textContent='Loading Apply to Job…';retry.hidden=true;loading=(async()=>{windowId=(await browser.windows.getCurrent()).id;const url=new URL(browser.runtime.getURL('ai-apply/index.html'));url.searchParams.set('windowId',windowId);url.searchParams.set('nonce',nonce);if(access)url.searchParams.set('access',access);frame.src=url.href;})();}
      await loading;
      await Promise.race([loaded,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Apply to Job could not start. Retry loading the workspace.')),20000);})]);
    }catch(error){if(alive){feedback.textContent=error.message;feedback.hidden=false;retry.hidden=false;}throw error;}finally{clearTimeout(timer);}
    if(alive&&ready)frame.contentWindow?.postMessage({type:'ai-apply.show',nonce,panel,jobId,restore},origin);
  }
  return {root,frame,show,async select(id){await show(id,{panel:'results'});},close(){alive=false;resolveReady();doc.defaultView.removeEventListener('message',message);root.remove();}};
}
