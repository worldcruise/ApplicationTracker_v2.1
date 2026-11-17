import {emptyProfile,normalizeProfile,profileToStudio} from '../../studio/profile-model.js';
import {profileValues} from '../../studio/profile-values.js';
import {phoneCountryCodes} from '../../studio/phone-country-codes.js';
import {connectAddressFields} from './profile-address.mjs';
import {resumeUploadPayload,profileResumePreview,changedProfileSections} from './resume-profile-upload.mjs';

export function mountAutofillProfile(root,{read,save,preview,close=()=>{},mode='popup',initialSection,previewPDF=profileResumePreview}) {
  const doc=root.ownerDocument,make=(tag,cls,text)=>{const node=doc.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
  let original=null,profile=null,busy=false,busyLabel='',active=initialSection||(mode==='page'?'resume':'personal'),revision=null,pendingResume=null,changed=[],disposed=false,previewUrl=null,addressFields=null;
  const sections=[['resume','Resume'],['personal','Personal information'],['education','Education'],['experience','Work experience'],['skills','Skills & languages'],['employment','Equal employment'],['preferences','Preferences']];
  root.className='af-profile'+(mode==='page'?' af-profile-page':'');root.setAttribute('role',mode==='page'?'region':'dialog');if(mode!=='page')root.setAttribute('aria-modal','true');root.setAttribute('aria-label','Autofill profile settings');
  const header=make('header','af-header'),heading=make('div'),title=make('h1',null,'Autofill profile'),subtitle=make('p',null,'Review the information used to fill your applications.');heading.append(title,subtitle);
  const dismiss=make('button','af-close','×');dismiss.type='button';dismiss.setAttribute('aria-label','Close profile settings');dismiss.addEventListener('click',close);header.append(heading);if(mode!=='page')header.append(dismiss);
  const layout=make('div','af-layout'),nav=make('nav','af-nav'),content=make('form','af-content'),footer=make('footer','af-footer'),message=make('p','af-message'),saveButton=make('button','af-primary','Save profile');
  nav.setAttribute('aria-label','Profile sections');message.setAttribute('role','status');saveButton.type='submit';saveButton.setAttribute('form','af-profile-form');content.id='af-profile-form';footer.append(message,saveButton);layout.append(nav,content);root.replaceChildren(header,layout,footer);
  const sidebarToggle=make('button','af-sidebar-toggle');sidebarToggle.type='button';sidebarToggle.setAttribute('aria-label','Collapse profile sidebar');sidebarToggle.setAttribute('aria-expanded','true');nav.id=`af-sidebar-${crypto.randomUUID()}`;sidebarToggle.setAttribute('aria-controls',nav.id);
  const sidebarIcon=doc.createElementNS('http://www.w3.org/2000/svg','svg');sidebarIcon.setAttribute('viewBox','0 0 24 24');sidebarIcon.setAttribute('fill','none');sidebarIcon.setAttribute('stroke','currentColor');sidebarIcon.setAttribute('stroke-width','1.8');sidebarIcon.setAttribute('aria-hidden','true');
  const outline=doc.createElementNS(sidebarIcon.namespaceURI,'rect');for(const [key,value]of Object.entries({x:3,y:4,width:18,height:16,rx:2}))outline.setAttribute(key,value);const divider=doc.createElementNS(sidebarIcon.namespaceURI,'path');divider.setAttribute('d','M9 4v16');sidebarIcon.append(outline,divider);sidebarToggle.append(sidebarIcon);header.prepend(sidebarToggle);
  sidebarToggle.addEventListener('click',()=>{nav.hidden=!nav.hidden;sidebarToggle.setAttribute('aria-expanded',String(!nav.hidden));sidebarToggle.setAttribute('aria-label',nav.hidden?'Expand profile sidebar':'Collapse profile sidebar');});
  const reviewBanner=make('div','af-review-banner');reviewBanner.hidden=true;layout.before(reviewBanner);
  const previewKey=`preview/profile-resume-${crypto.randomUUID()}.pdf`;
  function updateStatus(){
    saveButton.disabled=busy||!profile;saveButton.textContent=busy?busyLabel:original?'Save profile':'Create profile';root.setAttribute('aria-busy',String(busy));
    for(const control of content.querySelectorAll('button,input,textarea,select'))control.disabled=busy;
    const uploadButton=content.querySelector('.af-upload-drop');
    if(uploadButton){uploadButton.querySelector('strong').textContent=busy?busyLabel:profile?.resumeData.resumeBase64?'Drop a new resume to replace it':'Drop your resume here';uploadButton.querySelector('.af-upload-description').textContent=busy?message.textContent:'or click to choose a file';uploadButton.disabled=busy||!preview;}
    for(const button of nav.children)button.disabled=busy;
    for(const button of nav.children){const label=sections.find(([id])=>id===button.dataset.section)?.[1];button.textContent=label;if(changed.includes(button.dataset.section)){const dot=make('span','af-changed-dot');dot.title='Updated from resume';dot.setAttribute('aria-label','Updated from resume');button.append(dot);}}
    reviewBanner.hidden=!pendingResume;
    if(pendingResume){reviewBanner.replaceChildren(make('strong',null,'Resume processed · Review Changes'),make('span',null,'Check the highlighted sections, then save your changes.'));
      const discard=make('button','af-link','Discard upload');discard.type='button';discard.disabled=busy;discard.addEventListener('click',()=>{profile=pendingResume.previous;original=pendingResume.original;revision=pendingResume.revision;pendingResume=null;changed=[];previewUrl=null;message.textContent='Upload discarded. Your saved profile is unchanged.';updateStatus();renderSection();});reviewBanner.append(discard);}
  }
  function showProcess(label,description){busyLabel=label;message.textContent=description;updateStatus();}
  async function upload(file){
    if(busy||!profile||!file||!preview)return;busy=true;showProcess('Reading resume…','Reading and checking your resume file…');
    const previous=structuredClone(profile),previousOriginal=original,previousRevision=revision;
    try{
      const input=await resumeUploadPayload(file);if(disposed)return;showProcess('Processing resume…','Processing your resume. Waiting for the parsing result…');
      const result=await preview({...input,profile:previous,expectedRevision:revision});if(disposed)return;
      showProcess('Preparing profile…','Resume processed. Preparing your profile for review…');
      const discardTarget=pendingResume?{previous:pendingResume.previous,original:pendingResume.original,revision:pendingResume.revision}:{previous,original:previousOriginal,revision:previousRevision};
      profile=normalizeProfile(result.profile);original=result.expectedProfile;revision=result.revision;changed=changedProfileSections(discardTarget.previous,profile);previewUrl=null;
      pendingResume={...discardTarget,source:result.source,warnings:result.warnings||[]};
      active='resume';message.textContent='Your resume is ready to review. Nothing is saved until you choose '+(original?'Save profile.':'Create profile.');
    }catch(error){if(!disposed)message.textContent=error.message;}finally{busy=false;busyLabel='';if(!disposed){updateStatus();renderSection();}}
  }
  function resumeSection(){
    const resume=profile.resumeData,hasResume=!!resume?.resumeBase64;
    const file=make('input');file.type='file';file.accept='.pdf,.docx';file.hidden=true;file.setAttribute('aria-label','Upload or replace resume');file.disabled=busy;file.addEventListener('change',()=>{void upload(file.files?.[0]);file.value='';});
    const drop=make('button','af-upload-drop');drop.type='button';drop.disabled=busy||!preview;drop.append(make('span','af-upload-symbol','↑'),make('strong',null,busy?busyLabel:hasResume?'Drop a new resume to replace it':'Drop your resume here'),make('span','af-upload-description',busy?message.textContent:'or click to choose a file'),make('small',null,'PDF · up to 1 MB / DOCX · up to 6 MiB'));
    drop.addEventListener('click',()=>file.click());drop.addEventListener('dragover',event=>{event.preventDefault();drop.classList.add('af-dragover');});drop.addEventListener('dragleave',()=>drop.classList.remove('af-dragover'));drop.addEventListener('drop',event=>{event.preventDefault();drop.classList.remove('af-dragover');void upload(event.dataTransfer?.files?.[0]);});content.append(file,drop);
    content.append(make('p','af-help',hasResume?'Replacing your resume updates this same profile. Review extracted details before saving.':'Upload a resume to build your profile, or enter your details in the sections on the left.'));
    if(!hasResume)return;
    const card=make('section','af-resume-file'),text=make('div');text.append(make('strong',null,resume.fileName),make('span',null,pendingResume?'Ready for review · not saved':'Current resume'));card.append(text);
    if(/\.pdf$/i.test(resume.fileName)){const show=make('button','af-link','Preview PDF');show.type='button';show.addEventListener('click',async()=>{show.disabled=true;try{
      previewUrl||=await previewPDF(profile,{key:previewKey});if(disposed||!previewUrl)return;
      const existing=content.querySelector('.af-resume-preview');if(existing){existing.remove();show.textContent='Preview PDF';return;}
      const frame=make('iframe','af-resume-preview');frame.title='Uploaded resume PDF';frame.src=previewUrl;card.after(frame);frame.scrollIntoView?.({block:'start',behavior:'instant'});show.textContent='Hide preview';
    }catch(error){message.textContent=error.message;}finally{show.disabled=false;}});card.append(show);}content.append(card);
    if(resume.cvJsonRaw){const box=make('details','af-extraction-notes'),heading=make('summary',null,'Resume Studio CV JSON'),json=make('textarea','af-cv-json'),copy=make('button','af-link','Copy CV JSON');json.value=resume.cvJsonRaw;json.readOnly=true;json.rows=12;json.setAttribute('aria-label','Extracted Resume Studio CV JSON');copy.type='button';copy.addEventListener('click',async()=>{try{await doc.defaultView.navigator.clipboard.writeText(json.value);copy.textContent='Copied';}catch{box.open=true;json.focus();json.select();message.textContent='Select and copy the CV JSON below.';}});box.append(heading,copy,json);content.append(box);}
    if(pendingResume){const summary=make('section','af-review-summary');summary.append(make('h3',null,'Review extracted information'));
      const counts=[['personal','Personal details',profile.nameData.firstName||profile.contactData.email?'Review details':'Add details'],['education','Education',profile.educationData.length+' '+(profile.educationData.length===1?'entry':'entries')],['experience','Work experience',profile.jobData.length+' '+(profile.jobData.length===1?'entry':'entries')],['skills','Skills',profile.skillsData.length+' skills']];
      for(const [id,label,value]of counts){const button=make('button','af-review-item');button.type='button';button.append(make('strong',null,label),make('span',null,value));button.addEventListener('click',()=>{active=id;renderSection();});summary.append(button);}content.append(summary);
      if(pendingResume.warnings.length){const notes=make('details','af-extraction-notes');notes.append(make('summary',null,'Extraction notes'));const list=make('ul');for(const warning of pendingResume.warnings)list.append(make('li',null,warning));notes.append(list);content.append(notes);}
      const continueButton=make('button','af-primary','Review personal details');continueButton.type='button';continueButton.addEventListener('click',()=>{active='personal';renderSection();});content.append(continueButton);
    }
  }
  function field(group,label,parent,key,options){
    const wrap=make('label','af-field'),caption=make('span',null,label),input=make(options?'select':'input');
    input.name=key;input.setAttribute('aria-label',label);
    if(options){for(const option of [['','Not provided'],...options.map(value=>Array.isArray(value)?value:[value,value])]){const node=make('option',null,option[1]);node.value=String(option[0]);input.append(node);}input.value=String(parent[key]??'');}
    else{input.type=/email/i.test(key)?'email':'text';input.value=parent[key]??'';}
    input.addEventListener('change',()=>{parent[key]=options&&['eligibilityUS','sponsorship','disability','veteran','hispanicOrLatino'].includes(key)?input.value==='true'?true:input.value==='false'?false:input.value||undefined:input.value;});wrap.append(caption,input);group.append(wrap);return input;
  }
  function textarea(group,label,value,update){const wrap=make('label','af-field af-wide'),input=make('textarea');input.rows=4;input.value=value;input.setAttribute('aria-label',label);input.addEventListener('input',()=>update(input.value));wrap.append(make('span',null,label),input);group.append(wrap);}
  function checkbox(group,label,parent,key){
    const wrap=make('label','af-checkbox af-wide'),input=make('input');input.type='checkbox';input.name=key;input.checked=parent[key]===true;input.setAttribute('aria-label',label);
    input.addEventListener('change',()=>{parent[key]=input.checked;});wrap.append(input,make('span',null,label));group.append(wrap);
  }
  function listEditor(key,label,defaults,fields){
    for(const [index,item]of profile[key].entries()){
      const card=make('section','af-record'),top=make('div','af-record-top'),remove=make('button','af-link','Remove');remove.type='button';remove.addEventListener('click',()=>{profile[key].splice(index,1);renderSection();});top.append(make('h3',null,`${label} ${index+1}`),remove);card.append(top);
      for(const [caption,name,options]of fields){const input=field(card,caption,item,name,options);if(key==='educationData'&&name==='degree')input.addEventListener('change',()=>{delete item.degreeName;card.querySelector('.af-credential-note')?.remove();});}
      if(key==='jobData'){textarea(card,'Responsibilities & achievements',item.description||'',value=>item.description=value);checkbox(card,'Currently employed here',item,'currentlyWorkHere');}
      if(key==='educationData'){if(item.degreeName)card.append(make('p','af-credential-note af-wide','Qualification: '+item.degreeName));checkbox(card,'Currently attending',item,'currentlyAttending');}
      if(key==='languageData'){const current=field(card,'Fluent',item,'fluent',[[true,'Yes'],[false,'No']]);current.value=String(item.fluent);current.addEventListener('change',()=>item.fluent=current.value==='true');}
      content.append(card);
    }
    const add=make('button','af-link',`+ Add ${label.toLowerCase()}`);add.type='button';add.addEventListener('click',()=>{profile[key].push(structuredClone(defaults));renderSection();});content.append(add);
  }
  function renderSection(){
    addressFields?.dispose();addressFields=null;
    content.replaceChildren(make('h2',null,sections.find(([id])=>id===active)[1]));for(const button of nav.children)button.setAttribute('aria-current',String(button.dataset.section===active));
    if(!profile)return;
    if(active==='resume'){resumeSection();return;}
    const grid=make('div','af-grid');content.append(grid);
    if(active==='personal'){
      for(const [label,key]of [['First name','firstName'],['Middle name','middleName'],['Last name','lastName']])field(grid,label,profile.nameData,key);
      field(grid,'Email',profile.contactData,'email');
      const phone=make('div','af-phone-row'),names=new Intl.DisplayNames(['en'],{type:'region'}),codes=[...phoneCountryCodes].sort((a,b)=>a.iso==='US'?-1:b.iso==='US'?1:names.of(a.iso).localeCompare(names.of(b.iso)));
      const selected={phoneCountry:profile.contactData.phoneCountry||codes.find(item=>item.code===profile.contactData.phoneCountryCode)?.iso||''};
      const country=field(phone,'Country code',selected,'phoneCountry',codes.map(item=>[item.iso,`${names.of(item.iso)} (${item.code})`]));country.name='phoneCountryCode';country.setAttribute('aria-label','Phone country code');
      if(profile.contactData.phoneCountryCode&&!selected.phoneCountry){const option=make('option',null,profile.contactData.phoneCountryCode);option.value='saved';country.append(option);country.value='saved';}
      country.addEventListener('change',()=>{const entry=codes.find(item=>item.iso===country.value);if(country.value==='saved')return;profile.contactData.phoneCountryCode=entry?.code||'';profile.contactData.phoneCountry=entry?.iso||'';});
      const phoneInput=field(phone,'Phone number',profile.contactData,'phoneNumber');phoneInput.type='tel';phoneInput.autocomplete='tel-national';grid.append(phone);
      const addressInputs={};for(const [label,key]of [['Street address','line1'],['Address line 2','line2'],['City','city'],['State / province','state'],['Postal code','postalCode']])addressInputs[key]=field(grid,label,profile.addressData,key);
      addressInputs.country=field(grid,'Country',profile.addressData,'country',profileValues.countries);
      addressFields=connectAddressFields({inputs:addressInputs,address:profile.addressData});
      for(const [label,key]of [['LinkedIn','linkedin'],['GitHub','github'],['Portfolio / website','personal']])field(grid,label,profile.websiteData,key);
    }
    if(active==='education')listEditor('educationData','Education',{school:'',degree:'',fieldOfStudy:'',startDate:'',endDate:'',gpa:'',currentlyAttending:false},[['School','school'],['Degree','degree',profileValues.degrees],['Field of study','fieldOfStudy'],['Start date (YYYY-MM)','startDate'],['End date (YYYY-MM)','endDate'],['GPA','gpa']]);
    if(active==='experience')listEditor('jobData','Experience',{jobTitle:'',company:'',location:'',startDate:'',endDate:'',currentlyWorkHere:false,description:''},[['Job title','jobTitle'],['Company','company'],['Location','location'],['Start date (YYYY-MM)','startDate'],['End date (YYYY-MM)','endDate']]);
    if(active==='skills'){
      textarea(grid,'Skills (one per line, up to 25)',profile.skillsData.join('\n'),value=>profile.skillsData=value.split('\n').map(value=>value.trim()).filter(Boolean));
      listEditor('languageData','Language',{language:'',proficiency:'',fluent:false},[['Language','language',profileValues.languages],['Proficiency','proficiency',profileValues.proficiencies]]);
    }
    if(active==='employment'){
      content.append(make('p','af-help','Optional answers. Leave a field blank to answer it yourself on the employer page.'));
      field(grid,'Gender',profile.employmentData,'gender',profileValues.genders);field(grid,'Ethnicity',profile.employmentData,'ethnicity',profileValues.ethnicities);
      for(const [label,key]of [['Authorized to work in the United States','eligibilityUS'],['Require visa sponsorship','sponsorship'],['Disability','disability'],['Veteran','veteran'],['Hispanic or Latino','hispanicOrLatino']])field(grid,label,profile.employmentData,key,[[true,'Yes'],[false,'No'],['undisclosed','Prefer not to disclose']]);
    }
    if(active==='preferences'){
      for(const [label,key]of [['Preferred job title','preferredRole'],['Expected salary','expectedSalary'],['Available start date','availableStartDate'],['Preferred location','preferredLocation']])field(grid,label,profile.employmentData,key);
      field(grid,'Work arrangement',profile.employmentData,'workArrangement',['Remote','Hybrid','On-site']);
      textarea(grid,'Additional application context',profile.employmentData.applicationContext||'',value=>profile.employmentData.applicationContext=value);
    }
    content.scrollTop=0;
  }
  for(const [id,label]of sections){const button=make('button',null,label);button.type='button';button.dataset.section=id;button.addEventListener('click',()=>{active=id;renderSection();});nav.append(button);}
  content.addEventListener('submit',async event=>{event.preventDefault();if(busy||!profile)return;busy=true;showProcess('Saving profile…','Saving your reviewed profile and resume…');try{
    const result=await save({profile:normalizeProfile(profile),expectedProfile:original,importResume:!!pendingResume,mutationId:crypto.randomUUID()});if(disposed)return;original=structuredClone(result.candidate.profile);profile=structuredClone(original);revision=result.candidate.revision;pendingResume=null;changed=[];message.textContent='Profile saved. Your applications will use these details.';renderSection();
  }catch(error){if(!disposed)message.textContent=error.message;}finally{busy=false;busyLabel='';if(!disposed)updateStatus();}});
  const ready=read().then(result=>{if(disposed)return;original=result.candidate?.profile||null;revision=result.candidate?.revision??null;profile=normalizeProfile(original||emptyProfile());
    const projected=result.candidate?.document||profileToStudio(profile,'profile-editor');
    for(const [key,rows]of [['jobData',projected.companies],['educationData',projected.professionalProfile.education]])profile[key].forEach((row,index)=>{row.id||=rows[index]?.id;});
    if(!original)active='resume';updateStatus();renderSection();if(mode!=='page')dismiss.focus();}).catch(error=>{if(!disposed){message.textContent=error.message;saveButton.disabled=true;}});
  return {ready,upload,dispose(){disposed=true;addressFields?.dispose();}};
}
