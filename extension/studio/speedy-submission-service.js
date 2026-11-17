import {SPEEDY_SUBMISSION_RULES,speedyRuleForUrl} from './speedy-submission-rules.js';
import {applicationUrl,sameApplicationUrl} from '../ai-apply/src/application-identity.mjs';
import {autofillPreferences,AUTOFILL_SETTINGS_KEY} from './autofill-settings.js';
import {validateWorkdaySubmission} from './workday-submission.js';

export function createSpeedySubmissionService({browser,storage,profiles,records,resolveJob=async()=>undefined,onRecorded=async()=>{},now=Date.now}){
  const key=windowId=>`speedy-submission-state:v1:${windowId}`;
  async function read(windowId){return (await storage.get(key(windowId)))[key(windowId)]||{};}
  async function save(windowId,states){await storage.set({[key(windowId)]:states});void browser.runtime.sendMessage({type:'ai-apply.submission-changed',windowId}).catch(()=>{});}
  async function handle(event,sender,windowId){
    const page=applicationUrl(event.url),source=applicationUrl(sender.url);
    if(sender.id!==browser.runtime.id||!Number.isSafeInteger(sender.tab?.id)||sender.tab.windowId!==windowId||!page||page.origin!==source?.origin)throw Error('Invalid submission observer.');
    const rule=SPEEDY_SUBMISSION_RULES.find(rule=>rule.id===event.provider),matched=speedyRuleForUrl(page.href);
    if(!rule||matched?.id!==rule.id&&rule.id!=='phenom')throw Error('This submission does not match its platform adapter.');
    const states=await read(windowId),id=String(sender.tab.id),previous=states[id];
    const raw=event.metadata||{},metadata={};
    for(const [field,max]of [['jobTitle',500],['companyName',300],['jobLink',4096],['companyLink',4096]]){if(typeof raw[field]!=='string'||raw[field].length>max)throw Error('Invalid submission metadata.');metadata[field]=raw[field].trim();}
    if(!applicationUrl(metadata.jobLink)||metadata.companyLink&&!applicationUrl(metadata.companyLink))throw Error('Invalid submission URL.');
    const same=previous?.provider===rule.id&&sameApplicationUrl(previous.metadata.jobLink,metadata.jobLink),state=same?previous:{provider:rule.id,tabId:sender.tab.id,metadata,phase:'form'};
    if(!same||state.phase!=='submitted')state.metadata=same?{...previous.metadata,...Object.fromEntries(Object.entries(metadata).filter(([,value])=>value))}:metadata;
    if(same&&state.phase==='submitted'&&['speedy-intent','speedy-invalid'].includes(event.kind))return{recorded:!!state.applicationId,applicationId:state.applicationId};
    state.url=page.href;state.updatedAt=now();state.documentId=sender.documentId;state.frameId=sender.frameId||0;
    if(event.kind==='speedy-context'){
      state.stage=typeof event.stage==='string'?event.stage.slice(0,150):'Application form';
      if(!['submitting','submitted'].includes(state.phase))state.message=state.stage;
    }else if(event.kind==='speedy-intent'){
      if(event.action==='submit'){
        state.phase='submitting';state.message='Submitting application…';state.attempt={id:typeof event.attemptId==='string'?event.attemptId:null,at:Number.isFinite(event.at)&&Math.abs(now()-event.at)<2000?event.at:now(),fromUrl:page.href,frameId:sender.frameId||0,documentId:sender.documentId};
      }else if(event.action==='next'||event.action==='apply'){state.phase='form';state.message=event.action==='next'?'Moving to the next application step…':'Opening application…';}
    }else if(event.kind==='speedy-invalid'){state.phase='form';state.attempt=null;state.message='Complete the required fields on the employer page.';}
    else if(event.kind==='speedy-confirmed'){
      const proof=event.proof;
      if(proof?.provider!==rule.id||proof.rule!==rule.source)throw Error('Invalid platform submission proof.');
      if(proof.kind==='speedy-departure'){
        const limit=rule.id==='naukri'?8000:rule.departure;
        if(!limit||!state.attempt||state.attempt.id!==event.attemptId||now()-state.attempt.at>limit||state.attempt.documentId&&state.attempt.documentId!==sender.documentId)throw Error('The submission navigation is no longer current.');
      }else if(proof.kind==='speedy-workday'){
        if(rule.id!=='workday'||!state.attempt||!validateWorkdaySubmission(proof,state.attempt,now()))return{recorded:false};
      }else if(!['speedy-receipt','speedy-route'].includes(proof.kind))throw Error('Unknown platform submission proof.');
      const candidate=await profiles.bootstrap(),preferences=autofillPreferences((await browser.storage.local.get(AUTOFILL_SETTINGS_KEY))[AUTOFILL_SETTINGS_KEY]);
      if(candidate&&preferences.record){
        const result=await records.handle('DOCK_RECORDS_TRACK_SUBMISSION',{metadata:state.metadata,candidateId:candidate.id,provider:rule.id,jobId:await resolveJob(state,sender,windowId)},sender);
        state.applicationId=result.selectedId;state.jobId=result.queueId||null;state.message='Application submitted and recorded.';
      }else state.message=candidate?'Application submitted. Recording is switched off.':'Application submitted. Create a profile to record applications.';
      state.phase='submitted';
      await onRecorded({...state,windowId},sender);
    }else throw Error('Unknown submission observer event.');
    states[id]=state;const entries=Object.entries(states).sort((a,b)=>b[1].updatedAt-a[1].updatedAt);await save(windowId,Object.fromEntries(entries.slice(0,100)));
    return{recorded:!!state.applicationId,applicationId:state.applicationId};
  }
  return{handle,async current(windowId,tabs){const states=await read(windowId),tab=tabs.find(tab=>tab.active)||tabs.find(tab=>states[String(tab.id)]);return tab?states[String(tab.id)]||null:null;},async closeWindow(windowId){await storage.remove(key(windowId));}};
}
