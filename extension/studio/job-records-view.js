import {companyInitials,companyHue} from './record-presentation.js';
import { JOB_RECORDS_MARKUP, JOB_RECORD_ICONS } from './job-records-markup.js';
import { safeJobUrl } from './reference-dashboard-data.js';
import { studioStorage } from './storage.js';
import {mountQueueResumeInput} from './queue-resume-input.js';
import {withRequestDeadline} from './request-deadline.js';
import {openSubmittedDocument} from './submitted-document-view.js';
import {openMeetingWorkflow} from './meeting-workflow-view.js';
import {openRecordDeletion,openRecordExport} from './record-delete-dialog.js';
import {downloadRecordsCsv} from './record-export.js';
import {openQueueImport} from './queue-import-dialog.js';

const labels = { applied:'Applied', screen:'Screening', interview:'Interview', offer:'Offer', rejected:'Rejected', archived:'Failed', Queued:'Queued', Generating:'Generating', Ready:'Ready', Failed:'Failed' };
const statusIcons = { applied:'check-check', screen:'scan-text', interview:'video', offer:'badge-check', rejected:'circle-x', archived:'archive', Queued:'clock-3', Generating:'loader-circle', Ready:'file-check-2', Failed:'circle-alert' };

export function mountJobRecords(host, { browser = globalThis.chrome, onDashboard = () => {}, onApply, onResumeInput, privateStorage = studioStorage, directoryStore, requestTimeoutMs=10000, stateKeyPrefix="dock-records-ui:v1", cardsOnly=false, searchQueue=false } = {}) {
  host.innerHTML = JOB_RECORDS_MARKUP;
  const root = host.querySelector('#job-records-design'), doc = host.ownerDocument, $ = selector => root.querySelector(selector);
  let alive = true, busy = false, version = 0, loaded = false, windowId, uiKey, pendingRefresh = false, persistTail = Promise.resolve(),resumeInput;
  let data = { candidate:null, applications:[], jobs:[] };
  const state = { tab:'applications', selected:null, mode:'description', editing:false, chat:false, adding:false, drafts:{}, deleted:null,query:'',layouts:{applications:'cards',queue:'cards'} };
  let pendingState=null,writingState=false,chosenTab=null,deletionDialog;
  const el = (tag, text, className) => { const node = doc.createElement(tag); if (text !== undefined && text !== null) node.textContent = text; if (className) node.className = className; return node; };
  const searchRow=el('div',null,'jr-search-row'),search=el('input');search.type='search';search.placeholder='Search company or role';search.setAttribute('aria-label','Search applications by company or role');searchRow.append(search);$('.jr-toolbar').after(searchRow);
  const layoutBar=el('nav',null,'jr-view-toolbar');layoutBar.setAttribute('aria-label','Record views');if(!cardsOnly){for(const [value,label]of [['list','List'],['cards','Cards']]){const toggle=el('button',label,'jr-layout-button');toggle.type='button';toggle.dataset.layout=value;layoutBar.append(toggle);}searchRow.before(layoutBar);}
  const toolbar=$('.jr-toolbar'),addButton=$('[data-command="add"]'),refreshButton=$('[data-command="refresh"]'),manage=$('.jr-manage'),manageButton=$('[data-command="manage"]'),manageMenu=$('.jr-manage-menu'),menuScope=host.getRootNode();
  function closeManage(){manageMenu.hidden=true;manageButton.setAttribute('aria-expanded','false');}
  const outsideManage=event=>{if(!manage.contains(event.target))closeManage();};menuScope.addEventListener('pointerdown',outsideManage);
  search.addEventListener('input',()=>{state.query=search.value;renderList();void persist();});
  const icon = name => { const holder = el('span'); holder.innerHTML = JOB_RECORD_ICONS[name] || JOB_RECORD_ICONS['circle-alert']; return holder.firstElementChild; };
  const current = () => [...data.applications,...data.jobs].find(item => item.id === state.selected);
  const format = value => { const date = new Date(value); return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined,{ month:'short',day:'numeric',hour:'numeric',minute:'2-digit' }).format(date) : 'Date unavailable'; };
  function show(message = '', error = false, undo = false) {
    if (!alive) return;
    $('#jr-feedback-text').textContent = message; $('#jr-feedback').hidden = !message;
    $('#jr-feedback').dataset.error = String(error); $('#jr-feedback').setAttribute('role',error ? 'alert' : 'status'); $('#jr-undo').hidden = !undo;
  }
  function persist() {
    if (!uiKey) return Promise.resolve();
    pendingState=structuredClone({ tab:state.tab, selected:state.selected, mode:state.mode, editing:state.editing, adding:state.adding, drafts:state.drafts, deleted:state.deleted,query:state.query,layouts:state.layouts });
    if(writingState)return persistTail;
    writingState=true;
    persistTail=(async()=>{
      while(pendingState){
        const next=pendingState;pendingState=null;
        try{await withRequestDeadline(browser.storage.session.set({[uiKey]:next}),Math.min(3000,requestTimeoutMs));}
        catch{show('Unsaved edits remain in this dock. Saving for reopening failed. Save the record before closing the dock.',true);}
      }
    })().finally(()=>{writingState=false;if(pendingState)void persist();});
    return persistTail;
  }
  async function request(operation, payload = {}) {
    const requestId = crypto.randomUUID(), reply = await withRequestDeadline(browser.runtime.sendMessage({ version:1,operation,requestId,payload }),requestTimeoutMs);
    if (!reply?.ok || reply.requestId && reply.requestId !== requestId) throw Object.assign(new Error(reply?.error?.message || 'The dock could not reach its saved records. Try refreshing.'),{ code:reply?.error?.code });
    return reply.result;
  }
  function setBusy(value) {
    busy = value; root.setAttribute('aria-busy',String(value));
    root.querySelectorAll('button').forEach(button => { if(!button.closest('.meeting-workflow,.record-delete-dialog'))button.disabled = button.dataset.command==='dashboard'?false:value; });
    $('[data-command="delete-records"]').disabled=value||!(state.tab==='queue'?data.jobs:data.applications).length;
    $('[data-command="export-records"]').disabled=value||!(state.tab==='queue'?data.jobs:data.applications).length;
    root.querySelectorAll('[data-unavailable="true"]').forEach(button=>{button.disabled=true;});
    if(!value)resumeInput?.sync();
  }
  async function run(action) {
    if (busy || !loaded) return;
    setBusy(true); show('');
    try { await action(); }
    catch (error) { show(error.message,true); }
    finally {
      if (alive) { setBusy(false); if (pendingRefresh) { pendingRefresh = false; void refresh(); } }
    }
  }
  async function refresh() {
    if (busy) { pendingRefresh = true; return; }
    const revision = ++version;
    try { const next = await request('DOCK_RECORDS_STATE'); if (alive && revision === version) { data = next; render(); } }
    catch (error) { if (alive && revision === version) show(error.message,true); }
  }
  async function mutate(action, record, fields, extra = {}) {
    const next = await request('DOCK_RECORDS_MUTATE',{ action,type:record?.type || 'queue',id:record?.id,expectedRevision:record?.revision,fields,mutationId:crypto.randomUUID(),...extra });
    data = next; return next;
  }
  function badge(status) { const node = el('span',null,`jr-status ${status === 'screen' ? 'screening' : status.toLowerCase()}`); node.append(icon(statusIcons[status]),doc.createTextNode(labels[status] || status)); return node; }
  function button(label, command, glyph, className = '', record) {
    const node = el('button',null,className || 'jr-button'); node.type = 'button'; node.dataset.command = command;
    if (record) node.dataset.record = record.id;
    if (glyph) node.append(icon(glyph)); node.append(doc.createTextNode(label)); return node;
  }
  function action(record, command, glyph, label, danger = false) {
    const node = button('',command,glyph,`jr-icon${danger ? ' danger' : ''}`,record); node.setAttribute('aria-label',`${label} · ${record.company}`); node.title = label; return node;
  }
  function recordActions(record, rail = false) {
    const nodes = [], queue = record.type === 'queue';
    const add = (label, command, glyph, danger = false) => nodes.push(rail ? action(record,command,glyph,label,danger) : button(label,command,glyph,`jr-button${danger ? ' danger' : ''}`,record));
    if (rail) add('View job description','description','scan-text');
    add('Update record','edit','square-pen');
    if (!rail) {
      const edit=nodes.at(-1);edit.setAttribute('aria-pressed',String(state.editing));edit.setAttribute('aria-controls','jr-edit-form');
    }
    if (record.url) add('Go to apply','apply','arrow-up-right');
    if (!queue&&record.conversationUrl) add('Open GPT conversation','chat','messages-square');
    if (queue) add('Delete','delete','trash-2',true);
    return nodes;
  }
  function renderList() {
    const list = $('#jr-list'); list.replaceChildren();
    const query=state.tab==='applications'||searchQueue?state.query:'',normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase(),terms=normalize(query).trim().split(/\s+/);
    const records = (state.tab === 'queue' ? data.jobs : data.applications).filter(record=>terms.every(term=>normalize(`${record.company} ${record.role}`).includes(term))).slice().sort((a,b) => (Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0));
    list.classList.add('jr-card-list');
    if (!records.length) { const empty = el('div',null,'jr-empty'); empty.append(icon('inbox'),el('span',query?'No matching records. Try another company or role.':state.tab === 'queue' ? 'No jobs in this queue. Use Add manually to add a job.' :'No recorded applications yet.')); list.append(empty); }
    const tabular=!cardsOnly&&state.layouts?.[state.tab]==='list';let tableRows;
    if(tabular&&records.length){const table=el('table',null,'jr-record-table'),heading=el('thead'),row=el('tr');table.setAttribute('aria-label',state.tab==='queue'?'Job queues':'Applications');for(const label of ['Company','Role','Salary','Status','Updated','JD','Resume','Cover letter','Actions']){const cell=el('th',label);cell.scope='col';row.append(cell);}heading.append(row);tableRows=el('tbody');table.append(heading,tableRows);list.append(table);}
    for (const record of records) {
      const queue=record.type==='queue',card = el('article',null,`jr-record jr-compact-record${queue?' jr-queue-record':' jr-application-record'}`); card.dataset.id = record.id; card.setAttribute('aria-label',`${record.company} · ${record.role} · ${labels[record.status] || record.status}`);
      const head = el('div',null,'jr-record-head'), company = el('div',null,'jr-company'), stamp = el('div',null,'jr-stamp');
      const logo=el('span',companyInitials(record.company),'company-logo');logo.style.setProperty('--company-hue',companyHue(record.company));company.append(logo,el('h3',record.company),el('p',record.role));
      head.classList.add('jr-card-main');head.setAttribute('role','button');head.tabIndex=0;head.dataset.command='details';head.dataset.record=record.id;head.setAttribute('aria-label',`View details for ${record.role} at ${record.company}`);
      company.append(el('p',record.salary||'Salary not listed','jr-card-salary'));
      const time = el('time',`Updated ${format(record.updatedAt)}`,'jr-updated'); if (Number.isFinite(Date.parse(record.updatedAt))) time.dateTime = new Date(record.updatedAt).toISOString();
      const status=el('div',null,'jr-queue-status');status.append(badge(record.status));
      stamp.append(status,time);head.append(company,stamp); card.append(head);
      if (record.status === 'Failed') card.append(el('p',record.error || 'Resume preparation failed. Retry when ready.','jr-error'));
      if (state.drafts[record.id]) card.append(el('p','Unsaved edits kept in this dock','jr-unsaved'));
      const footer = el('div',null,'jr-record-actions');footer.setAttribute('role','group');footer.setAttribute('aria-label',`Actions for ${record.company}`);
      const resume=button('Resume','open-resume','file-text','jr-button',record),letter=button('Cover letter',queue?'cover-letter':'application-letter','file-text','jr-button',record);
      resume.disabled=!record.resume?.snapshot;resume.dataset.unavailable=String(resume.disabled);resume.title=resume.disabled?(queue?'Create a resume using Update first.':'No resume was saved with this application.'):(queue?'Open saved resume':'View submitted resume');
      letter.disabled=!(record.coverLetterEnabled??record.resume?.coverLetterEnabled)||!(record.coverLetterRaw??record.resume?.coverLetterRaw)?.trim();letter.dataset.unavailable=String(letter.disabled);letter.title=letter.disabled?(queue?'Create and save a cover letter using Update first.':'No cover letter was submitted.'):(queue?'Open saved cover letter':'View submitted cover letter');
      const update=button('Update',queue?'update-resume':'screening','square-pen','jr-button',record);if(!queue)update.title='Update application';update.setAttribute('aria-label','Update');
      footer.append(resume,letter,update,button('Delete','delete','trash-2','jr-button danger',record));
      card.append(footer);
      if(tabular){
        const row=el('tr',null,card.className+' jr-table-row');row.dataset.id=record.id;row.setAttribute('aria-label',card.getAttribute('aria-label'));
        const companyButton=button(record.company,'details','','jr-table-main jr-card-main',record);companyButton.prepend(logo);
        const roleButton=button(record.role,'details','','jr-table-main',record),jd=button('JD','description','file-text','jr-button',record);
        const controls=el('div',null,'jr-record-actions');controls.append(update,footer.querySelector('[data-command="delete"]'));
        time.textContent=format(record.updatedAt);
        for(const item of [companyButton,roleButton,el('span',record.salary||'Salary not listed'),status,time,jd,resume,letter,controls]){const cell=el('td');cell.append(item);row.append(cell);}tableRows.append(row);
      }else list.append(card);
    }
  }
  function field(container, label, value) { const row = el('div',null,'jr-field'); row.append(el('span',label),el('span',value)); container.append(row); }
  function renderDescription(record) {
    const target=$('#jr-description-content');target.replaceChildren();$('#jr-description-kind').replaceChildren(icon('scan-text'),doc.createTextNode('Job description'));
    const url=safeJobUrl(record.url);if(url){const link=el('a',undefined,'jr-source-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.append(icon('arrow-up-right'),doc.createTextNode('Open original listing'));target.append(link);}
    target.append(el('div',record.description||'No job description is saved for this record.','jr-description-copy'));
  }
  function formFields(record) { return { salary:record.salary||'',notes:record.notes||'',...(record.type==='queue'?{cvJsonRaw:record.resume?.cvJsonRaw||'',coverLetterRaw:record.coverLetterRaw??record.resume?.coverLetterRaw??'',coverLetterEnabled:record.coverLetterEnabled??!!record.resume?.coverLetterEnabled}:{}),description:record.description || '',url:record.url || '',conversationUrl:record.conversationUrl || '',status:record.status }; }
  function draftFor(record) {
    const draft=state.drafts[record.id] || { revision:record.revision, fields:formFields(record) };
    if(record.type==='queue')return draft;
    const {cvJsonRaw,coverLetterRaw,coverLetterEnabled,...fields}=draft.fields;return {...draft,fields};
  }
  const urlLabel = el('label'); urlLabel.append(el('span','Job URL','jr-label')); const urlInput = el('input'); urlInput.id = 'jr-job-url'; urlInput.className = 'jr-select'; urlInput.type = 'url'; urlInput.required = true; urlLabel.append(urlInput);
  const chatLabel = el('label'); chatLabel.append(el('span','AI conversation URL (optional)','jr-label')); const chatInput = el('input'); chatInput.id = 'jr-conversation-url'; chatInput.className = 'jr-select'; chatInput.type = 'url'; chatInput.placeholder = 'https://chatgpt.com/c/…'; chatLabel.append(chatInput);
  const salaryLabel=el('label');salaryLabel.append(el('span','Salary (optional)','jr-label'));const salaryInput=el('input');salaryInput.id='jr-salary';salaryInput.className='jr-select';salaryInput.maxLength=200;salaryInput.placeholder='e.g. $100,000-$130,000 / year';salaryLabel.append(salaryInput);$('#jr-resume-input').closest('label').after(salaryLabel);
  const submittedDocuments=el('section',null,'jr-submitted-documents');$('#jr-description-pane').prepend(submittedDocuments);
  $('#jr-edit-form').insertBefore(urlLabel,$('#jr-job-description-field'));
  $('#jr-edit-form').insertBefore(chatLabel,$('#jr-edit-form .jr-detail-actions'));
  const unsaved = el('p','Edits are kept when switching dock tabs. Save update to commit them.','jr-unsaved'); $('#jr-edit-form').append(unsaved);
  $('#jr-edit-form [data-command="cancel-edit"]').textContent = 'Discard edits';
  function renderDetail(record) {
    $('#jr-back-label').textContent = record.type === 'queue' ? 'Job Queues' : 'Applications'; $('#jr-record-number').textContent = record.id.slice(0,16);
    $('#jr-detail-company').textContent = record.company; $('#jr-detail-role').textContent = record.role; $('#jr-detail-updated').textContent = `Updated ${format(record.updatedAt)}`;
    if(!['description','details'].includes(state.mode))state.mode='description';
    $('#jr-view-description').textContent=record.type==='queue'?'Job description':'Application';
    const readyStatus=$('#jr-detail-status');readyStatus.hidden=true;readyStatus.replaceChildren(...record.status==='Ready'?[badge('Ready')]:[]);
    if(Number.isFinite(Date.parse(record.updatedAt)))$('#jr-detail-updated').dateTime=new Date(record.updatedAt).toISOString();else $('#jr-detail-updated').removeAttribute('datetime');
    for (const mode of ['description','details']) { const selected = state.mode === mode; $(`#jr-view-${mode}`).setAttribute('aria-selected',String(selected)); $(`#jr-view-${mode}`).tabIndex = selected ? 0 : -1; $(`#jr-${mode}-pane`).hidden = !selected; }
    $('#jr-detail-candidate').textContent = `Candidate: ${record.candidateName || data.candidate?.name || ''}`;
    $('#jr-read-view').hidden = true; $('#jr-edit-form').hidden = state.chat;
    $('#jr-edit-form').querySelectorAll('input,textarea,select').forEach(control=>control.disabled=!state.editing);
    $('#jr-edit-form .jr-detail-actions').hidden=record.type==='queue'||!state.editing;unsaved.hidden=!state.editing&&!state.drafts[record.id]; $('#jr-chat-panel').hidden = !state.chat;
    unsaved.textContent=state.editing?'Edits are kept when switching dock tabs. Save update to commit them.':'Unsaved edits are kept. Turn on Update record to continue editing or save them.';
    const templateName = record.resume?.documentTemplate.id.replace(/^rendercv-/,'').replace(/[-_]/g,' ').replace(/\b\w/g,value => value.toUpperCase());
    const fields = $('#jr-record-fields'); fields.replaceChildren(); field(fields,'Record type',record.type === 'queue' ? 'Job Queue' : 'Application'); field(fields,'Status',labels[record.status]||record.status); field(fields,'Candidate',record.candidateName); field(fields,'Resume',record.resume ? `${templateName} · Version ${record.resume.version}` : 'No saved resume'); field(fields,'Created',format(record.createdAt));
    if (record.type === 'queue') { field(fields,'Attempt',String(record.attempt || 0)); field(fields,'Workflow','Manual preparation in Resume Studio'); field(fields,'Prompt at capture',record.promptSnapshot?.title || 'Assigned prompt'); }
    $('#jr-record-note').textContent = record.notes || 'No notes yet.';    const actions=recordActions(record),edit=actions.find(node=>node.dataset.command==='edit');
    if(state.editing){edit.replaceChildren(icon('save'),doc.createTextNode('Save record'));edit.type='submit';edit.setAttribute('form','jr-edit-form');delete edit.dataset.command;edit.removeAttribute('aria-pressed');edit.classList.add('primary');}
    $('#jr-edit-slot').replaceChildren(edit);
    if(record.type==='queue'){
      const applied=button('Mark as applied','mark-applied','check-check','jr-button',record),unavailable=state.editing||!!state.drafts[record.id]||!safeJobUrl(record.url);
      applied.disabled=unavailable;applied.dataset.unavailable=String(unavailable);applied.title=unavailable?'Save your edits before marking this job applied.':'Move this job and its saved documents to Applications';$('#jr-edit-slot').append(applied);
    }
    $('.jr-detail-navigation').classList.toggle('jr-editing',state.editing);
    $('#jr-detail-actions').replaceChildren(...actions.filter(node=>node!==edit&&(record.type!=='queue'||['apply','delete'].includes(node.dataset.command))));
    const timeline = $('#jr-timeline'); timeline.replaceChildren();
    for (const event of record.events || []) { const item = el('div',null,'jr-timeline-item'), text = el('div'); text.append(el('p',event.label),el('time',format(event.at))); item.append(el('span',null,'jr-history-dot'),text); timeline.append(item); }
    const queue = record.type === 'queue';salaryLabel.hidden=false;urlInput.required=queue; $('#jr-status-field').hidden = queue || !state.editing; $('#jr-queue-status-field').hidden = true; $('#jr-job-description-field').hidden = !queue; urlLabel.hidden = !queue; $('#jr-queue-status-text').textContent = record.status;
    const select = $('#jr-status-select'); select.replaceChildren(); for (const status of ['applied','screen','interview','offer','rejected','archived']) { const option = el('option',labels[status]); option.value = status; select.append(option); }
    const draft = draftFor(record);salaryInput.value=draft.fields.salary??record.salary??''; $('#jr-resume-input').value=draft.fields.cvJsonRaw??record.resume?.cvJsonRaw??'';$('#jr-letter-input').value=draft.fields.coverLetterRaw??record.resume?.coverLetterRaw??'';$('#jr-letter-enabled').checked=!!draft.fields.coverLetterEnabled; $('#jr-job-description').value = draft.fields.description; urlInput.value = draft.fields.url; chatInput.value = draft.fields.conversationUrl; select.value = draft.fields.status;
    for(const selector of ['#jr-resume-input','#jr-letter-input','#jr-letter-enabled']){const control=$(selector);control.disabled=!queue||!state.editing;control.closest('label').hidden=!queue;}
    submittedDocuments.hidden=queue;submittedDocuments.replaceChildren();
    if(!queue){
      submittedDocuments.append(el('h3','Submitted documents'),el('p','Saved with this application. Documents can be edited only in Job Queues.','jr-document-note'));
      const actions=el('div',null,'jr-submitted-actions');
      for(const [label,command,available]of [['Resume','open-resume',!!record.resume?.snapshot],['Cover letter','application-letter',!!record.coverLetterEnabled&&!!record.coverLetterRaw?.trim()]]){
        if(label==='Cover letter'&&!available)continue;const view=button(label,command,'file-text','jr-button',record);view.disabled=!available;view.dataset.unavailable=String(!available);view.title=available?`View submitted ${label.toLowerCase()}`:`No ${label.toLowerCase()} was saved with this application.`;actions.append(view);
      }
      submittedDocuments.append(actions);
    }
    $('#jr-chat-error').hidden = !record.error; $('#jr-chat-error').textContent = record.error || '';
    $('#jr-chat-context').textContent = record.conversationUrl || 'Save a GPT conversation link in Update record to reopen it here.';
    $('#jr-retry-task').hidden = !queue || record.status !== 'Failed'; renderDescription(record);
  }
  let addForm;
  function renderAdd() {
    addForm?.remove(); addForm = undefined;
    if (!state.adding) return;
    addForm = el('form',null,'jr-add-form'); addForm.id = 'jr-add-form'; addForm.append(el('h3',state.tab==='applications'?'Add application record manually':'Add job to queue'));
    const draft = state.drafts.$new?.fields || {};
    for (const [name,label,type,required,max] of [['company','Company','text',true,300],['role','Role','text',true,500],['salary','Salary (optional)','text',false,200],['url','Job URL','url',true,4000],['description','Job description','textarea',true,160000],['notes','Notes','textarea',false,10000],['conversationUrl','AI conversation URL (optional)','url',false,4000]]) {
      if(name==='salary'&&state.tab!=='queue')continue;
      const wrapper = el('label'); const caption=el('span',label,'jr-label');if(required&&(state.tab!=='applications'||['company','role'].includes(name))){const star=el('span','*','jr-required');star.setAttribute('aria-hidden','true');caption.append(star);}wrapper.append(caption); const control = el(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') control.type = type; else { control.rows = name === 'description' ? 6 : 3; control.className = 'jr-textarea'; }
      control.name = name; control.value = draft[name] || ''; control.required = required&&(state.tab!=='applications'||['company','role'].includes(name)); control.maxLength = max; wrapper.append(control); addForm.append(wrapper);
    }
    const actions = el('div',null,'jr-detail-actions'), save = button(state.tab==='applications'?'Add application record':'Add to queue','','plus','jr-button primary'); save.type = 'submit'; actions.append(save,button('Cancel','cancel-add')); addForm.append(actions);
    $('#jr-body-anchor')?.remove(); $('#jr-main-panel').prepend(addForm);
  }
  function render(force = false) {
    if (!alive) return;
    const applications=state.tab==='applications';root.dataset.tab=state.tab;root.dataset.layout=cardsOnly?'cards':state.layouts?.[state.tab]||'cards';layoutBar.hidden=!!state.selected||state.adding;for(const toggle of layoutBar.querySelectorAll('button'))toggle.setAttribute('aria-pressed',String(toggle.dataset.layout===root.dataset.layout));
    const actionRow=applications||searchQueue?searchRow:toolbar;
    if(manage.parentElement!==actionRow)actionRow.append(manage,refreshButton);
    addButton.setAttribute('aria-label',applications?'Add application':'Add job manually');
    $('[data-command="export-records"]').hidden=false;$('[data-command="import-records"]').hidden=false;
    $('#jr-app-count').textContent = String(data.applications.length); $('#jr-queue-count').textContent = String(data.jobs.length);
    for (const tab of ['applications','queue']) { const selected = state.tab === tab; $(`[data-tab="${tab}"]`).setAttribute('aria-selected',String(selected)); $(`[data-tab="${tab}"]`).tabIndex = selected ? 0 : -1; }
    $('#jr-main-panel').setAttribute('aria-labelledby',state.tab === 'queue' ? 'jr-tab-queue' : 'jr-tab-applications');
    $('[data-command="delete-records"]').disabled=busy||!(applications?data.applications:data.jobs).length;
    $('[data-command="export-records"]').disabled=busy||!(applications?data.applications:data.jobs).length;
    if (!force && (state.editing || state.adding)) return;
    const record = current(); if (!record) { state.selected = null; state.editing = false; state.chat = false; }
    $('#jr-list').hidden = !!state.selected || state.adding; $('#jr-detail').hidden = !state.selected || state.adding;
    toolbar.hidden = applications || searchQueue || !!state.selected || state.adding;
    searchRow.hidden=(!applications&&!searchQueue)||!!state.selected||state.adding;search.value=state.query||'';
    search.setAttribute('aria-label',`Search ${applications?'applications':'job queues'} by company or role`);
    renderAdd(); if (record && !state.adding) renderDetail(record); else if (!state.adding) renderList();
  }
  async function command(name, record) {
    if (name === 'refresh') { data = await request('DOCK_RECORDS_STATE'); render(true); return; }
    if(name==='export-records'){deletionDialog=await openRecordExport(root,{type:state.tab,browser,onExport:(targets,options)=>{const result=downloadRecordsCsv(targets,options);show(`Exported ${result.count} ${state.tab==='queue'?'queue jobs':'applications'}.`);return result;}});return;}
    if(name==='import-records'){deletionDialog=openQueueImport(root,{type:state.tab,browser,onImported:(next,message)=>{data=next;render(true);show(message);}});return;}
    if (name === 'delete-records') {
      deletionDialog=await openRecordDeletion(root,{type:state.tab,browser,onDeleted:async(next,count)=>{
        data=next;state.selected=null;state.editing=false;state.deleted=null;
        await persist();render(true);show(`${count} ${state.tab==='queue'?'queue jobs':'applications'} deleted.`);
      }});return;
    }
    if (name === 'add' || name === 'cancel-add') { state.adding = name === 'add'; if (!state.adding) delete state.drafts.$new; state.editing = false; state.selected = null; await persist(); render(true); return; }
    if (name === 'undo-delete') {
      if (!state.deleted) return; const type=state.deleted.type,restored = await mutate('restore',state.deleted); state.deleted = null; state.selected = restored.selectedId; state.tab = type==='applications'?'applications':'queue'; await persist(); render(true); show(type==='applications'?'Application restored.':'Job restored.'); return;
    }
    if (name === 'back') { state.selected = null; state.editing = false; state.chat = false; await persist(); render(true); return; }
    if (!record) return;
    if(name==='details'){state.selected=record.id;state.tab=record.type==='queue'?'queue':'applications';state.mode='details';state.editing=false;state.adding=false;state.chat=false;await persist();render(true);$('#jr-view-details').focus();return;}
    if(name==='screening'){
      if(record.workflowApplicationId){openMeetingWorkflow(root,{browser,applicationId:record.workflowApplicationId,onSaved:()=>refresh()});return;}
      await command('edit',record);$('#jr-status-select').focus();return;
    }
    if(name==='application-letter'){
      openSubmittedDocument(root,record,'letter',{browser});return;
    }
    if(name==='update-resume'||name==='cover-letter'){const options={letter:name==='cover-letter'};if(onResumeInput)await onResumeInput(record,options);else await resumeInput.open(record,options);return;}
    if (name === 'edit') {
      state.editing=true;state.selected=record.id;state.tab=record.type==='queue'?'queue':'applications';state.mode='details';state.chat=false;
      render(true);$('#jr-edit-slot button').focus();void persist();return;
    }
    if (['view','description','edit','chat'].includes(name)) {
      state.selected = record.id; state.tab = record.type === 'queue' ? 'queue' : 'applications'; state.mode = ['edit','chat'].includes(name) ? 'details' : 'description'; state.chat = false; state.editing = name === 'edit';
      if (name === 'chat') { if (!record.conversationUrl) throw Error('Save a GPT conversation URL in Update record first.'); await browser.tabs.create({ url:record.conversationUrl,active:true }); }
      await persist(); render(true); return;
    }
    if (name === 'cancel-edit') { delete state.drafts[record.id]; state.editing = false; await persist(); render(true); return; }
    if (name === 'apply') { if(record.type==='queue'&&onApply){await persist();await onApply(record.id);return;} if (!safeJobUrl(record.url)) throw Error('This record has no valid application URL.'); await browser.tabs.create({ url:record.url,active:true }); return; }
    if(name==='open-resume'){
      if(record.type==='applications'){openSubmittedDocument(root,record,'resume');return;}
      await persist();data=await request('DOCK_RECORDS_OPEN_RESUME',{id:record.id,type:record.type,expectedRevision:record.revision,windowId});render(true);return;
    }
    if (name === 'studio' || name === 'save-resume') {
      data = await request(name === 'studio' ? 'DOCK_RECORDS_STUDIO' : 'DOCK_RECORDS_RESUME',{ id:record.id,expectedRevision:record.revision,windowId });
      state.selected = record.id; render(true); show(name === 'studio' ? 'Prepare this resume in Resume Studio, then return here and choose Save Studio result.' : 'Validated resume saved. Review it before applying.'); return;
    }
    const actions = { retry:'retry',delete:'delete',fail:'fail','mark-applied':'apply' };
    if (actions[name]) {
      const result = await mutate(actions[name],record,undefined,name==='mark-applied'?{submissionConfirmed:true}:{});
      if (name === 'delete') { const deleted = result.deletedRecord||{ ...record,revision:record.revision + 1 }; state.deleted = deleted; state.selected = null; }
      else { state.selected = result.selectedId; if (name === 'mark-applied') state.tab = 'applications'; }
      if(name==='mark-applied')delete state.drafts[record.id];
      state.editing = false; await persist(); render(true); show(name === 'delete' ? `${record.company} removed from ${record.type==='applications'?'Applications':'Job Queues'}.` : name === 'mark-applied' ? 'Submission recorded in Applications.' : 'Queue record updated.',false,name === 'delete');
    }
  }
  function click(event) {
    const target = event.target.closest('button,.jr-card-main'); if (!target || !root.contains(target)) return;
    if(target.dataset.command==='dashboard'){
      onDashboard();void persist().catch(error=>show(`Dashboard opened. Unsaved edits remain in this dock: ${error.message}`,true));return;
    }
    if(target.disabled)return;
    if(target.dataset.command==='manage'){manageMenu.hidden=!manageMenu.hidden;manageButton.setAttribute('aria-expanded',String(!manageMenu.hidden));if(!manageMenu.hidden)addButton.focus();return;}
    if(target.closest('.jr-manage-menu'))closeManage();
    if(target.dataset.layout){state.layouts={...state.layouts,[state.tab]:target.dataset.layout};render(true);void persist();return;}
    if(target.dataset.tab){
      if(busy)return;chosenTab=target.dataset.tab;state.tab=chosenTab;state.selected=null;state.editing=false;state.chat=false;state.adding=false;render(true);target.focus();void persist();return;
    }
    if (target.dataset.mode) { void run(async () => { state.mode = target.dataset.mode; await persist(); render(true); target.focus(); }); return; }
    if (target.dataset.command) void run(() => command(target.dataset.command,target.dataset.record ? [...data.applications,...data.jobs].find(item => item.id === target.dataset.record) : current()));
  }
  function input(event) {
    if (!loaded || busy) return;
    if (event.target.closest('#jr-add-form')) {
      const fields = {}; for (const control of addForm.querySelectorAll('[name]')) fields[control.name] = control.value;
      state.drafts.$new = { fields }; void persist().catch(() => {}); return;
    }
    if (!state.editing || !event.target.closest('#jr-edit-form')) return;
    const record = current(); if (!record) return;
    state.drafts[record.id] = { revision:draftFor(record).revision, fields:{ salary:salaryInput.value,notes:record.notes||'',...(record.type==='queue'?{cvJsonRaw:$('#jr-resume-input').value,coverLetterRaw:$('#jr-letter-input').value,coverLetterEnabled:$('#jr-letter-enabled').checked}:{}),description:$('#jr-job-description').value,url:urlInput.value,conversationUrl:chatInput.value,status:$('#jr-status-select').value } };
    void persist().catch(() => {});
  }
  function submit(event) {
    if (!['jr-add-form','jr-edit-form'].includes(event.target.id)) return;
    event.preventDefault();
    void run(async () => {
      if (event.target.id === 'jr-add-form') {
        const fields = {}; for (const control of addForm.querySelectorAll('[name]')) fields[control.name] = control.value;
        const result = await mutate(state.tab==='applications'?'create-application':'create',null,fields); delete state.drafts.$new; state.adding = false; state.selected = result.selectedId;state.mode='description';
      } else {
        if (!state.editing) return;
        const record = current(); if (!record) throw Error('This record is no longer available. Your form text is retained.');
        const draft = draftFor(record), result = await mutate('update',{ ...record,revision:draft.revision },draft.fields); delete state.drafts[record.id]; state.selected = result.selectedId; state.editing = false;
      }
      await persist(); render(true); show('Record saved.');
    });
  }
  function keydown(event) {
    if(event.key==='Escape'&&!manageMenu.hidden){event.preventDefault();event.stopPropagation();closeManage();manageButton.focus();return;}
    if(event.key==='Escape'&&!event.isComposing&&!event.defaultPrevented&&state.editing&&current()?.type==='queue'&&!root.querySelector('dialog[open]')){
      if(busy)return;
      event.preventDefault();event.stopPropagation();
      delete state.drafts[current().id];state.editing=false;render(true);void persist();
      $('#jr-edit-slot button').focus();show('Edits discarded.');return;
    }
    const main=event.target.closest('.jr-card-main');if(main&&['Enter',' '].includes(event.key)){event.preventDefault();main.click();return;}
    const tab = event.target.closest('[role="tab"]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const siblings = [...tab.parentElement.querySelectorAll('[role="tab"]')], index = siblings.indexOf(tab);
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + siblings.length) % siblings.length;
    siblings[next].click(); siblings[next].focus();
  }
  const changed = (changes, area) => {
    if (area === 'local' && (changes.appliedList || changes.profile || changes['application-meetings:v1'] || changes['meeting-application-overrides:v1'] || changes['meeting-application-documents:v1'])) void refresh();
  };
  root.addEventListener('click',click); root.addEventListener('input',input); root.addEventListener('change',input); root.addEventListener('submit',submit); root.addEventListener('keydown',keydown);
  browser.storage.onChanged.addListener(changed);
  const privateChanged = changes => { if (changes['dock-job-records:v1']) void refresh(); };
  privateStorage.onChanged.addListener(privateChanged);
  resumeInput=mountQueueResumeInput(root,{request,privateStorage,directoryStore,getWindowId:()=>windowId,icons:JOB_RECORD_ICONS,onUpdated(next){data=next;render(true);}});
  const ready = (async () => {
    try {
      windowId = (await withRequestDeadline(browser.windows.getCurrent(),requestTimeoutMs)).id; uiKey = `${stateKeyPrefix}:${windowId}`;
      const previous = (await withRequestDeadline(browser.storage.session.get(uiKey),requestTimeoutMs))[uiKey];
      if (!alive) return;
      if (previous && ['applications','queue'].includes(previous.tab)) Object.assign(state,previous,{ chat:false,drafts:previous.drafts || {} });
      if(chosenTab)state.tab=chosenTab;
      state.mode=state.editing?'details':'description';
      data = await request('DOCK_RECORDS_STATE'); loaded = true; render(true);
    } catch (error) { loaded = true; render(true); show(error.message,true); }
  })();
  return { root, ready, refresh,setLayout(layout){state.layouts={...state.layouts,[state.tab]:layout==='list'?'list':'cards'};render(true);void persist();}, async select(id) { await ready;await refresh();const record=[...data.applications,...data.jobs].find(record=>record.id===id);if(record){state.tab=record.type==='queue'?'queue':'applications';state.selected=id;state.mode='description';state.editing=false;state.adding=false;state.chat=false;render(true);} }, async show(tab, matchUrl,{restore=false}={}) { await ready; if (tab&&(!restore||state.tab!==tab)) { state.tab = tab; state.selected = null; state.editing = false; state.adding = false; } await refresh(); if (matchUrl) { const match = data.applications.find(record => record.url === matchUrl); if (match) { state.selected = match.id; state.mode = 'description'; render(true); } } },
    async editResume(id,options){await ready;await refresh();const record=data.jobs.find(item=>item.id===id);if(!record)throw Error('This queue record is no longer available.');await resumeInput.open(record,options);},
    close() { alive = false; version++;deletionDialog?.close();menuScope.removeEventListener('pointerdown',outsideManage);resumeInput.close(); void persist().catch(() => {}); root.removeEventListener('click',click); root.removeEventListener('input',input); root.removeEventListener('change',input); root.removeEventListener('submit',submit); root.removeEventListener('keydown',keydown); browser.storage.onChanged.removeListener(changed); privateStorage.onChanged.removeListener(privateChanged); } };
}
