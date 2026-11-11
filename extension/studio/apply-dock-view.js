import { APPLY_DOCK_MARKUP } from './apply-dock-markup.js';
import { studioStorage } from './storage.js';
import { safeJobUrl } from './reference-dashboard-data.js';
import {withRequestDeadline} from './request-deadline.js';

export function mountApplyDock(host,{browser=globalThis.chrome,privateStorage=studioStorage,onDashboard=()=>{},onQueue=()=>{},onApplication=()=>{}}={}) {
  host.innerHTML=APPLY_DOCK_MARKUP;
  const root=host.querySelector('#apply-ready-queue-design'),doc=host.ownerDocument,$=selector=>root.querySelector(selector);
  let alive=true,busy=false,windowId,uiKey,loaded=false,revision=0,imported=null,pdfUrl=null,pdfIdentity='',timer;
  let data={candidate:null,candidates:[],jobs:[],tabs:[],run:null,defaults:{}},ui={jobId:null,tabId:0,tailor:true,tailorPreferenceSet:false,step:'setup',question:null,answers:{},remember:{},options:{}};
  const running=()=>data.run&&!['submitted','cancelled'].includes(data.run.phase);
  const selected=()=>data.jobs.find(job=>job.id===ui.jobId);
  const isPrepared=job=>job?.status==='Ready'&&job.resume?.snapshot&&job.resume.inputRevision===job.inputRevision;
  const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
  function tell(message,error=false){if(!alive)return;$('#aj-feedback').textContent=message;$('#aj-feedback').className=`aj-feedback${error?' error':''}`;$('#aj-feedback').hidden=!message;}
  async function request(operation,payload={}) {
    const response=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation,payload:{windowId,...payload}}));
    if(!response?.ok)throw Error(response?.error?.message||'The dock could not complete this action.');return response.result;
  }
  const persist=()=>loaded?withRequestDeadline(privateStorage.set({[uiKey]:ui}),3000):Promise.resolve();
  function accept(next){data={...next,jobs:next.jobs.filter(isPrepared)};if(!data.jobs.some(job=>job.id===ui.jobId))ui.jobId=data.jobs[0]?.id||null;if(data.run&&running())ui.jobId=data.run.jobId;if(!Object.keys(ui.options).length)ui.options={...data.defaults};}
  async function refresh(){const current=++revision;try{const next=await request('DOCK_APPLY_STATE');if(alive&&current===revision){accept(next);render();}}catch(error){tell(error.message,true);}}
  async function run(action){if(busy)return;busy=true;tell('');render();try{await action();}catch(error){tell(error.message,true);}finally{busy=false;if(alive)render();}}
  function value(selector,next){const node=$(selector);if((root.getRootNode().activeElement||doc.activeElement)!==node&&node.value!==String(next||''))node.value=next||'';}
  const option=(value,text)=>{const node=el('option',text);node.value=String(value);return node;};
  const question=()=>data.run?.questions.find(field=>field.key===ui.question)||data.run?.questions.find(field=>!field.filled)||data.run?.questions[0];
  async function command(action,extra={}){accept(await request('DOCK_APPLY_ACTION',{runId:data.run?.id,action,...extra}));await persist();render();}
  function render(){
    if(!alive)return;
    const job=selected(),isRunning=running(),current=ui.step==='setup'&&!isRunning?null:data.run,q=current?question():null;if(q)ui.question=q.key;
    const step=ui.step==='setup'&&!isRunning?'setup':current?.step||'setup';
    $('#aj-setup').hidden=step!=='setup';$('#aj-autofill').hidden=step!=='autofill';$('#aj-review-panel').hidden=step!=='review';
    root.querySelectorAll('[data-step]').forEach(button=>{if(button.dataset.step===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');button.disabled=busy;});
    const picker=$('#aj-profile');picker.textContent=data.candidate?.name||'Create your profile in Settings';
    const tabPicker=$('#aj-target-tab');tabPicker.replaceChildren(option(0,'Open the selected job in a new tab'),...data.tabs.map(tab=>option(tab.id,`${tab.active?'Current: ':''}${tab.title}`)));tabPicker.value=String(ui.tabId);tabPicker.disabled=busy||!!isRunning;
    $('#aj-selected-job').hidden=!job;$('#aj-no-ready-jobs').hidden=!!job;$('#aj-open-queue').hidden=!!job;
    const index=data.jobs.findIndex(item=>item.id===ui.jobId);$('#aj-job-position').textContent=`${index<0?0:index+1}/${data.jobs.length}`;
    for(const action of ['job-first','job-prev'])$(`[data-action="${action}"]`).disabled=busy||!!isRunning||index<=0;
    for(const action of ['job-next','job-last'])$(`[data-action="${action}"]`).disabled=busy||!!isRunning||index<0||index>=data.jobs.length-1;
    if(job){$('#aj-prepared-company').textContent=job.company;$('#aj-prepared-title').textContent=job.role;const updated=new Date(job.resume?.savedAt||job.updatedAt);$('#aj-prepared-date').textContent=Number.isFinite(updated.getTime())?`Updated ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(updated)}`:'';$('#aj-saved-filename').textContent=isPrepared(job)?`${job.candidateName}_${job.company}.pdf`:'No prepared resume yet';value('#aj-jd',job.description);}
    $('#aj-prepared-status').textContent=isPrepared(job)?'Ready':job?.status||'Queued';$('#aj-prepared-status').classList.toggle('good',!!isPrepared(job));$('#aj-sample-label').hidden=true;
    $('[data-action="preview-prepared-job"]').disabled=busy||!isPrepared(job);
    $('[data-action="job-url"]').disabled=busy||!safeJobUrl(job?.url);$('[data-action="job-details"]').disabled=busy||!job;
    $('#aj-tailor').checked=ui.tailor;$('#aj-tailor').disabled=busy||!!isRunning;$('#aj-upload').hidden=!ui.tailor;
    $('#aj-file').disabled=busy||!!isRunning||!job;
    $('[data-action="import-queue-file"]').disabled=busy||!!isRunning||!isPrepared(job);$('[data-action="manual-upload"]').disabled=busy||!!isRunning||!job;
    $('#aj-import-review').hidden=!imported;$('#aj-import-summary').textContent=imported?.summary||'';$('#aj-update-profile').disabled=busy||!!isRunning||!!imported?.previewOnly;
    $('#aj-import-source').textContent=imported?.previewOnly?'Preview only':'Resume import';
    const name=data.candidate?.name||'current profile';$('#aj-import-person').textContent=name;$('#aj-update-profile').textContent=`Update ${name}’s profile`;
    const importDetails=$('#aj-import-details');if(importDetails){importDetails.replaceChildren();if(imported)for(const [key,title]of [['work','Work history'],['education','Education'],['skills','Skills']]){importDetails.append(el('h4',title));for(const item of imported.changes?.[key]||[])importDetails.append(el('p',item));}}
    root.querySelectorAll('[data-option]').forEach(control=>{control.checked=!!ui.options[control.dataset.option];control.disabled=busy||!!isRunning;});
    $('#aj-start').disabled=busy||!isPrepared(job)||!!job?.isMock||!!isRunning;$('#aj-start-note').textContent=job?.isMock?'Preview queue item. Add a real job to autofill.':!isPrepared(job)?'Prepare and save this job’s resume in Application Workspace.':ui.tailor?`Use a resume to update ${name}’s profile before autofill.`:'Uses the selected prepared resume. No upload required.';
    const status={filling:'Filling application',drafting:'Drafting answer',questions:'Needs review',ready:'Ready for review',paused:'Paused',cancelled:'Cancelled',error:'Needs attention','submission-pending':'Check submission',submitted:'Applied'};
    $('#aj-header-state').textContent=current?status[current.phase]||'Draft':'Draft';$('#aj-header-state').className=`aj-badge${['ready','submitted'].includes(current?.phase)?' good':''}`;$('#aj-run-title').textContent=current?status[current.phase]||'Autofill':'Ready to start';$('#aj-run-description').textContent=current?.message||'';
    const fields=current?.fields||[],filled=fields.filter(field=>field.filled).length,required=fields.filter(field=>field.required),requiredFilled=required.filter(field=>field.filled).length;
    $('#aj-form-page').textContent='Current page';$('#aj-review-count').textContent=`${filled} of ${fields.length} fields`;$('#aj-progress').setAttribute('aria-valuenow',String(filled));$('#aj-progress').setAttribute('aria-valuemax',String(fields.length));$('#aj-progress').setAttribute('aria-valuetext',`${filled} of ${fields.length} detected fields filled`);$('#aj-progress-fill').style.width=`${fields.length?filled/fields.length*100:0}%`;
    $('#aj-resume-state').textContent=current?`Prepared · Version ${current.resumeVersion}`:'Ready in queue';$('#aj-profile-fields-state').textContent=`${requiredFilled} of ${required.length} required filled`;$('#aj-questions-state').textContent=`${(current?.questions||[]).filter(field=>!field.filled).length} remaining`;
    root.querySelectorAll('[data-context-title]').forEach(node=>node.textContent=current?.role||job?.role||'');root.querySelectorAll('[data-context-summary]').forEach(node=>node.textContent=`${current?.candidateName||data.candidate?.name||''} · ${current?.company||job?.company||''}`);
    $('#aj-pause').textContent=current?.phase==='paused'?'Resume':'Pause';$('#aj-pause').disabled=busy||!['filling','drafting','paused'].includes(current?.phase);$('#aj-cancel').disabled=busy||!isRunning||current?.phase==='submission-pending';
    if($('#aj-rescan'))$('#aj-rescan').disabled=busy||!current||['submitted','cancelled','submission-pending','filling','drafting'].includes(current.phase);
    $('#aj-next-page').hidden=!current?.hasNextPage;$('#aj-next-page').disabled=busy||!['questions','ready'].includes(current?.phase);
    $('#aj-question-section').hidden=!q||['cancelled','submitted'].includes(current?.phase);
    const nav=root.querySelector('[data-question]')?.parentElement||$('#aj-question-buttons');
    if(nav){nav.id='aj-question-buttons';nav.replaceChildren(...(current?.questions||[]).map((field,index)=>{const button=el('button',String(index+1),'aj-question-nav');button.type='button';button.dataset.question=field.key;button.setAttribute('aria-label',field.label);button.setAttribute('aria-pressed',String(field.key===q?.key));button.classList.toggle('done',field.filled);return button;}));}
    $('#aj-question-count').textContent=`${(current?.questions||[]).filter(field=>!field.filled).length} remaining`;
    $('#aj-question-title').textContent=q?.label||'';$('#aj-question-type').textContent=q?.filled?'Filled':q?.kind==='ai'?'AI answer':'Needs your input';$('#aj-question-type').className=`aj-badge ${q?.filled?'good':q?.kind==='ai'?'ai':'warn'}`;
    const answer=q?(ui.answers[`${current.id}:${q.key}`]??current.drafts[q.key]??q.answer??''):'';value('#aj-answer',answer);
    const choices=$('#aj-answer-choice'),signature=JSON.stringify(q?.options||[]);if(choices.dataset.options!==signature){choices.replaceChildren(option('','Choose an answer'),...(q?.options||[]).map(item=>option(item.value,item.label)));choices.dataset.options=signature;}if(doc.activeElement!==choices)choices.value=answer;choices.hidden=!q?.options?.length;$('#aj-answer').hidden=!!q?.options?.length;
    $('#aj-answer').disabled=busy||!q||q.type==='file'||!['questions','ready'].includes(current?.phase);choices.disabled=$('#aj-answer').disabled;
    $('#aj-question-hint').textContent=q?.type==='file'?'Upload this document on the employer page, then rescan.':q?.kind==='ai'?'Generate a draft from your synced profile, review it, then approve it.':'Enter the missing fact. Your profile will not be used to guess it.';
    $('#aj-remember-wrap').hidden=q?.kind!=='fact'||!current?.options.saveAnswers;$('#aj-remember-label').textContent=`Remember for ${data.candidate?.name||'this profile'}`;$('#aj-remember').checked=!!(q&&ui.remember[`${current.id}:${q.key}`]);
    $('#aj-draft').hidden=q?.kind!=='ai';$('#aj-draft').disabled=busy||!['questions','ready'].includes(current?.phase);$('#aj-fill-answer').disabled=busy||!q||!answer.trim()||q.type==='file'||!['questions','ready'].includes(current?.phase);
    $('#aj-fill-label').textContent=q?.filled?'Update filled answer':q?.kind==='fact'?'Fill answer':'Approve & fill';
    $('#aj-review').disabled=busy||!fields.length||requiredFilled!==required.length||!['questions','ready'].includes(current?.phase);$('#aj-refill').disabled=busy||!current||!['questions','ready','error'].includes(current.phase);
    for(const [id,text] of [['aj-review-person',current?.candidateName||data.candidate?.name||''],['aj-review-company',current?.company||''],['aj-review-title',current?.role||''],['aj-review-resume',current?`Prepared resume · Version ${current.resumeVersion}`:''],['aj-review-record-setting',current?.options.record?'On':'Off'],['aj-review-save-setting',current?.options.saveAnswers?'On':'Off']])$('#'+id).textContent=text;
    $('#aj-submit').hidden=['submitted','submission-pending'].includes(current?.phase);$('#aj-submit').disabled=busy||current?.phase!=='ready'||!current?.canSubmit;$('#aj-submit').title=current?.canSubmit?'':'Submit on the employer page, then confirm below.';$('#aj-back-fields').hidden=['submitted','submission-pending'].includes(current?.phase);
    $('#aj-confirm-submission').hidden=!current||!(current.phase==='submission-pending'||current.phase==='ready'&&!current.canSubmit);$('#aj-success').hidden=current?.phase!=='submitted';$('#aj-success-text').textContent=current?.message||'';$('#aj-view-record').hidden=!current?.applicationId;
    root.setAttribute('aria-busy',String(busy));
  }
  const targetLabel=el('label',undefined,'aj-target-tab');targetLabel.append(el('span','Application tab','aj-label'));const targetSelect=el('select',undefined,'aj-select');targetSelect.id='aj-target-tab';targetLabel.append(targetSelect);root.querySelector('.aj-option-list').append(targetLabel);
  const choices=el('select',undefined,'aj-select');choices.id='aj-answer-choice';choices.setAttribute('aria-label','Answer to the selected application question');$('#aj-answer').after(choices);
  $('#aj-no-ready-jobs').textContent='No Ready jobs in this profile’s Job Queue. Prepare and save a resume in Job Queues first.';
  function selectJob(index){ui.jobId=data.jobs[index]?.id||null;ui.tabId=data.tabs.find(tab=>tab.url===selected()?.url)?.id||0;imported=null;$('#aj-file').value='';$('#aj-upload-name').hidden=true;$('#aj-prepared-preview').hidden=true;$('#aj-profile-updated').hidden=true;tell('');void persist();render();}
  async function preview(selector){
    const job=selected(),useRun=data.run&&ui.step!=='setup',id=useRun?data.run.jobId:job?.id;if(!id)throw Error('Choose a prepared job first.');
    const container=$(selector);if(!container.hidden){container.hidden=true;return;}
    if(!useRun&&!isPrepared(job))throw Error('Prepare this job’s resume first.');
    const identity=`${id}:${useRun?data.run.id:`${job?.resume?.version}:${job?.resume?.savedAt}`}`;
    if(identity!==pdfIdentity){const result=await request('DOCK_APPLY_PDF',{jobId:id,runId:useRun?data.run.id:undefined});if(!alive)return;if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=URL.createObjectURL(new Blob([Uint8Array.from(atob(result.resumeBase64),char=>char.charCodeAt(0))],{type:'application/pdf'}));pdfIdentity=identity;}
    container.replaceChildren();const iframe=el('iframe',undefined,'aj-pdf');iframe.src=pdfUrl;iframe.title='Selected prepared resume PDF';container.append(iframe);container.hidden=false;
  }
  function click(event){
    const button=event.target.closest('button');if(!button||!root.contains(button))return;
    if(button.dataset.action==='dashboard'){
      onDashboard();void persist().catch(error=>tell(`Dashboard opened. Unsaved setup remains in this dock: ${error.message}`,true));return;
    }
    if(button.disabled)return;
    if(button.dataset.question){ui.question=button.dataset.question;render();void persist();return;}
    const name=button.dataset.action||button.dataset.step;
    if(['job-first','job-prev','job-next','job-last'].includes(name)){const index=data.jobs.findIndex(job=>job.id===ui.jobId);selectJob(name==='job-first'?0:name==='job-last'?data.jobs.length-1:index+(name==='job-prev'?-1:1));return;}
    if(name==='manual-upload'){$('#aj-file').click();return;}
    void run(async()=>{
      if(name==='queue'){await persist();await onQueue();return;}
      if(name==='job-details'){await persist();await onQueue(selected()?.id);return;}
      if(name==='job-url'){const url=safeJobUrl(selected()?.url);if(!url)throw Error('This job has no valid URL.');const tab=await browser.tabs.create({windowId,url,active:true});await refresh();ui.tabId=tab.id;await persist();return;}
      if(name==='preview-prepared-job'||name==='preview-resume'){await preview(name==='preview-resume'?'#aj-resume-preview':'#aj-prepared-preview');return;}
      if(name==='import-queue-file'){imported=null;imported=await request('DOCK_APPLY_IMPORT',{action:'queue-file',jobId:ui.jobId});$('#aj-upload-name').textContent=imported.fileName||'Saved resume PDF';$('#aj-upload-name').hidden=false;return;}
      if(name==='update-profile'){if(!imported)throw Error('Parse a resume first.');accept(await request('DOCK_APPLY_IMPORT',{action:'apply',jobId:ui.jobId,token:imported.token}));imported=null;$('#aj-profile-updated').hidden=false;$('#aj-profile-revision').textContent='Profile updated';tell('Profile updated from the reviewed resume.');return;}
      if(name==='start'||name==='autofill'&&(!data.run||data.run.phase==='cancelled')){accept(await request('DOCK_APPLY_START',{jobId:ui.jobId,tabId:Number(ui.tabId)||undefined,options:ui.options}));ui.step='autofill';await persist();return;}
      if(name==='setup'||name==='edit-details'){if(running())await command('cancel');ui.step='setup';await persist();return;}
      if(name==='view-record'){await onApplication(data.run?.applicationId);return;}
      if(name==='open-application'){await command('open');return;}
      if(name==='pause'){await command(data.run.phase==='paused'?'resume':'pause');return;}
      if(name==='autofill'){ui.step='autofill';await command('back-to-fields');return;}
      if(name==='fill-answer'){const q=question();await command(name,{fieldKey:q.key,answer:ui.answers[`${data.run.id}:${q.key}`]??data.run.drafts[q.key]??q.answer,remember:!!ui.remember[`${data.run.id}:${q.key}`]});return;}
      if(name==='draft'){await command(name,{fieldKey:question()?.key});return;}
      if(['cancel','next-page','rescan','refill','review','submit','back-to-fields','confirm-submission'].includes(name)){await command(name);return;}
    });
  }
  function input(event){
    const node=event.target;
    if(node.id==='aj-target-tab'){ui.tabId=Number(node.value);void persist();return;}
    if(node.id==='aj-tailor'){ui.tailor=node.checked;ui.tailorPreferenceSet=true;render();void persist();return;}
    if(node.dataset.option){ui.options[node.dataset.option]=node.checked;void persist();return;}
    if(['aj-answer','aj-answer-choice','aj-remember'].includes(node.id)){const q=question();if(!q)return;const key=`${data.run.id}:${q.key}`;if(node.id==='aj-remember')ui.remember[key]=node.checked;else ui.answers[key]=node.value;void persist();if(node.id==='aj-answer-choice')value('#aj-answer',node.value);$('#aj-fill-answer').disabled=busy||!String(ui.answers[key]??data.run.drafts[q.key]??q.answer).trim();return;}
    if(node.id==='aj-file'&&node.files?.[0]){const file=node.files[0];void run(async()=>{imported=null;if(file.size>6*1024*1024)throw Error('Choose a resume up to 6 MiB.');const bytes=new Uint8Array(await file.arrayBuffer());let raw='';for(let index=0;index<bytes.length;index+=8192)raw+=String.fromCharCode(...bytes.subarray(index,index+8192));imported=await request('DOCK_APPLY_IMPORT',{action:'parse',jobId:ui.jobId,fileName:file.name,base64:btoa(raw)});$('#aj-upload-name').textContent=file.name;$('#aj-upload-name').hidden=false;});}
  }
  const change=event=>{if(['aj-profile','aj-file','aj-answer-choice'].includes(event.target.id))input(event);};
  root.addEventListener('click',click);root.addEventListener('input',input);root.addEventListener('change',change);
  const changed=changes=>{if(changes[`dock-apply-run:v1:${windowId}`]||changes['dock-job-records:v1'])void refresh();};privateStorage.onChanged.addListener(changed);
  const storageChanged=(changes,area)=>{if(area==='local'&&(changes.profile||changes['ui-theme:v1']))void refresh();};browser.storage.onChanged.addListener(storageChanged);
  const ready=(async()=>{try{windowId=(await browser.windows.getCurrent()).id;uiKey=`dock-apply-ui:v1:${windowId}`;const previous=(await privateStorage.get(uiKey))[uiKey];if(previous){ui={...ui,...previous};if(!previous.tailorPreferenceSet)ui.tailor=true;}accept(await request('DOCK_APPLY_STATE'));if(!alive)return;loaded=true;if(!ui.tabId)ui.tabId=data.tabs.find(tab=>tab.url===selected()?.url)?.id||0;render();timer=setInterval(()=>{if(!root.hidden&&running())void refresh();},1200);}catch(error){loaded=true;render();tell(error.message,true);}})();
  return {root,ready,async show(jobId){await ready;await refresh();if(jobId&&data.jobs.some(job=>job.id===jobId)&&!running()){ui.step='setup';selectJob(data.jobs.findIndex(job=>job.id===jobId));await persist();}},close(){alive=false;revision++;clearInterval(timer);void persist().catch(()=>{});root.removeEventListener('click',click);root.removeEventListener('input',input);root.removeEventListener('change',change);privateStorage.onChanged.removeListener(changed);browser.storage.onChanged.removeListener(storageChanged);if(pdfUrl)URL.revokeObjectURL(pdfUrl);}};
}
