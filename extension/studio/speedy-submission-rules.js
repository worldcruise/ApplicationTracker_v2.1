// Submission adapters ported from Baseline/SpeedyApply 2.28.2 content.js.
// source names identify the original adapter/save functions for comparison.
export const SPEEDY_SUBMISSION_RULES=[
  {id:'workday',source:'wI / xI',host:/(^|\.)myworkday(?:jobs(?:-impl)?|site)?\.com$/,submit:'button[data-automation-id="bottom-navigation-next-button"],button[data-automation-id="pageFooterNextButton"]',review:'[data-automation-id="reviewJobApplicationPage"],[data-automation-id="applyFlowReviewPage"]'},
  {id:'greenhouse',source:'oN / iN / JM / Uj',host:/(^|\.)greenhouse\.io$/,submit:'#submit_app,.application--submit button[type="submit"]',departure:5000},
  {id:'lever',source:'IN / UN',host:/(^|\.)lever\.co$/,receipt:'div.thanks',submit:'#btn-submit'},
  {id:'successfactors',source:'fF / dF',host:/(^|\.)(successfactors|sapsf)\.(com|eu)$/,receipt:'#applyConfirmMsg',submit:'span[role="button"][id*="submitBtn"],span[role="button"][id*="saveBtn"]'},
  {id:'icims',source:'SN / CN',host:/\.icims\.(com|eu)$/,receipt:'.iCIMS_SuccessMessage',receiptText:/application (?:has been|was) submitted|thank you/i},
  {id:'workable',source:'HF / qF',host:/^apply\.workable\.com$/,receipt:'[data-ui="successful-submit"]',submit:'[data-ui="apply-button"]'},
  {id:'rippling',source:'MP / OP / AP / Uj',host:/(^ats\.rippling\.com$|\.rippling-ats\.com$)/,submit:'#job-application-form button[type="submit"]',departure:5000,confirmation:'rippling'},
  {id:'breezy',source:'Kj / Qj / Uj',host:/\.breezy\.hr$/,submit:'button',submitText:/submit application/i,departure:5000},
  {id:'jazzhr',source:'wN / kN / Uj',host:/\.(applytojob|theresumator)\.com$/,submit:'#resumator-submit-resume',departure:5000},
  {id:'ashby',source:'Ej / Oj',host:/^jobs\.ashbyhq\.com$/,application:'[aria-labelledby="job-application-form"] .ashby-application-form-section-container',receipt:'h2',receiptText:/success/i,submit:'button.ashby-application-form-submit-button'},
  {id:'smartrecruiters',source:'QP / $P',host:/^jobs\.smartrecruiters\.com$/,receipt:'oc-success-page-content',submit:'[data-test="footer-submit"]',next:'[data-test="footer-next"]'},
  {id:'paylocity',source:'eP / tP',host:/^recruiting\.paylocity\.com$/,receipt:'#appSubmitResponseDiv',submit:'button[data-automation-id="btnSubmit"]',next:'button[data-automation-id="btnNext"]'},
  {id:'freshteam',source:'NM / RM',host:/\.freshteam\.com$/,receipt:'#applicant-success:not(.hide)'},
  {id:'dover',source:'_M / yM',host:/^app\.dover\.(io|com)$/,receipt:'div',receiptText:/thanks for applying!/i},
  {id:'pinpoint',source:'hP / yP',host:/\.pinpointhq\.com$/,receipt:'p',receiptText:/your application was received successfully\./i},
  {id:'comeet',source:'$j / nM',host:/^(www\.)?comeet\.co$/,receipt:'p',receiptText:/your application has been submitted/i},
  {id:'gusto',source:'sN / lN',host:/^jobs\.gusto\.com$/,receipt:'li:nth-child(3) span',receiptText:/thank you/i},
  {id:'polymer',source:'bP / SP',host:/^jobs\.polymer\.co$/,receipt:'h2',receiptText:/your application has been sent!/i},
  {id:'adp',source:'yj / Tj',host:/^workforcenow\.adp\.com$/,receipt:'#vdlContainerFluid .success-message-container',submit:'#submitApplication',next:'#ja_sv_cw_next_footer_btn'},
  {id:'jobvite',source:'AN / PN',host:/^jobs\.jobvite\.com$/,receipt:'.jv-page-applyconfirm',submit:'button[aria-label="Send Application"]',next:'button[aria-label="Next"]'},
  {id:'ultipro',source:'jF / MF',host:/\.ultipro\.(com|ca)$/,receipt:'#ApplicationSubmitted',submit:'[data-automation="btn-submit"]'},
  {id:'tesla',source:'pF / _F',host:/^(www\.)?tesla\.com$/,path:/^\/careers\/search\/job\/apply\/\d+\/?$/,receipt:'div[class*="Confirmation_"]',submit:'button[type="submit"]',next:'button[name="next"]'},
  {id:'tiktok',source:'xF / kF',host:/^(careers\.tiktok\.com|lifeattiktok\.com)$/,submit:'button[data-test="applyResumeBtn"]',confirmation:'tiktok'},
  {id:'eightfold',source:'MM / jM / TM',host:/\.eightfold\.ai$/,receipt:'[data-test-id="success-form"],h2#form-submission-success-message',submit:'[data-test-id="position-apply-button"],[data-test-id="submitApplicationButton"]'},
  {id:'seek',source:'NP / BP',host:/(^|\.)seek\.com\.au$/,receipt:'#applicationSent',submit:'button[data-testid="review-submit-application"]',next:'[data-testid="continue-button"]'},
  {id:'bamboohr',source:'Lj / zj',host:/\.bamboohr\.com$/,receipt:'a',receiptText:/see all job openings/i,submit:'button',submitText:/submit application/i},
  {id:'dayforce',source:'hM / gM',host:/\.dayforcehcm\.com$/,receipt:'div[test-id="success-dayforce-jobs"]',submit:'button[test-id="application-submit"]'},
  {id:'indeed',source:'KI',host:/^(?:[a-z]{2}\.)?smartapply\.indeed\.com$/,confirmation:'indeed'},
  {id:'linkedin',source:'eL / nL / rL',host:/(^|\.)linkedin\.com$/,receipt:'div[aria-labelledby="post-apply-modal"]',shadow:'#interop-outlet'},
  {id:'naukri',source:'iL / Uj',host:/^(www\.)?naukri\.com$/,submit:'#job_header #walkin-button,#job_header #apply-button,div.sendMsg',departure:5000},
  {id:'phenom',source:'aP / mP / Uj',selector:'head[data-ph-id]',submit:'button.btn-submit',next:'button.btn-next',departure:30000}
];

export function speedyRuleForUrl(value){try{const url=new URL(value);return SPEEDY_SUBMISSION_RULES.find(rule=>rule.host?.test(url.hostname)&&(!rule.path||rule.path.test(url.pathname)))||null;}catch{return null;}}
export function speedyRuleForDocument(document){return speedyRuleForUrl(document.location.href)||SPEEDY_SUBMISSION_RULES.find(rule=>rule.selector&&document.querySelector(rule.selector))||null;}
