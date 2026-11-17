// Application identity is separate from queue duplicate detection. A wizard's
// route may change while its employer/requisition identity stays the same.
export function applicationUrl(value){
  try{const url=new URL(value);return /^https?:$/.test(url.protocol)&&!url.username&&!url.password?url:null;}catch{return null;}
}
export function applicationPageKey(value){
  const url=applicationUrl(value);if(!url)return '';
  for(const key of [...url.searchParams.keys()])if(/^(utm_.+|jr_id|trk|trackingId|refId|referral|source)$/i.test(key))url.searchParams.delete(key);
  url.searchParams.sort();url.pathname=url.pathname.replace(/\/+$/,'')||'/';return url.href;
}
export function applicationIdentity(value){
  const url=applicationUrl(value);if(!url)return null;
  const host=url.hostname.toLowerCase(),path=url.pathname.replace(/\/+$/,''),query=(...keys)=>keys.map(key=>url.searchParams.get(key)).find(Boolean),result=(provider,tenant,id)=>id?{provider,tenant,id,key:[provider,tenant,id].join(':')}:null;
  let match;
  if(/(^|\.)smartrecruiters\.com$/.test(host)){
    match=path.match(/^\/oneclick-ui\/company\/([^/]+)\/(?:job|publication)\/([^/]+)/i);
    if(match)return result('smartrecruiters',match[1].toLowerCase(),match[2].replace(/^(\d+)-.*$/,'$1'));
    match=path.match(/^\/([^/]+)\/(\d+)(?:-[^/]*)?(?:\/.*)?$/);
    if(match)return result('smartrecruiters',match[1].toLowerCase(),match[2]);
  }
  if(/(^|\.)greenhouse\.io$/.test(host)){
    match=path.match(/^\/([^/]+)\/jobs\/([^/]+)/);return /\/embed\//.test(path)?result('greenhouse',query('for'),query('token')):match?result('greenhouse',match[1],match[2]):null;
  }
  if(/(^|\.)lever\.co$/.test(host)&&(match=path.match(/^\/([^/]+)\/([^/]+)(?:\/(?:apply|thanks))?$/)))return result('lever',host+'/'+match[1],match[2]);
  if(/(^|\.)myworkday(?:jobs(?:-impl)?|site)?\.com$/.test(host)&&(match=path.match(/^(.*?\/job\/.+?)(?:\/apply(?:\/.*)?)?$/)))return result('workday',host,match[1]);
  if(/(^|\.)icims\.com$/.test(host)&&(match=path.match(/^\/jobs\/(\d+)(?:\/|$)/)))return result('icims',host,match[1]);
  if(/(^|\.)adp\.com$/.test(host))return result('adp',host+'/'+(query('cid','client','ncsp')||path.split('/')[1]),query('jobId','jobid','reqId','_reqID','r'));
  if(/\.oraclecloud\.com$/.test(host)&&(match=path.match(/^\/hcmUI\/CandidateExperience\/([^/]+)(?:\/sites\/([^/]+))?\/(?:job|jobs\/preview)\/([^/]+)/)))return result('oracle',host+'/'+match[1]+'/'+(match[2]||'jobsearch'),match[3]);
  if(host==='apply.workable.com'&&(match=path.match(/^\/([^/]+)\/j\/([^/]+)/)))return result('workable',host+'/'+match[1],match[2]);
  if(/(^|\.)ashbyhq\.com$/.test(host)&&(match=path.match(/^\/([^/]+)\/([^/]+)/)))return result('ashby',host+'/'+match[1],match[2]);
  if(/(^|\.)linkedin\.com$/.test(host))return result('linkedin',host,query('currentJobId')||path.match(/\/jobs\/view\/(\d+)/)?.[1]);
  if(query('jobId','jobid','job_id','reqId','requisitionId','pid','token'))return result('query',url.origin+'/'+path.replace(/\/(?:apply|application|step[^/]*)\b.*$/i,'')+'/'+(query('cid','company','tenant','clientId','for')||''),query('jobId','jobid','job_id','reqId','requisitionId','pid','token'));
  match=path.match(/^(.*?\/(?:jobs?|positions?|postings?)\/[^/]+)(?:\/(?:apply|application|step[^/]*|confirmation|thanks|submitted)(?:\/.*)?)?$/i);
  if(match)return result('path',url.origin,match[1]);
  const fallback=new URL(applicationPageKey(url.href));fallback.pathname=path.replace(/\/(?:apply|application)\/?$/i,'')||'/';
  return result('page',url.origin,fallback.pathname+fallback.search+fallback.hash);
}
export function sameApplicationUrl(left,right){
  if(!applicationPageKey(left)||!applicationPageKey(right))return false;
  const a=applicationIdentity(left),b=applicationIdentity(right);return a&&b&&a.key===b.key||applicationPageKey(left)===applicationPageKey(right);
}
export function matchesApplicationSession(session,url,tabId){
  return !!session&&session.phase!=='cancelled'&&(!Number.isInteger(tabId)||session.tabId===tabId)&&[session.listingUrl,session.applicationUrl,...session.visitedUrls||[]].some(saved=>sameApplicationUrl(saved,url));
}
export function isApplicationTransition(session,url,now=Date.now()){
  const next=applicationUrl(url);if(!next)return false;
  if(matchesApplicationSession(session,url))return true;
  const intent=session.navigationIntent,previous=applicationUrl(intent?.fromUrl||session.targetUrl);
  if(!intent||!previous||now<intent.at||now-intent.at>120000)return false;
  const a=applicationIdentity(previous.href),b=applicationIdentity(next.href);
  const handoff=applicationUrl(intent.targetUrl),destination=handoff&&applicationIdentity(handoff.href);
  if(intent.kind==='apply'&&destination&&b&&destination.provider!=='page'&&destination.provider===b.provider&&destination.key!==b.key)return false;
  // An explicit Apply handoff can lead to a different ATS. Next must not bind
  // another known requisition simply because it shares the employer's host.
  if(intent.kind!=='apply'&&a&&b&&a.provider===b.provider&&a.provider!=='page'&&a.key!==b.key)return false;
  const established=[session.listingUrl,session.applicationUrl,...session.visitedUrls||[]].map(applicationIdentity).find(identity=>identity&&identity.provider!=='page'&&identity.provider===b?.provider);
  if(intent.kind!=='apply'&&established&&established.key!==b.key)return false;
  if(intent.targetUrl&&applicationPageKey(intent.targetUrl)===applicationPageKey(url))return true;
  return (previous.origin===next.origin||intent.kind==='apply'&&handoff?.origin===next.origin)&&(/\/(?:apply|application|login|signin|auth|account|questions|profile|review|step\d*|confirmation|thanks|thank-you|submitted|success|complete|jobTasks)(?:\/|$)/i.test(next.pathname)||next.pathname===previous.pathname);
}
export function confirmationRoute(value){
  const url=applicationUrl(value);return !!url&&(/\/(?:confirmation|thanks|thank-you|submitted|success|complete|completed)(?:\/|$)/i.test(url.pathname)||/\/jobTasks\/completed\/application/.test(url.pathname));
}
