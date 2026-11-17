import {speedyRuleForDocument} from './speedy-submission-rules.js';
import {speedySubmissionSnapshot,speedySubmissionControl} from './speedy-submission-adapters.js';
import {applicationControl,applicationFormSubmission,applicationErrors,submissionAttemptId} from './apply-navigation.js';
import {sameApplicationUrl} from '../ai-apply/src/application-identity.mjs';
import {WORKDAY_ARM,WORKDAY_RESULT} from './workday-submission.js';

// SpeedyApply's platform success observers and Uj submit/departure fallback.
// This observer never starts Autofill, presses Next/Submit, or writes records.
export function createSpeedySubmissionTracker(document,{emit,isTrusted=event=>event.isTrusted,now=Date.now}={}){
  const rule=speedyRuleForDocument(document);if(!rule)return{dispose(){}};
  const win=document.defaultView;let alive=true,metadata=null,last='',attempt=null,timer=null,refreshing=false,again=false,applicationSeen=!rule.application;
  const sent=new Set();
  async function send(kind,extra={}){if(!alive)return;try{return await emit({kind,provider:rule.id,url:document.location.href,metadata,...extra});}catch(error){if(/context invalidated/i.test(error.message))dispose();}}
  async function refresh(){
    if(!alive)return;if(refreshing){again=true;return;}refreshing=true;
    try{
      const snapshot=speedySubmissionSnapshot(document);if(!snapshot)return;
      applicationSeen||=!!document.querySelector(rule.application);
      const next=snapshot.metadata;
      if(metadata&&!snapshot.receipt&&!sameApplicationUrl(metadata.jobLink,next.jobLink))metadata=null;
      metadata=Object.fromEntries(['jobTitle','jobLink','companyLink','companyName'].map(key=>[key,metadata?.[key]||next[key]||'']));
      const signature=JSON.stringify([document.location.href,metadata,snapshot.stage]);
      if(signature!==last){last=signature;await send('speedy-context',{stage:snapshot.stage});}
      if(applicationSeen&&snapshot.receipt){const key=JSON.stringify([metadata.jobLink,snapshot.receipt]);if(!sent.has(key)){const result=await send('speedy-confirmed',{proof:snapshot.receipt});if(result?.ok!==false)sent.add(key);}}
    }finally{refreshing=false;if(again){again=false;void refresh();}}
  }
  function schedule(){if(timer!==null)return;timer=win.setTimeout(()=>{timer=null;void refresh();},200);}
  function intent(control){
    if(!control)return;
    if(control.kind==='submit'){
      if(!attempt||now()-attempt.at>1000)attempt={attemptId:submissionAttemptId(),at:now(),pageUrl:document.location.href};
      if(rule.id==='workday')win.dispatchEvent(new win.CustomEvent(WORKDAY_ARM,{detail:JSON.stringify(attempt)}));
    }
    void send('speedy-intent',{action:control.kind,attemptId:attempt?.attemptId,at:attempt?.at});
  }
  function click(event){if(!isTrusted(event)||event.button!==0)return;const control=event.composedPath().filter(node=>node?.nodeType===1).map(node=>speedySubmissionControl(node,rule)||applicationControl(node)).find(Boolean);if(control)intent(control);}
  function submit(event){if(isTrusted(event))intent(speedySubmissionControl(event.submitter||event.target,rule)||applicationFormSubmission(event.target,event.submitter));}
  function invalid(){attempt=null;void send('speedy-invalid',{message:'Complete the required fields on the employer page.'});}
  function departure(){
    const limit=rule.id==='naukri'&&document.querySelector('div.sendMsg')?8000:rule.departure;
    if(limit&&attempt&&now()-attempt.at<=limit&&!applicationErrors(document))void send('speedy-confirmed',{attemptId:attempt.attemptId,proof:{kind:'speedy-departure',provider:rule.id,rule:rule.source,at:attempt.at}});
  }
  function network(event){try{const proof=JSON.parse(event.detail);if(rule.id==='workday'&&attempt?.attemptId===proof.attemptId)void send('speedy-confirmed',{attemptId:attempt.attemptId,proof:{...proof,kind:'speedy-workday',provider:rule.id,rule:rule.source}});}catch{}}
  const observer=new win.MutationObserver(schedule);observer.observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','hidden','aria-hidden','aria-current','disabled']});
  const poll=win.setInterval(()=>void refresh(),1000);
  document.addEventListener('click',click,true);document.addEventListener('submit',submit,true);document.addEventListener('invalid',invalid,true);
  win.addEventListener('beforeunload',departure);win.addEventListener(WORKDAY_RESULT,network);win.addEventListener('popstate',schedule);win.addEventListener('hashchange',schedule);
  void refresh();
  function dispose(){alive=false;observer.disconnect();win.clearInterval(poll);if(timer!==null)win.clearTimeout(timer);document.removeEventListener('click',click,true);document.removeEventListener('submit',submit,true);document.removeEventListener('invalid',invalid,true);win.removeEventListener('beforeunload',departure);win.removeEventListener(WORKDAY_RESULT,network);win.removeEventListener('popstate',schedule);win.removeEventListener('hashchange',schedule);}
  return{dispose,refresh};
}
