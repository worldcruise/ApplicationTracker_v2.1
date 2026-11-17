import {applicationControl,applicationFormSubmission,applicationReceipt,applicationErrors,submissionAttemptId} from './apply-navigation.js';
import {WORKDAY_ARM,WORKDAY_RESULT} from './workday-submission.js';

// Passive observation only. This module never fills a field or clicks a control.
export function createApplyLifecycle(document,{scan,emit,isTrusted=event=>event.isTrusted}={}){
  const win=document.defaultView;let binding=null,timer=null,poll=null,observer=null,last='',url='',disposed=false,attempt=null;
  const send=event=>{if(binding)void Promise.resolve(emit({...binding,url:document.location.href,...event})).catch(()=>{});};
  const changed=()=>{if(!binding||disposed)return;const result=scan(),signature=JSON.stringify(result);if(signature!==last){last=signature;send({kind:'state',scan:result,receipt:applicationReceipt(document),errors:applicationErrors(document)});}url=document.location.href;};
  const schedule=()=>{if(timer!==null)return;timer=win.setTimeout(()=>{timer=null;changed();},200);};
  const intent=control=>{if(control.kind==='submit'&&(!attempt||Date.now()-attempt.at>1000)){attempt={attemptId:submissionAttemptId(),pageUrl:document.location.href,at:Date.now()};win.dispatchEvent(new win.CustomEvent(WORKDAY_ARM,{detail:JSON.stringify(attempt)}));}send({...control,kind:'intent',action:control.kind,attemptId:control.kind==='submit'?attempt.attemptId:undefined,at:control.kind==='submit'?attempt.at:undefined,receipt:applicationReceipt(document)});};
  const click=event=>{if(!binding||!isTrusted(event)||event.button!==0)return;const node=event.composedPath().find(item=>item?.matches?.('a,button,input[type="submit"],input[type="button"],[role="button"]')),control=node&&applicationControl(node);if(control)intent(control);};
  const submit=event=>{if(!binding||!isTrusted(event))return;intent(applicationFormSubmission(event.target,event.submitter));};
  const invalid=()=>{attempt=null;send({kind:'invalid',errors:'Complete the required fields on the employer page.'});};
  const network=event=>{try{const proof=JSON.parse(event.detail);if(binding&&proof.attemptId===attempt?.attemptId)send({kind:'network',proof});}catch{}};
  win.addEventListener(WORKDAY_RESULT,network);
  document.addEventListener('click',click,true);document.addEventListener('submit',submit,true);document.addEventListener('invalid',invalid,true);document.addEventListener('input',schedule,true);document.addEventListener('change',schedule,true);
  function watch(value){binding=value;last=JSON.stringify(scan());url=document.location.href;if(!observer){observer=new win.MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-invalid','hidden','aria-hidden','class','disabled']});poll=win.setInterval(()=>{if(document.location.href!==url)schedule();},500);win.addEventListener('popstate',schedule);win.addEventListener('hashchange',schedule);}}
  function stop(runId){if(runId&&binding?.runId!==runId)return;binding=null;observer?.disconnect();observer=null;if(timer!==null)win.clearTimeout(timer);if(poll!==null)win.clearInterval(poll);timer=poll=null;win.removeEventListener('popstate',schedule);win.removeEventListener('hashchange',schedule);}
  return {watch,stop,dispose(){disposed=true;stop();document.removeEventListener('click',click,true);document.removeEventListener('submit',submit,true);document.removeEventListener('invalid',invalid,true);document.removeEventListener('input',schedule,true);document.removeEventListener('change',schedule,true);win.removeEventListener(WORKDAY_RESULT,network);}};
}
