import {updateActions,recordStatusLabel} from './workflow-actions.js';
import {meetingAlerts} from './meeting-alerts.js';
import {getDockMeetings,DOCK_MEETING_KEYS} from './dock-meetings-data.js';
import {getMeetingWorkflow,saveMeetingWorkflow} from './meeting-workflow-service.js';
import {attentionMeetings,applicationMeeting,workflowMode,nextStep,workflowVersion} from './meeting-workflow-model.js';
import {meetingIsPast,meetingRange,meetingStatus,MEETING_STATUS_LABELS,isApplicationRecord} from './meeting-model.js';
import {localMeetingTime,meetingTimeToISO} from './meeting-timezone.js';
import {requestAttentionFocus} from './meeting-attention.js';

const openDialogs=new WeakMap(),drafts=new Map();
function attentionMessage(h,summary){
  const {total:count,today,needsAction}=summary;
  return [h('span',{className:'workflow-attention-icon','aria-hidden':true},h('svg',{viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.7,strokeLinecap:'round',strokeLinejoin:'round'},h('path',{d:'M21 15a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z M12 7v4 M12 14h.01'}))),h('span',{className:'workflow-attention-copy','aria-live':'polite','aria-atomic':true},h('strong',null,count?`Meetings · ${count}`:'All caught up'),h('small',null,count?`Today ${today} · Needs action ${needsAction}`:'No meetings today or needing action'))];
}
export function updateWorkflowAttention(button,summary){
  const count=summary.total,key=`${count}:${summary.today}:${summary.needsAction}`;if(button.dataset.summary===key)return;button.dataset.summary=key;
  const doc=button.ownerDocument,h=(tag,props,...children)=>{const node=['svg','path'].includes(tag)?doc.createElementNS('http://www.w3.org/2000/svg',tag):doc.createElement(tag);for(const [key,value]of Object.entries(props||{}))node.setAttribute(key==='className'?'class':key.startsWith('stroke')?key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`):key,String(value));for(const child of children)if(child!=null)node.append(child);return node;};
  button.dataset.count=String(count);button.dataset.active=String(count>0);button.setAttribute('aria-label',count?`Show next meeting · ${summary.today} today · ${summary.needsAction} need action`:'No meetings today or needing action');button.replaceChildren(...attentionMessage(h,summary));
}
export function openMeetingWorkflow(host,{browser=globalThis.chrome,recordId,applicationId,review=false,initialAction,onSaved=()=>{}}={}){
  openDialogs.get(host)?.close();
  const doc=host.ownerDocument||host,previous=doc.activeElement;
  const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const dialog=el('dialog',null,'meeting-workflow'),heading=el('header',null,'workflow-heading'),body=el('div',null,'workflow-body'),footer=el('footer',null,'workflow-footer');
  dialog.setAttribute('aria-label',review?'Meetings needing action':'Update application or meeting');
  let state,selected=recordId,queue=[],position=0,action,form,busy=false,pendingPayload=null,notice='',alive=true,baseVersion;
  const button=(label,fn,className='')=>{const node=el('button',label,`workflow-button ${className}`);node.type='button';node.addEventListener('click',fn);return node;};
  const close=()=>{remember();alive=false;dialog.close();dialog.remove();if(openDialogs.get(host)?.dialog===dialog)openDialogs.delete(host);if(previous?.isConnected)previous.focus();};
  const api={dialog,close};openDialogs.set(host,api);
  if(host!==doc.body)dialog.style.setProperty('--workflow-width',`${host.clientWidth||384}px`);
  dialog.append(heading,body,footer);host.append(dialog);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});dialog.showModal();
  const current=()=>state?.records.find(row=>row.id===selected);
  function values(){return Object.fromEntries([...form?.querySelectorAll('[name]')||[]].map(node=>[node.name,node.type==='checkbox'?node.checked:node.value]));}
  function remember(){if(form&&selected&&action)drafts.set(`${selected}:${action}`,values());}
  function field(name,label,value='',type='text',required=false){
    const wrap=el('label',null,'workflow-field'),caption=el('span',label),input=el(type==='textarea'?'textarea':'input');
    if(type!=='textarea')input.type=type;else input.rows=name==='transcript'?7:4;
    input.name=name;input.value=value??'';input.required=required;if(type==='checkbox')input.checked=!!value;
    if(type==='textarea')input.maxLength=name==='transcript'?1048576:131072;
    input.addEventListener('input',()=>{pendingPayload=null;remember();});wrap.append(caption,input);return wrap;
  }
  function render(){
    if(!alive)return;
    form=null;heading.replaceChildren();body.replaceChildren();footer.replaceChildren();
    const title=el('div'),kicker=el('p',review?'DEMO · NEEDS ACTION':'DEMO · UPDATE','workflow-kicker');title.append(kicker,el('h2',current()?.companyName||'Application updates'));heading.append(title,button('×',close,'workflow-close'));heading.lastChild.setAttribute('aria-label','Close update');
    if(!state){body.append(el('p','Loading saved applications…'));return;}
    const record=current();
    if(review&&position>=queue.length){
      const remaining=attentionMeetings(state.records).length;body.append(el('h3',remaining?'Review paused':'All caught up'),el('p',remaining?`${remaining} meetings still need action. Skipped meetings stay on the list.`:'Every meeting in this review is complete.'));
      if(remaining)body.append(button('Review remaining',()=>{queue=attentionMeetings(state.records).map(row=>row.id);position=0;select(queue[0]);},'primary'));footer.append(button('Done',close));return;
    }
    if(!record){renderChooser();return;}
    body.append(el('p',record.jobTitle,'workflow-role'),el('span',recordStatusLabel(record),'update-action-badge'));
    if(review)body.append(el('p',`Meeting ${position+1} of ${queue.length} · ${attentionMeetings(state.records).length} remaining`,'workflow-progress'));
    const range=meetingRange(record.meeting,state.timeZone);
    body.append(el('p',record.meeting?.startsAt?`${record.status==='screen'?'Screening':`Interview · Round ${record.meeting.round||1}`} · ${range.date} · ${range.time}`:'Submitted application','workflow-meta'));
    if(notice)body.append(el('p',notice,'workflow-notice'));
    const tabs=el('nav',null,'workflow-actions');tabs.setAttribute('aria-label','Update action');
    const mode=workflowMode(record),next=nextStep(record),past=meetingIsPast(record.meeting);
    const options=[...mode==='complete'||past?[['complete','Complete meeting']]:[],...!isApplicationRecord(record)&&next?[['advance','Next step']]:[],...record.status!=='applied'&&!isApplicationRecord(record)&&record.meeting?.lifecycle!=='completed'&&!['passed','failed'].includes(record.meeting?.result)?[['reschedule','Reschedule']]:[],...!isApplicationRecord(record)?[['failed',record.status==='applied'?'Rejected':'Failed'],...past?[['offer','Offer']]:[]]:[]];
    for(const [key,label]of options){const tab=button(label,()=>{remember();action=key;notice='';pendingPayload=null;render();});tab.setAttribute('aria-label',label);tab.setAttribute('aria-pressed',String(action===key));if(key==='advance'&&mode==='complete'){tab.disabled=true;tab.title='Complete this meeting first.';}tabs.append(tab);}
    body.append(tabs);
    if(action==='closed'){body.append(el('p','This application has a recorded outcome. Its meeting and conversation history are preserved.'));footer.append(button('Close',close));return;}
    if(action==='decision'){body.append(el('p','Final round complete. Keep this meeting Pending while you wait, or record the confirmed offer or failure.'));footer.append(button('Close',close));return;}
    form=el('form',null,'workflow-form');const draft=drafts.get(`${record.id}:${action}`)||{};
    if(action==='complete'){
      body.append(el('p','Record the transcript and follow-up, then wait for the hiring decision.','workflow-help'));
      const reviewData=record.meeting?.review||{},email=reviewData.followUp||{};
      form.append(el('h3','1 · Transcript'),field('transcript','Transcript',draft.transcript??record.meeting?.transcript,'textarea'),field('transcriptUnavailableReason','If unavailable, explain why',draft.transcriptUnavailableReason??reviewData.transcriptUnavailableReason));
      form.append(el('h3','2 · Follow-up email'),el('p','Add an email you already sent. This saves a history entry.','workflow-help'));
      const choice=el('label',null,'workflow-field');choice.append(el('span','Follow-up'));const selectInput=el('select');selectInput.name='followUpChoice';for(const [value,label]of [['email','Record a sent email'],['not_required','Not required']]){const option=el('option',label);option.value=value;selectInput.append(option);}selectInput.value=draft.followUpChoice||(reviewData.followUpNotRequiredReason?'not_required':'email');choice.append(selectInput);form.append(choice);
      const emailFields=el('div',null,'workflow-email-fields');emailFields.append(field('from','From',draft.from??email.sender?.email??'candidate@example.test','email'),field('to','To',draft.to??email.recipients?.[0]?.email??'','email'),field('subject','Subject',draft.subject??email.subject??`Thank you · ${record.jobTitle}`),field('sentAt','Sent at',draft.sentAt??localMeetingTime(email.sentAt||Date.now(),state.timeZone),'datetime-local'),field('emailBody','Email content',draft.emailBody??email.body,'textarea'),field('confirmedAlreadySent','I already sent this email',draft.confirmedAlreadySent??true,'checkbox'));
      const exemption=field('followUpNotRequiredReason','Why is follow-up not required?',draft.followUpNotRequiredReason??reviewData.followUpNotRequiredReason);
      const sync=()=>{emailFields.hidden=selectInput.value!=='email';exemption.hidden=!emailFields.hidden;for(const input of emailFields.querySelectorAll('input,textarea'))input.disabled=emailFields.hidden;exemption.querySelector('input').disabled=exemption.hidden;remember();};
      form.append(emailFields,exemption);selectInput.addEventListener('change',sync);sync();
    }else if(action==='advance'||action==='reschedule'){
      form.append(el('h3',action==='advance'?next?.label||'Record the decision':'Move this appointment'));
      if(action==='advance'&&record.status!=='applied')form.append(field('confirmPassed','This meeting passed and the next step was confirmed',draft.confirmPassed,'checkbox',true));
      const meeting=action==='reschedule'?record.meeting||{}:{};
      const times=el('div',null,'workflow-time-fields');times.append(field('startsAt','Start',draft.startsAt??localMeetingTime(meeting.startsAt,state.timeZone),'datetime-local',true),field('endsAt','End',draft.endsAt??localMeetingTime(meeting.endsAt,state.timeZone),'datetime-local',true));form.append(times,el('p',`Timezone: ${state.timeZone}`,'workflow-help'));
      const wrap=el('label',null,'workflow-field'),modeSelect=el('select');modeSelect.name='mode';for(const value of ['video','phone']){const option=el('option',value==='video'?'Video':'Phone');option.value=value;modeSelect.append(option);}modeSelect.value=draft.mode||meeting.mode||'video';wrap.append(el('span','Meeting type'),modeSelect);form.append(wrap,field('interviewer','Interviewer',draft.interviewer??meeting.interviewer));
      const link=field('joinUrl','Meeting link',draft.joinUrl??meeting.joinUrl,'url'),phone=field('phone','Phone number',draft.phone??meeting.phone,'tel');form.append(link,phone);
      const sync=()=>{link.hidden=modeSelect.value==='phone';phone.hidden=!link.hidden;link.querySelector('input').required=!link.hidden;phone.querySelector('input').required=!phone.hidden;remember();};modeSelect.addEventListener('change',sync);sync();
      if(action==='reschedule'){form.append(field('rescheduleReason','Rescheduled reason',draft.rescheduleReason,'textarea',true));if(past)form.append(field('didNotOccur','The original meeting did not take place',draft.didNotOccur,'checkbox',true));}
    }else form.append(el('p',action==='offer'?'Record the offer while retaining all previous meetings.':'Record the outcome while retaining all previous meetings.','workflow-help'),field('reason','Decision / reason',draft.reason,'textarea',true));
    form.addEventListener('submit',event=>{event.preventDefault();void save();});body.append(form);
    const error=el('p',null,'workflow-error');error.setAttribute('role','alert');body.append(error);
    if(review){footer.append(button('Previous',()=>navigate(-1)),button('Skip for now',()=>navigate(1)));footer.firstChild.disabled=position===0;}
    else footer.append(button('Back',()=>{remember();selected=null;action=null;notice='';render();}));
    const label=action==='complete'?(review?'Save & next':['passed','failed'].includes(record.meeting?.result)?'Save completion':'Save & mark Pending'):action==='advance'?'Save next step':action==='reschedule'?'Save reschedule':action==='offer'?'Record offer':'Record outcome';
    footer.append(button(label,()=>{if(form.reportValidity())void save();},'primary'));
  }
  function renderChooser(){
    const search=el('input');search.type='search';search.placeholder='Search company or role';search.setAttribute('aria-label','Find an application to update');const list=el('div',null,'workflow-application-list');body.append(el('p','Choose an application to update.','workflow-help'),search,list);
    const draw=()=>{list.replaceChildren();const terms=search.value.toLocaleLowerCase().trim().split(/\s+/);for(const app of state.applications.filter(row=>terms.every(term=>`${row.companyName} ${row.jobTitle}`.toLocaleLowerCase().includes(term)))){const record=applicationMeeting(app.id,state.records);if(!record)continue;const item=button('',()=>{review=false;select(record.id);});item.append(el('strong',app.companyName),el('span',app.jobTitle),el('small',workflowMode(record)==='complete'?'Needs action':nextStep(record)?.label||'View outcome'));list.append(item);}if(!list.childElementCount)list.append(el('p','No matching applications.'));};search.addEventListener('input',draw);draw();footer.append(button('Close',close));
  }
  function select(id){selected=id;action=updateActions(current()).some(item=>item.id===initialAction&&!item.disabled)?initialAction:workflowMode(current());initialAction=null;baseVersion=current()?workflowVersion(current()):null;pendingPayload=null;render();body.scrollTop=0;}
  function navigate(step){remember();position+=step;select(queue[position]);}
  async function save(){
    if(busy)return;remember();const record=current(),draft=values();
    const locked=new Map([...dialog.querySelectorAll('.workflow-body input,.workflow-body select,.workflow-body textarea,.workflow-body button,.workflow-footer button')].map(node=>[node,node.disabled]));
    try{
      const fields={...draft,timeZone:state.timeZone};
      if(action==='complete')fields.email={from:draft.from,to:draft.to,subject:draft.subject,body:draft.emailBody,sentAt:draft.sentAt?meetingTimeToISO(draft.sentAt,state.timeZone):'',confirmedAlreadySent:draft.confirmedAlreadySent};
      if(action==='complete'&&draft.followUpChoice!=='not_required')fields.followUpNotRequiredReason='';
      pendingPayload ||= {recordId:record.id,expectedVersion:baseVersion,mutationId:crypto.randomUUID(),action,fields};
      busy=true;for(const node of locked.keys())node.disabled=true;
      state=await saveMeetingWorkflow(pendingPayload,browser);drafts.delete(`${record.id}:${action}`);pendingPayload=null;form=null;
      await onSaved(state);
      if(!alive)return;
      if(review){if(!attentionMeetings(state.records).some(row=>row.id===record.id))position++;else notice='Outcome saved. Complete the remaining meeting work below.';select(queue[position]);}else{notice=action==='complete'?'Meeting work saved.':'Update saved.';select(record.id);}
    }catch(error){if(alive)body.querySelector('.workflow-error').textContent=error.message;}
    finally{busy=false;for(const [node,disabled]of locked)if(node.isConnected)node.disabled=disabled;}
  }
  render();
  void getMeetingWorkflow(browser).then(next=>{if(!alive)return;state=next;if(review){queue=attentionMeetings(state.records).map(row=>row.id);selected=queue[0];}else if(applicationId)selected=applicationMeeting(applicationId,state.records)?.id;select(selected);}).catch(error=>{if(alive)body.replaceChildren(el('p',error.message,'workflow-error'));});
  return api;
}

export function createWorkflowTools(React){
  const h=React.createElement;
  function MeetingAttentionTools(){
    const [summary,setSummary]=React.useState({total:0,today:0,needsAction:0}),[error,setError]=React.useState('');
    const count=summary.total,alarm=React.useRef(null);
    React.useEffect(()=>{const header=document.querySelector('.workspace-topbar')||document.querySelector('.autofill-web-header'),sync=()=>alarm.current?.style.setProperty('top',`${header&&header.getBoundingClientRect().width>250?Math.max(12,header.getBoundingClientRect().bottom+12):16}px`);sync();if(!header)return;const observer=new ResizeObserver(sync);observer.observe(header);return()=>observer.disconnect();},[]);
    React.useEffect(()=>{let alive=true;const refresh=()=>getDockMeetings(globalThis.chrome).then(state=>{if(alive){setSummary(meetingAlerts(state.records,state.timeZone));setError('');}}).catch(reason=>{if(alive)setError(reason.message);});const change=(changes,area)=>{if(area==='local'&&DOCK_MEETING_KEYS.some(key=>changes[key]))void refresh();};chrome.storage.onChanged.addListener(change);void refresh();const timer=setInterval(refresh,30000);return()=>{alive=false;clearInterval(timer);chrome.storage.onChanged.removeListener(change);};},[]);
    return h('div',{className:'workflow-tools'},h('span',{className:'workflow-attention-slot'},h('button',{ref:alarm,type:'button',className:'workflow-attention','data-active':count>0,'data-count':count,'aria-label':count?`Show next meeting · ${summary.today} today · ${summary.needsAction} need action`:'No meetings today or needing action',onClick:()=>{if(count)requestAttentionFocus();},title:error||"Highlight today’s meetings and meetings needing action"},...attentionMessage(h,summary))));
  }
  return function WorkflowTools({applications=false}){
    return applications?h('div',{className:'workflow-tools'},h('button',{type:'button',className:'web-button',onClick:()=>openMeetingWorkflow(document.body)},'Update application')):h(MeetingAttentionTools);
  };
}
