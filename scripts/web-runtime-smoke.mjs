// Execute the actual packaged options bundle in an isolated DOM for runtime regressions.
// This is a Node test environment, not a browser or a replacement for Chrome visual review.
import { Window } from 'happy-dom';
import { setTimeout as delay } from 'node:timers/promises';
import { readFile } from 'node:fs/promises';
import { emptyProfile,profileToStudio } from '../extension/studio/profile-model.js';
import {IDBFactory} from 'fake-indexeddb';
import {DEFAULT_PROMPT} from '../extension/studio/prompt-repository.js';

const route = process.argv[2] || '/dashboard';
const manifest = JSON.parse(await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'));
const page = new Window({ url: `chrome-extension://web-runtime/options.html#${route}` });
page.document.body.innerHTML = '<div id="root"></div>';
const errors = [];
page.addEventListener('error', event => { errors.push(event.error?.stack || event.message); event.preventDefault(); });
process.on('unhandledRejection', error => errors.push(error?.stack || String(error)));
const originalConsoleError = console.error;
console.error = (...args) => { errors.push(args.map(arg => arg?.stack || String(arg)).join(' ')); };
for (const name of ['window','document','navigator','location','history','localStorage','sessionStorage','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','Element','Node','Event','MouseEvent','KeyboardEvent','CustomEvent','MutationObserver','ResizeObserver','DOMException','getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia']) {
  const value = name === 'window' ? page : page[name];
  Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: typeof value === 'function' && ['getComputedStyle','requestAnimationFrame','cancelAnimationFrame','matchMedia'].includes(name) ? value.bind(page) : value });
}
function event() { const callbacks = new Set(); return { addListener: fn => callbacks.add(fn), removeListener: fn => callbacks.delete(fn), emit: (...args) => callbacks.forEach(fn => fn(...args)) }; }
const changed = event();
const profile = { ...emptyProfile(), profileName: 'Default', nameData: { firstName: 'Runtime', middleName:'M', lastName: 'Candidate', preferredName: false } };
globalThis.indexedDB=new IDBFactory();
const candidate={id:'runtime-profile',revision:1,profile,document:profileToStudio(profile,'runtime-profile',{})};
const saved = { profile, appliedList: [{ jobTitle: 'Runtime Engineer', companyName: 'Example', jobLink: 'https://example.test/job', companyLink: 'https://example.test/', date: new Date().toString(), status: 'applied', profileName: 'Default' }], dailyGoal: 10, 'ui-theme:v1': 'dark' };
const legacyMeetingsKey='application-tracker:meetings:v1';
saved[legacyMeetingsKey] = { schemaVersion: 1, revision: 1, meetings: [{ id: 'runtime-meeting', title: 'Technical interview', company: 'Example', startsAt: new Date().toISOString(), stage: 'scheduled', url: '', notes: '', revision: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }] };
function storage(area) { return {
  get: (keys, callback) => { const result = keys == null ? structuredClone(saved) : Object.fromEntries((typeof keys === 'string' ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys)).filter(key => key in saved).map(key => [key, structuredClone(saved[key])])); callback?.(result); return Promise.resolve(result); },
  set: async value => { Object.assign(saved, value); changed.emit(Object.fromEntries(Object.entries(value).map(([key, newValue]) => [key, { newValue }])), area); }, remove: async () => {},
}; }
const tabActions = [];
const chrome = {
  runtime: { id: 'web-runtime', getURL: path => `chrome-extension://web-runtime/${path.replace(/^\//,'')}`, getManifest: () => manifest, onMessage: event(), onConnect: event(),
    sendMessage: async message => {
      if(message.version===1){
        const result=message.operation==='PROMPT_SETTINGS'?{candidate,candidates:[{id:candidate.id,name:candidate.document.candidate.name}],library:{revision:0,selectedId:DEFAULT_PROMPT.id,templates:[DEFAULT_PROMPT]}}:{candidate};
        return{version:1,requestId:message.requestId,ok:true,result};
      }
      return message.type === 'getSelectedProfile' ? profile : undefined;
    }, openOptionsPage: async () => {}, connect: () => ({ onMessage: event(), onDisconnect: event(), postMessage() {}, disconnect() {} }) },
  storage: { local: storage('local'), session: storage('session'), onChanged: changed },
  windows: { getCurrent: async () => ({ id: 41, type: 'normal' }) },
  tabs: { getCurrent: async () => ({ id: 100, windowId: 41, url: page.location.href }), query: async () => [{ id: 7, url: 'https://example.test/job', title: 'Runtime Engineer', active: false }], onActivated: event(), onUpdated: event(), onRemoved: event(), create: async input => { tabActions.push({ type: 'create', ...input }); return {}; }, update: async (id, input) => { tabActions.push({ type: 'update', id, ...input }); return {}; } },
  cookies: { getAll: async () => [], get: async () => null, onChanged: event() },
};
globalThis.chrome = page.chrome = chrome;
const previousMeetings = JSON.stringify(saved[legacyMeetingsKey]);
for (const stage of ["screen","interview","offer","rejected","archived"]) saved.appliedList.push({...saved.appliedList[0],jobTitle:`${stage} application`,jobLink:`https://example.test/${stage}`,status:stage});
globalThis.fetch = page.fetch = async () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
try {
  await import('../extension/chunks/options-DnVa9wE8.js');
  await delay(400);
  const scenario = process.argv[3];
  if(route==='/settings/prompts'){
    if(page.document.querySelector('.default-export-root'))throw Error('Export root must be in Other, not Prompt settings.');
    if(page.document.body.textContent.includes('Default for all profiles')||page.document.body.textContent.includes('Apply selection to'))throw Error('Prompt settings must use the single active profile.');
    if(!page.document.body.textContent.includes('Resume Prompt Template'))throw Error('Baseline resume prompt workflow is missing.');
  }
  if(route==='/settings/other'&&!page.document.querySelector('.default-export-root'))throw Error('Other must contain the default export root.');
  if(route==='/settings/profile'){
    if(!page.document.querySelector('.profile-resume-card'))throw Error('Profile must expose resume replacement.');
    if(page.document.querySelector('select[aria-label="Candidate"],#studio-candidate,#rd-candidate'))throw Error('Profile switching must not be exposed.');
  }
  function enter(node, value) {
    if (!node) throw new Error('Missing test form control.');
    const prototype = node.localName === 'select' ? page.HTMLSelectElement.prototype : node.localName === 'textarea' ? page.HTMLTextAreaElement.prototype : page.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(node, value);
    node.dispatchEvent(new page.Event(node.localName === 'select' ? 'change' : 'input', { bubbles: true }));
  }
  const button = (label, root = page.document) => [...root.querySelectorAll('button')].find(node => node.textContent === label);
  async function waitFor(read,message){
    const deadline=Date.now()+2500;
    while(Date.now()<deadline){const value=read();if(value)return value;await delay(20);}
    throw Error(message);
  }
  // Exercise the icon-only toggle through the actual web header runtime.
  const appearance = page.document.querySelector('button.web-theme-toggle');
  if (appearance?.getAttribute('aria-pressed') !== 'true') throw new Error('Theme toggle did not restore the saved appearance.');
  if (appearance.textContent.trim() || !appearance.querySelector('svg') || page.document.querySelector('.web-theme-control select')) throw new Error('Theme control must be an icon-only button.');
  let previousIcon = appearance.querySelector('path').getAttribute('d');
  for (const theme of ['light', 'dark']) {
    appearance.click(); await delay(30);
    if (page.document.documentElement.dataset.theme !== theme || saved['ui-theme:v1'] !== theme || appearance.getAttribute('aria-pressed') !== String(theme === 'dark')) throw new Error('Theme toggle and saved appearance diverged.');
    const icon = appearance.querySelector('path').getAttribute('d');
    if (icon === previousIcon || appearance.getAttribute('aria-label') !== `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`) throw new Error('Theme toggle did not update its icon and accessible label.');
    previousIcon = icon;
  }
  if (scenario === 'filters') {
    enter(page.document.querySelector('[aria-label="Application status"]'), 'interview'); await delay(30);
    if (page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Status filter did not update the application list.');
    enter(page.document.querySelector('[data-test="applications-table-filter-input"]'), 'Runtime'); await delay(30);
    if (page.document.querySelector('[aria-label="Application status"]').value !== 'interview') throw new Error('Search reset the selected status.');
    button('Clear filters').click(); await delay(30);
    if (!page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Clear filters did not restore the application.');
    enter(page.document.querySelector('[aria-label="Applied from"]'), '2030-01-01'); await delay(30);
    if (page.document.querySelector('tbody')?.textContent.includes('Runtime Engineer')) throw new Error('Date filter did not update the application list.');
    button('Clear filters').click(); await delay(30);
  }
  if(route==='/settings/other'){
    const timezone=page.document.querySelector('select[aria-label="Meeting timezone"]');
    enter(timezone,'Asia/Tokyo');await delay(30);
    if(saved['meeting-timezone:v1']!=='Asia/Tokyo')throw Error('Settings must persist the meeting timezone.');
    const meetings=[...page.document.querySelectorAll('.autofill-web-nav a')].find(node=>node.getAttribute('href')?.endsWith('#/meetings'));
    meetings.click();await waitFor(()=>page.document.querySelector('.meetings-timezone')?.value==='Asia/Tokyo','Meetings must use the timezone from Settings.');
    enter(page.document.querySelector('.meetings-timezone'),'America/Los_Angeles');
    await waitFor(()=>saved['meeting-timezone:v1']==='America/Los_Angeles','The Meetings dropdown must persist to the shared setting.');
    const settings=[...page.document.querySelectorAll('.autofill-web-nav a')].find(node=>node.getAttribute('href')?.endsWith('#/settings'));
    settings.click();
    const other=await waitFor(()=>[...page.document.querySelectorAll('a')].find(node=>node.getAttribute('href')?.endsWith('/settings/other')),'Other settings link did not mount.');
    other.click();await waitFor(()=>page.document.querySelector('select[aria-label="Meeting timezone"]')?.value==='America/Los_Angeles','Settings must reflect changes made in Meetings.');
  }

  if (scenario === 'meetings') {
    const groups=[...page.document.querySelectorAll('.meeting-board-group')].map(node=>node.dataset.group);
    if(groups.join(',')!=='active,closed,offers')throw Error('Meetings must group Screening/Interview, Rejected/Failed, then Offers.');
    if(page.document.querySelector('.meeting-round-legend,.meeting-card-footer,.meeting-interviewer,.meeting-timing'))throw Error('Removed meeting labels are still rendered.');
    await chrome.storage.local.set({'meeting-timezone:v1':'UTC'});await delay(30);
    if(page.document.querySelector('.meetings-timezone')?.value!=='UTC')throw Error('Meeting timezone must react to setting changes.');
    if(!/^\d{2}:\d{2}:\d{2}$/.test(page.document.querySelector('.meetings-clock')?.textContent))throw Error('The live clock must use 24-hour time.');
    const mockCards=()=>[...page.document.querySelectorAll('.meeting-card[data-mock="true"]')];
    if(mockCards().length!==36)throw Error('Meetings must show thirty-six mock cards.');
    const outcomes=mockCards().filter(card=>card.dataset.entityType==='application');
    if(outcomes.length!==8||outcomes.some(card=>!card.querySelector('time[aria-label="Last updated"]')||card.querySelector('a')||card.hasAttribute('data-mode')))throw Error('Outcome cards must be application records, with updated dates and no join actions.');
    if(mockCards().filter(card=>card.dataset.status==='interview').some(card=>[...card.querySelectorAll('.meeting-tag')].some(tag=>tag.textContent==='Video')))throw Error('Interviews must hide the redundant Video tag.');
    if(page.document.querySelector('[aria-label="Application status"] option[value="archived"]')?.textContent!=='Failed')throw Error('Meetings must rename the Archived filter to Failed.');
    if(mockCards().filter(card=>card.dataset.entityType==='meeting').some(card=>!card.querySelector('.meeting-result')))throw Error('Every meeting must show its result status.');
    for(const card of mockCards().filter(card=>card.dataset.entityType==='meeting'))if(!/\d{2}:\d{2}.\d{2}:\d{2}/.test(card.querySelector('.meeting-time').textContent)||/\b(?:AM|PM)\b/.test(card.textContent))throw Error('Meeting cards need 24-hour start and end times.');
    for(const [stage,count] of Object.entries({screen:10,interview:18,offer:4,rejected:2,archived:2})){
      const column=page.document.querySelector('[data-test="applications-board-column-'+stage+'"]');
      if(column.querySelectorAll('.meeting-card[data-mock="true"]').length!==count)throw Error('Wrong mock count in '+stage);
      const dates=[...column.querySelectorAll('.meeting-card[data-entity-type="meeting"]')].map(card=>Date.parse(card.dataset.startsAt)).filter(Number.isFinite);
      if(dates.some((date,index)=>index>0&&date>dates[index-1]))throw Error('Meeting columns must keep newest-first order in '+stage);
    }
    if(saved.appliedList.length!==6||saved.appliedList.some(row=>row.id?.startsWith('mock-meeting:')))throw Error('Mock meetings changed real applications.');
    if(page.document.querySelector('[data-test="applications-board-column-applied"]'))throw Error('Applied must remain absent.');
    if(page.document.querySelector('.application-progress'))throw Error('Meetings must not contain a progress chart.');
    enter(page.document.querySelector('[aria-label="Application status"]'),'interview');await delay(30);
    if(mockCards().length!==18)throw Error('Interview filtering lost its meeting cards.');
    button('Clear filters').click();await delay(30);
    const phone=page.document.querySelector('.meeting-card[data-mock="true"][data-past="false"][data-mode="phone"]');
    const originalStart=saved['meeting-mock-cards:v1'].find(row=>row.id===phone.dataset.meetingId).meeting.startsAt;
    const originals=JSON.stringify(saved['meeting-mock-cards:v1']);
    const storageSet=chrome.storage.local.set;
    chrome.storage.local.set=async()=>{throw Error('Timezone storage unavailable');};
    try{
      enter(page.document.querySelector('.meetings-timezone'),'Asia/Tokyo');
      await waitFor(()=>page.document.querySelector('[role="alert"]')?.textContent.includes('Could not save the timezone'),'Timezone save errors must be visible.');
      if(page.document.querySelector('.meetings-timezone').value!=='UTC'||page.document.querySelector('.meetings-timezone').disabled)throw Error('A failed timezone save must retain the saved selection and allow retry.');
    }finally{chrome.storage.local.set=storageSet;}
    enter(page.document.querySelector('.meetings-timezone'),'Asia/Tokyo');
    await waitFor(()=>saved['meeting-timezone:v1']==='Asia/Tokyo','The timezone dropdown did not save.');
    await waitFor(()=>phone.querySelector('.meeting-time').textContent.includes(new Intl.DateTimeFormat(undefined,{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(originalStart))),'Meeting cards did not convert to the selected timezone.');
    if(JSON.stringify(saved['meeting-mock-cards:v1'])!==originals)throw Error('Changing display timezone changed stored meetings.');
    enter(page.document.querySelector('.meetings-timezone'),'UTC');await waitFor(()=>page.document.querySelector('.meetings-timezone')?.value==='UTC','UTC was not restored.');
    const utcTime=new Intl.DateTimeFormat(undefined,{timeZone:'UTC',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(originalStart));
    if(!phone.querySelector('.meeting-time').textContent.includes(utcTime))throw Error('Card time must use the selected timezone.');
    phone.querySelector('.meeting-card-main').click();await delay(30);
    let dialog=page.document.querySelector('.meeting-dialog');
    if(!dialog?.open||!dialog.querySelector('.meeting-phone-number')?.textContent.includes('555-01'))throw Error('Phone screens must open a phone-number popup.');
    if([...dialog.querySelectorAll('button')].some(node=>node.textContent==='Previous meetings'))throw Error('Only interviews should show previous meetings.');
    button('Chat history',dialog).click();await delay(20);
    if(!dialog.querySelector('.meeting-chat-date')||!dialog.querySelector('.meeting-chat-to')?.textContent.startsWith('To:'))throw Error('Future meetings need chat history with dates, sender and recipients.');
    button('Edit meeting',dialog).click();await delay(20);
    if(dialog.querySelector('input[name="startsAt"]').value!==originalStart.slice(0,16))throw Error('Meeting editor must use the selected UTC timezone.');
    await chrome.storage.local.set({'meeting-timezone:v1':'Asia/Tokyo'});
    await waitFor(()=>dialog.querySelector('input[name="startsAt"]').value===new Date(Date.parse(originalStart)+9*3600000).toISOString().slice(0,16),'An open editor must convert its unsaved times when another tab changes timezone.');
    await chrome.storage.local.set({'meeting-timezone:v1':'UTC'});
    await waitFor(()=>dialog.querySelector('input[name="startsAt"]').value===originalStart.slice(0,16),'Editor timezone conversion shifted the meeting instant.');
    if(!dialog.querySelector('input[name="endsAt"]').value||dialog.querySelectorAll('input[name="topics"]').length!==8)throw Error('Meeting editor must include end time and every topic tag.');
    enter(dialog.querySelector('input[name="jobTitle"]'),'Updated recruiter screen');
    button('Save meeting',dialog).click();await delay(80);
    if(!saved['meeting-mock-cards:v1'].some(row=>row.jobTitle==='Updated recruiter screen'))throw Error('Meeting edits were not saved.');
    if(saved['meeting-mock-cards:v1'].find(row=>row.id===phone.dataset.meetingId).meeting.startsAt!==originalStart)throw Error('Changing timezone must not shift the saved meeting instant.');
    dialog.querySelector('[aria-label="Close meeting"]').click();await delay(20);
    page.document.querySelector('.meeting-card[data-meeting-id="mock-meeting:orbit-round-6"] .meeting-card-main').click();await delay(20);dialog=page.document.querySelector('.meeting-dialog');
    button('Previous meetings',dialog).click();await delay(20);
    if(dialog.querySelectorAll('.meeting-previous-tabs button').length!==4)throw Error('Previous meetings must include only elapsed rounds for this application.');
    dialog.querySelector('.meeting-previous-tabs button').click();await delay(20);
    if(!dialog.querySelector('[aria-label="Previous meeting transcript"]')?.textContent.includes('Candidate:'))throw Error('Previous meeting tabs must show their transcript.');
    button('Chat history',dialog).click();await delay(20);
    if(!dialog.querySelector('.meeting-conversation')?.textContent.includes('Thanks for joining')||dialog.querySelector('.meeting-conversation')?.textContent.includes('Cedar Health'))throw Error('Interview chat must include earlier rounds without leaking another application.');
    dialog.querySelector('[aria-label="Close meeting"]').click();await delay(20);
    page.document.querySelector('.meeting-card[data-meeting-id="mock-meeting:orbit"] .meeting-card-main').click();await delay(20);dialog=page.document.querySelector('.meeting-dialog');
    button('Previous meetings',dialog).click();await delay(20);
    if(!dialog.textContent.includes('No previous meetings'))throw Error('First interview needs an honest empty history view.');
    dialog.querySelector('[aria-label="Close meeting"]').click();await delay(20);
    page.document.querySelector('.meeting-card[data-status="offer"][data-mock="true"] .meeting-card-main').click();await delay(20);dialog=page.document.querySelector('.meeting-dialog');
    if(dialog.querySelector('.meeting-phone,.meeting-video')||[...dialog.querySelectorAll('button')].some(node=>['Edit meeting','Transcript'].includes(node.textContent)))throw Error('Offers must not expose meeting controls.');
    button('Chat history',dialog).click();await delay(20);
    if(!dialog.querySelector('.meeting-conversation')?.textContent.includes('offer'))throw Error('Offer records must retain application chat history.');
    dialog.querySelector('[aria-label="Close application"]').click();await delay(20);
    const video=page.document.querySelector('.meeting-card[data-mock="true"][data-past="false"][data-mode="video"]');
    if(!video.querySelector('a[href^="https://example.test/meetings/"]'))throw Error('Upcoming video meetings need their own link.');
    const past=page.document.querySelector('.meeting-card[data-mock="true"][data-past="true"]');
    past.querySelector('.meeting-card-main').click();await delay(30);dialog=page.document.querySelector('.meeting-dialog');
    if(!dialog.querySelector('[aria-label="Meeting transcript"]')?.textContent.includes('Candidate:'))throw Error('Past meetings must show their transcript.');
    button('Chat history',dialog).click();await delay(20);
    if(!dialog.querySelector('[aria-label="Application chat history"]')?.textContent.includes('Thanks for joining'))throw Error('Past meetings must show their chat history.');
    dialog.querySelector('[aria-label="Close meeting"]').click();await delay(20);
    if(saved.appliedList.length!==6||saved.appliedList.some(row=>row.jobTitle==='Updated recruiter screen'))throw Error('Editing a mock meeting changed real applications.');
    if(JSON.stringify(saved[legacyMeetingsKey])!==previousMeetings)throw Error('Retired meeting records were changed.');
    page.document.querySelector('.meeting-card[data-meeting-id="mock-meeting:riverbend"] .meeting-card-main').click();await delay(20);dialog=page.document.querySelector('.meeting-dialog');
    button('Previous meetings',dialog).click();await delay(20);
    if(dialog.querySelectorAll('.meeting-previous-tabs button').length<2||!dialog.querySelector('.meeting-result[data-result="failed"]'))throw Error('Failed records must expose the last failed interview and earlier rounds.');
    dialog.querySelector('[aria-label="Close application"]').click();await delay(20);
    page.document.querySelector('.meeting-card[data-meeting-id="mock-meeting:orbit-round-4"] .meeting-card-main').click();await delay(20);dialog=page.document.querySelector('.meeting-dialog');
    button('Edit meeting',dialog).click();await delay(20);
    enter(dialog.querySelector('select[name="result"]'),'failed');
    const beforeFailure=Date.now();button('Save meeting',dialog).click();await delay(80);
    const failedRow=saved['meeting-mock-cards:v1'].find(row=>row.id==='mock-meeting:orbit-round-4');
    if(failedRow.status!=='archived'||failedRow.meeting.result!=='failed'||Date.parse(failedRow.updatedAt)<beforeFailure)throw Error('Saving Failed must move the record and stamp its last update.');
    const failedColumn=page.document.querySelector('[data-test="applications-board-column-archived"]');
    if(!failedColumn.querySelector('.meeting-card[data-meeting-id="mock-meeting:orbit-round-4"] time[aria-label="Last updated"]'))throw Error('Failed record is missing its updated date.');
    if(mockCards().filter(card=>card.dataset.meetingId.startsWith('mock-meeting:orbit')).length!==1)throw Error('A failed application must have one outcome card while retaining its rounds in history.');
    button('Previous meetings',dialog).click();await delay(20);
    if(dialog.querySelectorAll('.meeting-previous-tabs button').length!==4||!dialog.querySelector('.meeting-result[data-result="failed"]'))throw Error('Failing an interview lost its last interview or earlier rounds.');
    button('Chat history',dialog).click();await delay(20);
    if(!dialog.textContent.includes('Thanks for joining'))throw Error('Failing an interview lost its application chat.');
    dialog.querySelector('[aria-label="Close application"]').click();await delay(20);
    const meetingsLink=[...page.document.querySelectorAll('.autofill-web-nav a')].find(node=>node.getAttribute('href')?.endsWith('#/meetings'));
    const dashboardLink=[...page.document.querySelectorAll('.autofill-web-nav a')].find(node=>node.getAttribute('href')?.endsWith('#/dashboard'));
    dashboardLink.click();await waitFor(()=>page.document.querySelector('h1')?.textContent==='Dashboard','Dashboard did not mount.');
    meetingsLink.click();await waitFor(()=>page.document.querySelector('[data-test="applications-board-column-archived"] .meeting-card[data-meeting-id="mock-meeting:orbit-round-4"]'),'Failed result did not persist after navigation.');
  }
  if(scenario==='progress'){
    if(page.document.querySelector('[data-test="applications-board"]'))throw new Error('Dashboard must not contain the board.');
    if(!page.document.querySelector('.web-dashboard-chart-card')?.nextElementSibling?.classList.contains('application-progress'))throw new Error('Progress must be directly under activity.');
    enter(page.document.querySelector('[aria-label="Progress period"]'),'total');await delay(30);
    if(!page.document.querySelector('.application-progress-svg')?.getAttribute('aria-label')?.includes('Total applied: 6'))throw new Error('Progress did not use application totals.');
  }
  if (scenario === 'navigation') {
    for (const [path, heading] of [['/meetings','Meetings'], ['/','Applications'], ['/settings','Settings'], ['/dashboard','Dashboard']]) {
      const link = [...page.document.querySelectorAll('.autofill-web-nav a')].find(node => node.getAttribute('href')?.endsWith(`#${path}`));
      if (!link) throw new Error(`Missing navigation link to ${path}.`);
      link.click();await waitFor(()=>[...page.document.querySelectorAll('h1')].some(node=>node.textContent===heading),`Clicking ${path} did not render ${heading}.`);
    }
    button('View all').click(); await delay(80);
    if (!page.document.querySelector('h1')?.textContent.includes('Applications')) throw new Error('View all did not navigate in the current page.');
    const dashboard = [...page.document.querySelectorAll('.autofill-web-nav a')].find(node => node.getAttribute('href')?.endsWith('#/dashboard'));
    dashboard.click(); await delay(80);
    button('Edit profile').click(); await delay(80);
    if (!page.location.hash.includes('/settings/profile') || !page.document.querySelector('h1')?.textContent.includes('Settings')) throw new Error('Edit profile did not stay in the current page.');
    if (tabActions.length) throw new Error('Internal navigation opened or updated a different Chrome tab.');
  }
  const text=[...page.document.querySelectorAll('select')].reduce((content,select)=>content.replace(select.textContent,select.selectedOptions[0]?.textContent||''),page.document.body.textContent);
  const result = { route, headings: [...page.document.querySelectorAll('h1,h2')].map(node => node.textContent), text: text.slice(0, 5000), applicationBoard: Boolean(page.document.querySelector('[data-test="applications-board"]')), progress: Boolean(page.document.querySelector('.application-progress')), dbButton: Boolean(page.document.querySelector('.web-header-actions button[aria-label="Connect to DB"]:disabled')), searchPlaceholder: page.document.querySelector('[data-test="applications-table-filter-input"]')?.getAttribute('placeholder'), errors };
  originalConsoleError(JSON.stringify(result));
  await page.happyDOM.abort();
  process.exit(errors.length || !page.document.getElementById('root')?.childElementCount ? 1 : 0);
} catch (error) { originalConsoleError(error); process.exit(1); }
