import {speedyRuleForDocument} from './speedy-submission-rules.js';

const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
export function speedyApplicationMetadata(document,rule=speedyRuleForDocument(document)){
  if(!rule)return null;
  const page=new URL(document.location.href),url=page.href,q=selector=>document.querySelector(selector),xpath=selector=>document.evaluate?.(selector,document,null,9,null)?.singleNodeValue,text=selector=>clean(q(selector)?.textContent),href=selector=>q(selector)?.href||'',origin=value=>{try{return value?new URL(value,url).origin:'';}catch{return '';}};
  let jobTitle='',jobLink='',companyLink='',companyName='',match;
  // These selectors and URL transforms follow the original save functions.
  switch(rule.id){
    case 'workday':jobTitle=text('h3,[data-automation-id="jobTitleHeading"],[data-automation-id="jobPostingHeader"]');companyLink=href('a[data-automation-id="logoLink"]')||url.match(/(https?:\/\/[^/]+\/(?:en-US\/)?[^/]+)/)?.[1]||'';jobLink=url.includes('/apply')?url.slice(0,url.indexOf('/apply')):url;break;
    case 'greenhouse':{
      jobTitle=text('.job__title h1,h1.app-title');companyName=document.title.split(' at ')[1]?.trim()||'';jobTitle||=document.title.split(' at ')[0]?.replace('Job Application for ','').trim()||'';companyLink=origin(href('a.logo'));
      if(page.pathname.includes('/embed/job_app')){companyLink||=page.origin+'/'+page.searchParams.get('for');jobLink=page.origin+'/'+page.searchParams.get('for')+'/jobs/'+page.searchParams.get('token');if(/^boards(?:\.eu)?\.greenhouse\.io$/.test(page.hostname)&&page.searchParams.get('b')){const external=page.searchParams.get('b');jobLink=external+'?gh_jid='+page.searchParams.get('token');companyLink=origin(external);jobTitle=q('meta[property="og:title"]')?.content||jobTitle;}}
      else{jobLink=url.match(/(https:\/\/.+?\/jobs\/\d+)/)?.[1]||'';companyLink||=url.match(/(https?:\/\/[^/]+\/[^/]+)/)?.[1]||'';}break;
    }
    case 'lever':jobTitle=text('h2,.posting-headline h2');companyName=document.title.split(' - ')[0]?.trim()||'';companyLink=href('.main-footer-text p:first-child a')||url.match(/(https:\/\/jobs(?:\.[a-z]+)?\.lever\.co\/[^/]+)/)?.[1]||'';jobLink=url.replace(/\/(?:apply|thanks)(?:[/?#].*)?$/,'');break;
    case 'ashby':jobTitle=text('h1');companyLink=href('a.navLogoLink')||url.match(/^(https:\/\/jobs\.ashbyhq\.com\/[^/]+)/)?.[1]||'';companyName=q('a img')?.alt||document.title.split(' @ ').pop()?.trim()||'';jobLink=url.match(/^(https:\/\/jobs\.ashbyhq\.com\/[^/]+\/[a-f0-9-]+)/)?.[1]||'';break;
    case 'bamboohr':jobTitle=text('h3');match=url.match(/^(https:\/\/[^/]+\.bamboohr\.com\/careers)(?:\/(\d+))?/);companyLink=match?.[1]||'';jobLink=match?.[2]?`${companyLink}/${match[2]}`:'';break;
    case 'breezy':jobTitle=text('#heroBackgroundColor h1');jobLink=url.match(/^(https:\/\/[^/]+\.breezy\.hr\/p\/[a-z0-9]+-[^/]+)/)?.[1]||'';companyLink=page.origin;break;
    case 'dayforce':jobTitle=text('h1[test-id="job-detail-title"]');jobLink=url.split('/apply')[0];companyLink=url.split('/jobs/')[0];break;
    case 'dover':jobTitle=clean(xpath('//a[img]/../following-sibling::div[1]/div | //img/../following-sibling::div[1]/div')?.textContent);companyLink=xpath('//a[img]')?.href||xpath("//a[@href='https://dover.com']/following::a[1]")?.href||'';if(companyLink.endsWith('/audit'))companyLink=companyLink.slice(0,-6);companyName=document.title.split(' at ').pop()?.trim()||'';jobLink=url.match(/(https:\/\/app\.dover\.(?:io|com)\/apply\/[^/]+\/[a-f0-9-]+)/)?.[1]||'';break;
    case 'eightfold':jobTitle=text('.apply-position-title,.jobCartPositionName');jobLink=href('link[rel="canonical"]')||(page.searchParams.has('pid')?`${page.origin}${page.pathname}?pid=${page.searchParams.get('pid')}`:url);companyLink=url.match(/^(https?:\/\/[^/]+\/careers)/)?.[1]||page.origin;companyName=(q('meta[name="description"]')?.content||'').replace(/^careers at /i,'');break;
    case 'freshteam':jobTitle=text('h1.brand-color');jobLink=url;companyLink=url.match(/(https:\/\/[^.]+\.freshteam\.com\/jobs)/)?.[1]||'';break;
    case 'gusto':jobTitle=text('li:nth-child(2) a');jobLink=href('li:nth-child(2) a')||url.match(/(https:\/\/jobs\.gusto\.com\/postings\/[^/]+-[a-f0-9-]+)/)?.[1]||url.replace(/\/applicants(?:\/new)?$/,'');companyLink=href('li:nth-child(1) a');break;
    case 'icims':jobTitle=text('h1.iCIMS_Header');jobLink=url.match(/(https:\/\/[^/]+\.icims\.(?:com|eu)\/jobs\/\d+(?:\/[^/]+)?\/job)/)?.[1]||'';companyLink=origin(href('link[rel="canonical"]'));if(!companyLink){const root=url.match(/(https:\/\/[^/]+\.icims\.(?:com|eu)\/jobs)/)?.[1];companyLink=root?root+'/dashboard':'';}break;
    case 'jazzhr':{
      jobTitle=text('.job_title,.job-header h1');companyLink=q('#resumator-view-our-website-text')?.parentElement?.href||url.match(/(https:\/\/[^/]*\.(?:applytojob|theresumator)\.com\/apply)/)?.[1]||'';jobLink=url;
      try{const data=JSON.parse(q('script[type="application/ld+json"]')?.textContent||'{}');if(data['@type']==='Organization')companyName=data.name||'';}catch{}
      companyName||=document.title.match(/-\s*([^-\n]+?)(?:\s*-\s*Career Page)?$/)?.[1]?.trim()||'';break;
    }
    case 'jobvite':companyName=[...document.querySelectorAll('script[type="text/javascript"]')].find(node=>node.textContent.includes('function getCompanyName()'))?.textContent.match(/return\s+['"](.+?)['"]/)?.[1]||document.title.replace(/\s*Careers\s*$/i,'').trim();jobLink=url.match(/^(https:\/\/jobs\.jobvite\.com\/[^/]+\/job\/[^/]+)/)?.[1]||'';companyLink=url.match(/^(https:\/\/jobs\.jobvite\.com\/[^/]+)/)?.[1]||'';break;
    case 'paylocity':jobTitle=text('.job-apply-title > span');companyLink=[...document.querySelectorAll('a')].find(node=>/view all jobs/i.test(node.textContent))?.href||'';match=url.match(/^https:\/\/recruiting\.paylocity\.com\/Recruiting\/Jobs\/([^/]+)\/([^/]+)/i);jobLink=match?'https://recruiting.paylocity.com/Recruiting/Jobs/Details/'+match[2]:'';break;
    case 'phenom':jobTitle=text('#job-description-url');jobLink=href('#job-description-url');companyLink=origin(jobLink);break;
    case 'pinpoint':jobTitle=text('a > span');jobLink=url.match(/^(https:\/\/[^/]+\.pinpointhq\.com\/[^/]+\/postings\/[a-f0-9-]+)/)?.[1]||'';companyLink=page.origin;break;
    case 'polymer':jobTitle=text('.title');companyLink=href('.header__website')||url.match(/(https:\/\/jobs\.polymer\.co\/[^/]+)/)?.[1]||'';jobLink=url.match(/(https:\/\/jobs\.polymer\.co\/[^/]+\/\d+)/)?.[1]||'';break;
    case 'rippling':jobTitle=text('.job-title-container h2')||document.title.replace('Apply - ','');companyLink=href('.company-logo a')||url.match(/^(https:\/\/ats\.rippling\.com\/[^/]+\/jobs)/)?.[1]||page.origin;jobLink=url.match(/^(https:\/\/ats\.rippling\.com\/[^/]+\/jobs\/[^/]+)/)?.[1]||url.split('?')[0];break;
    case 'seek':jobTitle=text('h1');jobLink=url.match(/^(https:\/\/(?:www\.)?seek\.com\.au\/job\/\d+)/)?.[1]||'';break;
    case 'smartrecruiters':jobTitle=text('p[data-test="topbar-job-title"]');companyName=q('img[data-test="topbar-logo"]')?.alt?.replace(/\s*Logo\s*$/i,'').trim()||document.title.split(' - ').pop()?.trim()||'';match=url.match(/^https:\/\/jobs\.smartrecruiters\.com\/oneclick-ui\/company\/([^/]+)\/(?:job|publication)\/([^/]+)/);jobLink=match?`https://jobs.smartrecruiters.com/${match[1]}/${match[2]}`:'';companyLink=match?`https://careers.smartrecruiters.com/${match[1]}`:'';break;
    case 'successfactors':jobTitle=text('[id*="pageTitle"] h1');companyLink=href('.customheaderimagecontainer a,img[class*="logo"]')||q('img[class*="logo"]')?.parentElement?.href||'';break;
    case 'tesla':jobTitle=text('p[class*="JobTitle_"]');jobLink=url.replace(/\/job\/apply\/(\d+).*$/,'/job/$1');companyLink='https://www.tesla.com/';break;
    case 'tiktok':jobTitle=text('[class*="resumeEditForm-headerText"]');match=url.match(/^(https:\/\/(?:careers\.tiktok\.com|lifeattiktok\.com))\/resume\/(\d+)\/apply$/);jobLink=match?`${match[1]}/position/${match[2]}/detail`:'';companyLink=page.origin+'/';break;
    case 'ultipro':jobTitle=text('h1').replace(/^You applied for /,'');companyLink=href('a.navbar-brand')||url.match(/^https:\/\/[^/]+\.ultipro\.(?:com|ca)\/[^/]+\/JobBoard\/[^/]+/)?.[0]||'';break;
    case 'workable':jobTitle=text('h1[data-ui="job-title"]');companyLink=href('[data-ui="company-url"]')||url.match(/(https:\/\/apply\.workable\.com\/[^/]+)/)?.[1]||'';companyName=q('[data-ui="header-logo"] img')?.alt||document.title.split(' - ').pop()?.trim()||'';jobLink=url.match(/(https:\/\/apply\.workable\.com\/[^/]+\/j\/[^/]+\/)/)?.[1]||'';break;
    case 'adp':companyLink='https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid='+page.searchParams.get('cid');jobLink=companyLink+'&jobId='+page.searchParams.get('jobId');break;
    case 'indeed':{
      jobTitle=text('.ia-JobHeader h1');companyName=text('.ia-JobHeader span').split(' - ')[0];let id=page.searchParams.get('jk');for(const script of document.querySelectorAll('script:not([src])'))id||=script.textContent.match(/"jk"\s*:\s*"([^"]+)"/)?.[1];
      if(id)jobLink=`https://www.indeed.com/viewjob?jk=${id}`;companyLink=companyName&&!/confidential/i.test(companyName)?'https://www.indeed.com/cmp/'+companyName.replace(/\s+/g,'-'):'';break;
    }
    case 'linkedin':jobTitle=text('main .job-view-layout.jobs-details h1');companyName=text('.job-details-jobs-unified-top-card__company-name a');companyLink=href('.job-details-jobs-unified-top-card__company-name a').replace(/\/life\/?$/,'');if(!jobTitle){jobTitle=clean(xpath("//a[@data-view-name='job-apply-button']/ancestor::*[.//a[contains(@href, 'linkedin.com/company')]//figure][1]//a[contains(@href, 'linkedin.com/jobs') and not(@data-view-name='job-apply-button')]")?.textContent);const company=xpath("//a[@data-view-name='job-apply-button']/ancestor::*[.//a[contains(@href, 'linkedin.com/company')]//figure][1]//a[contains(@href, 'linkedin.com/company')]//figure/following-sibling::p/a");companyLink=company?.href?.replace(/\/life\/?$/,'')||companyLink;companyName=clean(company?.textContent)||companyName;}match=page.searchParams.get('currentJobId')||page.pathname.match(/\/jobs\/view\/([^/]+)/)?.[1];if(match)jobLink='https://www.linkedin.com/jobs/view/'+match+'/';break;
    case 'naukri':jobTitle=text('#job_header h1');companyLink=q('#job_header a:has(img)')?.href||'';match=url.match(/job-listings-[a-z0-9-]+-(\d+)\b/);jobLink=match?'https://www.naukri.com/job-listings-'+match[1]:'';break;
    case 'comeet':{
      const data=[...document.querySelectorAll('script')].find(node=>/POSITION_DATA/.test(node.textContent||''))?.textContent||'',position=data.indexOf('"position_uid"'),stack=[];let quoted=false,escaped=false,object='';
      for(let index=0;position>=0&&index<data.length&&!object;index++){const char=data[index];if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;}else if(char==='"')quoted=true;else if(char==='{')stack.push(index);else if(char==='}'){const start=stack.pop();if(start!==undefined&&start<=position&&index>=position)object=data.slice(start,index+1);}}
      const field=name=>{const value=object.match(new RegExp('"'+name+'"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"'));try{return value?JSON.parse('"'+value[1]+'"'):'';}catch{return '';}};
      jobTitle=field('name');companyName=field('company_name');jobLink=field('careers_page_url');companyLink=jobLink.split('/').slice(0,-2).join('/');break;
    }
  }
  return {jobTitle:clean(jobTitle).slice(0,500),jobLink:jobLink||url,companyLink:companyLink||'',companyName:clean(companyName).slice(0,300)};
}

export function speedySubmissionSnapshot(document){
  const rule=speedyRuleForDocument(document);if(!rule)return null;
  const visible=node=>{if(!node||node.closest('[hidden],[aria-hidden="true"]'))return false;for(let item=node;item;item=item.parentElement){const style=document.defaultView.getComputedStyle(item);if(style.display==='none'||style.visibility==='hidden')return false;}return true;};
  let receipt=null;
  if(rule.receipt){const roots=[document];if(rule.shadow&&document.querySelector(rule.shadow)?.shadowRoot)roots.push(document.querySelector(rule.shadow).shadowRoot);for(const root of roots){const node=[...root.querySelectorAll(rule.receipt)].find(node=>visible(node)&&(!rule.receiptText||rule.receiptText.test(node.textContent)));if(node){receipt={kind:'speedy-receipt',provider:rule.id,rule:rule.source,text:clean(node.textContent).slice(0,600)||'Application submitted'};break;}}}
  const page=new URL(document.location.href);
  if(rule.confirmation==='rippling'&&page.searchParams.get('step')==='confirmation'||rule.confirmation==='tiktok'&&page.pathname==='/resume/applied'||rule.confirmation==='indeed'&&page.pathname.includes('post-apply'))receipt={kind:'speedy-route',provider:rule.id,rule:rule.source,text:'Application submitted',url:page.href};
  let stage='Application form';
  // Original Workday page dispatch and Tesla/SmartRecruiters step selectors.
  const stages=[['[data-automation-id="quickApplyPage"],[data-automation-id="applyFlowAutoFillPage"]','Resume'],['[data-automation-id="contactInformationPage"],[data-automation-id="applyFlowMyInfoPage"],#step--personal,oc-oneclick-form','Personal information'],['[data-automation-id="myExperiencePage"],[data-automation-id="applyFlowMyExpPage"]','Experience'],['[data-automation-id="primaryQuestionnairePage"],[data-automation-id="applyFlowPrimaryQuestionsPage"],[data-automation-id="secondaryQuestionnairePage"],[data-automation-id="applyFlowSecondaryQuestionsPage"],sr-screening-questions-form,#step--job','Application questions'],['[data-automation-id="voluntaryDisclosuresPage"],[data-automation-id="applyFlowVoluntaryDisclosuresPage"],#step--legal','Disclosures'],['[data-automation-id="selfIdentificationPage"],[data-automation-id="applyFlowSelfIdentifyPage"],#step--eeo','Self identification'],['[data-automation-id="reviewJobApplicationPage"],[data-automation-id="applyFlowReviewPage"],#pcty-wr-preview-jobapplication','Review application']];
  for(const [selector,label]of stages)if([...document.querySelectorAll(selector)].some(visible))stage=label;
  const active=document.querySelector('ol button[aria-current="step"],.iCIMS_Steps_Current');if(active&&visible(active))stage=clean(active.textContent)||stage;
  return {provider:rule.id,source:rule.source,metadata:speedyApplicationMetadata(document,rule),stage,receipt};
}

export function speedySubmissionControl(node,rule=speedyRuleForDocument(node.ownerDocument)){
  if(!rule||node.disabled||node.closest('[disabled],[aria-disabled="true"]'))return null;
  const submit=rule.submit&&node.closest(rule.submit),next=rule.next&&node.closest(rule.next);
  if(submit&&rule.id==='workable'){
    const form=submit.form||submit.closest('form');
    if(!form?.querySelector('input[type="email"],input[type="file"],input[autocomplete="given-name"],input[name="firstname"],input[name="first_name"],textarea'))return{kind:'apply',node:submit};
  }
  if(submit&&(!rule.submitText||rule.submitText.test(submit.textContent))&&(!rule.review||node.ownerDocument.querySelector(rule.review)))return{kind:'submit',node:submit};
  if(next)return{kind:'next',node:next};return null;
}
