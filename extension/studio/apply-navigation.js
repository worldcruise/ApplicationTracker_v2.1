const text=value=>String(value||'').replace(/\s+/g,' ').trim();
export function submissionAttemptId(random=globalThis.crypto){
  if(typeof random.randomUUID==='function')return random.randomUUID();
  return [...random.getRandomValues(new Uint8Array(16))].map(value=>value.toString(16).padStart(2,'0')).join('');
}
export function visibleApplicationControl(node){
  if(!node||node.disabled||node.matches?.(':disabled')||node.closest('[hidden],[inert],[aria-hidden="true"],[aria-disabled="true"]'))return false;
  for(let item=node;item;item=item.parentElement){const style=node.ownerDocument.defaultView.getComputedStyle(item);if(style.display==='none'||style.visibility==='hidden')return false;}return true;
}
export function applicationControl(node){
  if(!visibleApplicationControl(node))return null;
  const doc=node.ownerDocument,labels=[node.getAttribute('aria-label'),node.getAttribute('title'),node.getAttribute('data-label'),...(node.getAttribute('aria-labelledby')||'').split(' ').map(id=>doc.getElementById(id)?.textContent),node.value,node.textContent].map(text).filter(Boolean);
  const label=labels.find(value=>/\b(next|continue|proceed|review|submit|apply|send application|finish application)\b/i.test(value))||labels[0]||'';
  const identity=[node.id,node.name,node.getAttribute('data-testid'),node.getAttribute('data-test'),node.getAttribute('data-automation-id')].filter(Boolean).join(' ');
  const normalized=label.replace(/[\u2190-\u21ff\u00bb\u203a><]/g,'').trim();let kind;
  if(/^(?:back|previous|cancel|save draft|save for later|withdraw|upload|add another)\b/i.test(normalized)||/\b(back|previous|cancel|withdraw)\b/i.test(identity))return null;
  if(/^(?:next(?: step| page)?|continue(?: to .+)?|proceed|save (?:and|&) continue|review(?: application)?)$/i.test(normalized)||/application-next-step|btnNext|(?:^|[-_])(?:next|continue)(?:[-_]|$)/i.test(identity))kind='next';
  if(/^(?:submit(?: (?:application|profile))?|send application|finish (?:application|questionnaire)|complete this application step)$/i.test(normalized)||/application-submit|btnSubmit|submit_app|submitApplication/i.test(identity))kind='submit';
  if(/pageFooterNextButton|bottom-navigation-next-button/.test(identity))kind=/submit/i.test(normalized)?'submit':'next';
  if(/^apply(?: now| directly| to (?:this |the )?(?:job|position|role)| for (?:this |the )?(?:job|position|role))?$/i.test(normalized))kind=node.type==='submit'||node.closest('form')&&!node.closest('a[href]')?'submit':'apply';
  if(/^(?:jobs|apply)\.workable\.com$/.test(doc.location.hostname)&&/^apply(?: now| for (?:this |the )?(?:job|position|role)| to (?:this |the )?(?:job|position|role))?$/i.test(normalized)){
    const form=node.form||node.closest('form');
    // Workable reuses Apply controls for entering the application flow. A
    // listing/search form is not the candidate's final submission form.
    const candidateForm=form?.querySelector('input[type="email"],input[type="file"],input[autocomplete="given-name"],input[name="firstname"],input[name="first_name"],textarea');
    kind=doc.location.hostname==='jobs.workable.com'||!candidateForm?'apply':'submit';
  }
  if(kind==='submit'&&/icims\.com$/.test(doc.location.hostname)&&/submit profile/i.test(normalized)){
    const steps=[...doc.querySelectorAll('.iCIMS_Steps > ul > li')],current=steps.findIndex(step=>step.classList.contains('iCIMS_Steps_Current'));
    if(current>=0&&current<steps.length-1)kind='next';
  }
  const ownerForm=node.form||node.closest('form');
  if(kind==='submit'&&ownerForm&&(/sign.?in|log.?in|create.?account|sign.?up|register/i.test([ownerForm.id,ownerForm.name,ownerForm.action].join(' '))||ownerForm.querySelector('input[type="password"]')&&!/submit application/i.test(normalized)))kind='next';
  if(!kind)return null;
  const link=node.closest('a[href]'),form=node.form||node.closest('form');let targetUrl=link?.href||node.getAttribute('data-href')||node.getAttribute('data-url')||(form?.hasAttribute('action')?form.action:null);
  try{targetUrl=targetUrl?new URL(targetUrl,doc.location.href).href:null;if(targetUrl&&!/^https?:/.test(targetUrl))targetUrl=null;}catch{targetUrl=null;}
  return {kind,label:label.slice(0,200),targetUrl};
}
export function applicationControls(document){return [...document.querySelectorAll('a,button,input[type="submit"],input[type="button"],[role="button"]')].map(node=>({node,...applicationControl(node)})).filter(control=>control.kind);}
export function applicationFormSubmission(form,submitter){
  const control=submitter&&applicationControl(submitter);if(control)return control;
  const label=text(submitter?.getAttribute('aria-label')||submitter?.value||submitter?.textContent),context=[label,form?.id,form?.name,form?.action].filter(Boolean).join(' ');
  const authentication=!!form?.querySelector('input[type="password"]')||/sign.?in|log.?in|create.?account|sign.?up|register|\/auth(?:\/|\?)/i.test(context);
  return {kind:authentication?'next':'submit',label:label||(authentication?'Continue signing in':'Submit application'),targetUrl:form?.hasAttribute('action')?form.action:null};
}
export function applicationReceipt(document){
  const nodes=[...document.querySelectorAll('#application_confirmation,#form-submission-success-message,.application-confirmation,.postings-btn-wrapper,.iCIMS_SuccessMessage,[data-automation-id="candidateHomeTaskModal"],.thanks,[role="status"],[role="alert"],main h1,main h2,body > h1,body > h2')];
  const message=nodes.filter(visibleApplicationControl).map(node=>text(node.innerText||node.textContent)).find(value=>/application (?:has been |was )?(?:successfully )?(?:submitted|received|sent)|your application has successfully been submitted|successfully submitted your application|thank you for (?:applying|your application)|we (?:have |have successfully )?received your application|application complete/i.test(value));
  return message?{kind:'receipt',text:message.slice(0,600)}:null;
}
export function applicationErrors(document){return [...document.querySelectorAll('[role="alert"],.field-error,.form-error,[data-automation-id="errorBanner"],.iCIMS_ErrorMessage')].filter(visibleApplicationControl).map(node=>text(node.innerText||node.textContent)).filter(value=>/error|required|invalid|failed|could not|unable/i.test(value)).slice(0,5).join(' ').slice(0,800);}
