import {composedParent} from './apply-form-dom.js';

const text=value=>typeof value==='string'?value.trim():'';
const words=value=>String(value??'').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/[_\-[\].]+/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
const yesNo=value=>value===true?'Yes':value===false?'No':value==='undisclosed'?'Prefer not to disclose':'';
const identity=node=>[node.name,node.id,node.getAttribute('data-automation-id')].filter(Boolean).join(' ');

function history(node){
  const own=identity(node),array=own.match(/(?:education|employment|experience|work|jobs?)(?:Data|History|Experience)?\[(\d+)\]/i);
  let context=words(own),index=array?Number(array[1]):null;
  for(let parent=composedParent(node);parent&&!/^(FORM|BODY|HTML)$/.test(parent.tagName);parent=composedParent(parent)){
    const description=[identity(parent),parent.getAttribute('data-section'),parent.querySelector(':scope > legend,:scope > h2,:scope > h3,:scope > h4')?.textContent].filter(Boolean).join(' ');
    context+=' '+words(description);
    if(index===null){const match=description.match(/(?:education|workExperience|work[- ]?experience|employment|experience)[-_ ](\d+)/i);if(match)index=Math.max(0,Number(match[1])-1);}
    if(/\beducation\b|\b(?:work|employment)(?:\s+history|\s+experience)?\b|\bexperience\b/.test(context))break;
  }
  return {education:/\beducation\b/.test(context),work:/\b(?:work|employment|experience|job history)\b/.test(context),index:index??0};
}
function datePart(value,label){
  const date=text(value),us=date.match(/^(\d{1,2})\/(\d{4})$/),match=date.match(/^(\d{4})(?:[-/](\d{1,2}))?/)||(us?[us[0],us[2],us[1]]:null);
  if(!match)return /\b(?:month|year)\b/.test(label)?'':date;
  if(/\byear\b/.test(label))return match[1];
  if(/\bmonth\b/.test(label))return match[2]?String(Number(match[2])):'';
  return us?`${match[1]}-${match[2].padStart(2,'0')}`:date;
}
function phone(profile,node,label){
  const contact=profile.contactData||{},number=text(contact.phoneNumber),code=text(contact.phoneCountryCode),auto=words(node.autocomplete);
  if(/country code|dial(?:ing)? code|phone prefix/.test(label)||auto.endsWith('tel country code'))return code;
  if(/country/.test(label)&&/phone|mobile|telephone/.test(label))return contact.phoneCountry?new Intl.DisplayNames(['en'],{type:'region'}).of(contact.phoneCountry):'';
  const digits=number.replace(/\D/g,''),national=digits.length===11&&digits.startsWith('1')?digits.slice(1):digits;
  if(national.length===10&&(code==='+1'||contact.phoneCountry==='US'||/^\+1\b/.test(number)||!code&&!number.startsWith('+')))return `(${national.slice(0,3)}) ${national.slice(3,6)}-${national.slice(6)}`;
  if(auto.endsWith('tel national'))return code&&number.startsWith(code)?number.slice(code.length).trim():number;
  if(!number)return '';
  return number.startsWith('+')||!code?number:code+' '+number;
}

// Only use facts explicitly saved in the single profile. Unknown answers remain
// editable in the dock; this mapper never creates candidate facts or consent.
export function profileFieldAnswer(node,profile,label){
  const name=profile.nameData||{},contact=profile.contactData||{},address=profile.addressData||{},site=profile.websiteData||{},employment=profile.employmentData||{};
  const caption=words(label),field=words([label,identity(node)].join(' ')),auto=(node.autocomplete||'').split(' ').at(-1),scope=history(node);
  const education=(profile.educationData||[])[scope.index]||{},job=(profile.jobData||[])[scope.index]||{};
  if(/consent|agree|certify|acknowledge|privacy|terms|signature/.test(caption))return '';
  if(/\b(?:why|describe|explain)\b|tell us|tell me/.test(caption))return '';
  // Camel-case IDs such as linkedIn become "linked in" after normalization.
  // An explicit social field takes precedence over generic autocomplete=url.
  if(/\blinked\s*in\b/.test(field))return text(site.linkedin)||(site.websites||[]).find(value=>{try{return /(^|\.)linkedin\.com$/i.test(new URL(/^https?:\/\//i.test(value)?value:`https://${value}`).hostname);}catch{return false;}})||'';
  if(/\bgit\s*hub\b/.test(field))return text(site.github);
  if(/sponsor|sponsorship/.test(caption))return /authoriz|authoris|eligible|eligibility/.test(caption)?'':yesNo(employment.sponsorship);
  if(/(?:authorized|authorised|authorization|authorisation|eligible|eligibility).*(?:work|employment)|(?:work|employment).*(?:authorized|authorised|authorization|authorisation|eligibility)/.test(caption)){
    const otherCountry=/\b(?:canada|united kingdom|uk|australia|germany|india)\b/.test(caption);
    return !otherCountry&&(/\b(?:united states|u s|usa|us)\b/.test(caption)||/united states|^us$|^usa$/i.test(address.country||''))?yesNo(employment.eligibilityUS):'';
  }
  if(/\bdisab(?:ility|ilities|led)\b/.test(caption))return yesNo(employment.disability);
  if(/\bveteran\b/.test(caption))return yesNo(employment.veteran);
  if(/hispanic|latino/.test(caption))return yesNo(employment.hispanicOrLatino);
  if(/\bgender\b/.test(caption))return text(employment.gender);
  if(/\bethnicity\b|\brace\b/.test(caption))return text(employment.ethnicity);
  if(/\b(?:available|availability|earliest)\b.*\b(?:start|date)\b|\bstart date\b|\bwhen\b.*\bstart\b/.test(caption))return text(employment.availableStartDate);
  if(/\b(?:salary|compensation|pay)\b.*\b(?:expect|desir|require)|\b(?:expect|desir)\w*\b.*\b(?:salary|compensation|pay)\b/.test(caption))return text(employment.expectedSalary);
  if(/\b(?:work arrangement|preferred work|work preference)\b/.test(caption))return text(employment.workArrangement);
  if(/\bpreferred\s+(?:job\s+)?(?:role|title)\b/.test(caption))return text(employment.preferredRole);
  if(/\bpreferred location\b/.test(caption))return text(employment.preferredLocation);

  const isEducation=scope.education||/\b(?:school|university|college|degree|major|field of study|discipline|gpa|graduation)\b/.test(field);
  if(isEducation){
    if(/\b(?:school|university|college|institution)\b/.test(caption)&&!/degree|major/.test(caption)||/\bschool(?: name)?\b/.test(words(identity(node))))return text(education.school);
    if(/\b(?:major|field of study|discipline)\b/.test(field))return text(education.fieldOfStudy);
    if(/\bdegree\b|qualification|education level/.test(field))return text(education.degreeName)||text(education.degree);
    if(/\bgpa\b/.test(field))return text(education.gpa);
    if(/currently (?:attending|studying|enrolled)/.test(caption))return typeof education.currentlyAttending==='boolean'?yesNo(education.currentlyAttending):'';
    if(/\b(?:end|graduation|completion|to|last)\b/.test(caption))return education.currentlyAttending?'':datePart(education.endDate,caption);
    if(/\b(?:start|from|first|enrollment)\b/.test(caption))return datePart(education.startDate,caption);
    return '';
  }
  if(scope.work||/\b(?:current|most recent|previous)\b.*\b(?:employer|company|job|title)\b|^(?:(?:company|employer)(?: name)?|job title|position title)$/.test(caption)){
    if(/\b(?:job|position) title\b|^title$/.test(caption))return text(job.jobTitle);
    if(/\bcompany\b|\bemployer\b/.test(caption)&&!/contact|permission/.test(caption))return text(job.company);
    if(/\blocation\b/.test(caption))return text(job.location);
    if(/\b(?:description|responsibilities|achievements|duties)\b/.test(caption))return text(job.description);
    if(/currently (?:work|employed)/.test(caption))return typeof job.currentlyWorkHere==='boolean'?yesNo(job.currentlyWorkHere):'';
    if(/\b(?:end|to|last)\b/.test(caption))return job.currentlyWorkHere?'':datePart(job.endDate,caption);
    if(/\b(?:start|from|first)\b/.test(caption))return datePart(job.startDate,caption);
    return '';
  }
  if(auto?.startsWith('tel')||/\b(?:phone|mobile|telephone|dialing)\b|country code/.test(field))return phone(profile,node,field);
  const facts={
    'given-name':name.firstName,'family-name':name.lastName,'additional-name':name.middleName,
    name:[name.firstName,name.middleName,name.lastName].filter(Boolean).join(' '),email:contact.email,
    'street-address':[text(address.line1),text(address.line2)].filter(Boolean).join('\n'),
    'address-line1':address.line1,'address-line2':address.line2,'address-level2':address.city,'address-level1':address.state,
    'postal-code':address.postalCode,'country-name':address.country,country:address.country,url:site.personal,
    linkedin:site.linkedin,github:site.github,skills:(profile.skillsData||[]).join(', ')
  };
  if(auto&&facts[auto])return text(facts[auto]);
  if(/\bpreferred\b/.test(field)&&/\bname\b/.test(field))return text(name.preferredFirstName);
  const rules=[[/\bfirst\s*name\b|\bgiven\s*name\b/,'given-name'],[/\blast\s*name\b|\bfamily\s*name\b|\bsurname\b/,'family-name'],[/\bmiddle\s*name\b/,'additional-name'],[/\bfull\s*name\b|^name(?: name)*$/,'name'],[/\be.?mail\b/,'email'],[/\blinkedin\b/,'linkedin'],[/\bgithub\b/,'github'],[/\bpostal\b|\bzip\b/,'postal-code'],[/\bcity\b/,'address-level2'],[/\bstate\b|\bprovince\b/,'address-level1'],[/\bcountry\b/,'country-name'],[/\baddress\s*(?:line\s*)?2\b/,'address-line2'],[/\baddress\s*(?:line\s*)?1\b|\bstreet\b|^address(?: address)*$/,'address-line1'],[/\bpersonal\s*(?:website|url)\b|\bportfolio\b|^website(?: website)*$/,'url'],[/^skills\b/,'skills']];
  return text(facts[rules.find(([pattern])=>pattern.test(field))?.[1]]);
}
