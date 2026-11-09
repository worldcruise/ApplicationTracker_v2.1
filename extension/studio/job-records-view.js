import { JOB_RECORDS_MARKUP, JOB_RECORD_ICONS } from './job-records-markup.js';
import { safeJobUrl } from './reference-dashboard-data.js';
import { studioStorage } from './storage.js';
import {mountQueueResumeInput} from './queue-resume-input.js';

const labels = { applied:'Applied', screen:'Screening', interview:'Interview', offer:'Offer', rejected:'Rejected', archived:'Archived', Queued:'Queued', Generating:'Generating', Ready:'Ready', Failed:'Failed' };
const statusIcons = { applied:'check-check', screen:'scan-text', interview:'calendar-days', offer:'badge-check', rejected:'circle-x', archived:'archive', Queued:'clock-3', Generating:'loader-circle', Ready:'file-check-2', Failed:'circle-alert' };

export function mountJobRecords(host, { browser = globalThis.chrome, onDashboard = () => {}, onApply, privateStorage = studioStorage } = {}) {
  host.innerHTML = JOB_RECORDS_MARKUP;
  const root = host.querySelector('#job-records-design'), doc = host.ownerDocument, $ = selector => root.querySelector(selector);
  let alive = true, busy = false, version = 0, loaded = false, windowId, uiKey, pendingRefresh = false, persistTail = Promise.resolve(),resumeInput;
  let data = { candidate:null, applications:[], jobs:[] };
  const state = { tab:'applications', selected:null, mode:'description', editing:false, chat:false, adding:false, drafts:{}, deleted:null };
  const el = (tag, text, className) => { const node = doc.createElement(tag); if (text !== undefined && text !== null) node.textContent = text; if (className) node.className = className; return node; };
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
    const next = structuredClone({ tab:state.tab, selected:state.selected, mode:state.mode, editing:state.editing, adding:state.adding, drafts:state.drafts, deleted:state.deleted });
    const operation = persistTail.catch(() => {}).then(() => browser.storage.session.set({ [uiKey]:next }));
    persistTail = operation;
    operation.catch(() => show('Unsaved form text could not be kept for reopening. Save this record before closing the dock.',true));
    return operation;
  }
  async function request(operation, payload = {}) {
    const requestId = crypto.randomUUID(), reply = await browser.runtime.sendMessage({ version:1,operation,requestId,payload });
    if (!reply?.ok || reply.requestId && reply.requestId !== requestId) throw Object.assign(new Error(reply?.error?.message || 'The dock could not reach its saved records. Try refreshing.'),{ code:reply?.error?.code });
    return reply.result;
  }
  function setBusy(value) {
    busy = value; root.setAttribute('aria-busy',String(value));
    root.querySelectorAll('button').forEach(button => { button.disabled = value; });
    if(!value)resumeInput?.sync();
  }
  async function run(action) {
    if (busy || !loaded) return;
    setBusy(true); show('');
    try { await persistTail.catch(() => {}); await action(); }
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
    if (record.url) add('Go to apply','apply','arrow-up-right');
    if (record.conversationUrl) add('Open GPT conversation','chat','messages-square');
    if (queue) {
      if(!rail)add('Update resume','update-resume','square-pen');
      if (!rail&&!record.isMock) {
        add('Open in Resume Studio','studio','file-text');
        add('Save Studio result','save-resume','file-check-2');
        if (record.status === 'Ready') add('Mark as applied','mark-applied','check-check');
        if (['Queued','Generating'].includes(record.status)) add('Mark preparation failed','fail','circle-alert');
        if (record.status === 'Failed') add('Queue another attempt','retry','rotate-ccw');
      }
      if(!rail&&record.resume?.snapshot)add('View resume','open-resume','file-text');
      add(record.isMock?'Remove sample':'Delete job','delete','trash-2',true);
    }
    return nodes;
  }
  function renderList() {
    const list = $('#jr-list'); list.replaceChildren();
    const records = (state.tab === 'queue' ? data.jobs : data.applications).slice().sort((a,b) => (Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0));
    list.classList.toggle('jr-queue-list',state.tab==='queue');
    if (!records.length) { const empty = el('div',null,'jr-empty'); empty.append(icon('inbox'),el('span',state.tab === 'queue' ? 'No jobs in this queue. Use Add manually to add a job.' : 'No recorded applications yet.')); list.append(empty); }
    for (const record of records) {
      const queue=record.type==='queue',card = el('article',null,`jr-record${queue?' jr-queue-record':''}`); card.dataset.id = record.id; card.setAttribute('aria-label',`${record.company} · ${record.role} · ${labels[record.status] || record.status}`);
      const head = el('div',null,'jr-record-head'), company = el('div',null,'jr-company'), stamp = el('div',null,'jr-stamp');
      company.append(el('h3',record.company),el('p',record.role));
      const time = el('time',`Updated ${format(record.updatedAt)}`,'jr-updated'); if (Number.isFinite(Date.parse(record.updatedAt))) time.dateTime = new Date(record.updatedAt).toISOString();
      const status=el('div',null,'jr-queue-status');status.append(badge(record.status));if(record.isMock)status.append(el('span','Sample','jr-sample'));
      if(queue)stamp.append(status,time);else stamp.append(badge(record.status),time);head.append(company,stamp); card.append(head);
      if (record.status === 'Failed') card.append(el('p',record.error || 'Resume preparation failed. Retry when ready.','jr-error'));
      if (state.drafts[record.id]) card.append(el('p','Unsaved edits kept in this dock','jr-unsaved'));
      const footer = el('div',null,'jr-record-actions');footer.setAttribute('role','group');footer.setAttribute('aria-label',`Actions for ${record.company}`);
      if(queue){
        if(record.url)footer.append(button('Go to apply','apply','arrow-up-right','jr-button primary',record));
        footer.append(record.resume?.snapshot?button('View resume','open-resume','file-text','jr-button',record):button('Update resume','update-resume','square-pen','jr-button',record),action(record,'view','panel-right-open','View details'));
      }else{
        const view=button('View','view','panel-right-open','jr-view',record),actions=el('div',null,'jr-action-rail');actions.append(...recordActions(record,true));footer.append(view,actions);
      }
      card.append(footer);
      if(queue){const tools=el('div',null,'jr-queue-tools');if(record.resume?.snapshot)tools.append(button('Update resume','update-resume','square-pen','jr-view',record));if(record.resume?.coverLetterRaw?.trim())tools.append(button('Cover letter','cover-letter','file-text','jr-view',record));tools.append(action(record,'delete','trash-2','Delete job',true));card.append(tools);}
      list.append(card);
    }
  }
  function field(container, label, value) { const row = el('div',null,'jr-field'); row.append(el('span',label),el('span',value)); container.append(row); }
  function renderDescription(record) {
    const target=$('#jr-description-content');target.replaceChildren();$('#jr-description-kind').replaceChildren(icon('scan-text'),doc.createTextNode('Job description'));
    const url=safeJobUrl(record.url);if(url){const link=el('a',undefined,'jr-source-link');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.append(icon('arrow-up-right'),doc.createTextNode('Open original listing'));target.append(link);}
    target.append(el('div',record.description||'No job description is saved for this record.','jr-description-copy'));
  }
  function formFields(record) { return { notes:record.notes || '',description:record.description || '',url:record.url || '',conversationUrl:record.conversationUrl || '',status:record.status }; }
  function draftFor(record) { return state.drafts[record.id] || { revision:record.revision, fields:formFields(record) }; }
  const urlLabel = el('label'); urlLabel.append(el('span','Job URL','jr-label')); const urlInput = el('input'); urlInput.id = 'jr-job-url'; urlInput.className = 'jr-select'; urlInput.type = 'url'; urlInput.required = true; urlLabel.append(urlInput);
  const chatLabel = el('label'); chatLabel.append(el('span','GPT conversation URL (optional)','jr-label')); const chatInput = el('input'); chatInput.id = 'jr-conversation-url'; chatInput.className = 'jr-select'; chatInput.type = 'url'; chatInput.placeholder = 'https://chatgpt.com/c/…'; chatLabel.append(chatInput);
  $('#jr-edit-form').insertBefore(urlLabel,$('#jr-job-description-field'));
  $('#jr-edit-form').insertBefore(chatLabel,$('#jr-edit-form .jr-detail-actions'));
  const unsaved = el('p','Edits are kept when switching dock tabs. Save update to commit them.','jr-unsaved'); $('#jr-edit-form').append(unsaved);
  $('#jr-edit-form [data-command="cancel-edit"]').textContent = 'Discard edits';
  function renderDetail(record) {
    $('#jr-back-label').textContent = record.type === 'queue' ? 'Job Queues' : 'Applications'; $('#jr-record-number').textContent = record.id.slice(0,16);
    $('#jr-detail-company').textContent = record.company; $('#jr-detail-role').textContent = record.role; $('#jr-detail-updated').textContent = `Updated ${format(record.updatedAt)}`;
    const readyStatus=$('#jr-detail-status');readyStatus.hidden=record.status!=='Ready';readyStatus.replaceChildren(...record.status==='Ready'?[badge('Ready')]:[]);
    if(Number.isFinite(Date.parse(record.updatedAt)))$('#jr-detail-updated').dateTime=new Date(record.updatedAt).toISOString();else $('#jr-detail-updated').removeAttribute('datetime');
    for (const mode of ['description','details']) { const selected = state.mode === mode; $(`#jr-view-${mode}`).setAttribute('aria-selected',String(selected)); $(`#jr-view-${mode}`).tabIndex = selected ? 0 : -1; $(`#jr-${mode}-pane`).hidden = !selected; }
    $('#jr-read-view').hidden = state.editing || state.chat; $('#jr-edit-form').hidden = !state.editing; $('#jr-chat-panel').hidden = !state.chat;
    const templateName = record.resume?.documentTemplate.id.replace(/^rendercv-/,'').replace(/[-_]/g,' ').replace(/\b\w/g,value => value.toUpperCase());
    const fields = $('#jr-record-fields'); fields.replaceChildren(); field(fields,'Record type',record.type === 'queue' ? 'Job Queue' : 'Application'); field(fields,'Status',labels[record.status]||record.status); field(fields,'Candidate',record.candidateName); field(fields,'Resume',record.resume ? `${templateName} · Version ${record.resume.version}` : 'No saved resume'); field(fields,'Created',format(record.createdAt));
    if (record.type === 'queue') { field(fields,'Attempt',String(record.attempt || 0)); field(fields,'Workflow',record.isMock?'Sample preview':'Manual preparation in Resume Studio'); if(!record.isMock)field(fields,'Prompt at capture',record.promptSnapshot?.title || 'Assigned prompt'); }
    $('#jr-record-note').textContent = record.notes || 'No notes yet.';
    if (record.syncWarning) $('#jr-record-note').textContent += `\n${record.syncWarning}`;
    $('#jr-detail-actions').replaceChildren(...recordActions(record));
    const timeline = $('#jr-timeline'); timeline.replaceChildren();
    for (const event of record.events || []) { const item = el('div',null,'jr-timeline-item'), text = el('div'); text.append(el('p',event.label),el('time',format(event.at))); item.append(el('span',null,'jr-history-dot'),text); timeline.append(item); }
    const queue = record.type === 'queue'; $('#jr-status-field').hidden = queue; $('#jr-queue-status-field').hidden = !queue; $('#jr-job-description-field').hidden = !queue; urlLabel.hidden = !queue; $('#jr-queue-status-text').textContent = record.status;
    const select = $('#jr-status-select'); select.replaceChildren(); for (const status of ['applied','screen','interview','offer','rejected','archived']) { const option = el('option',labels[status]); option.value = status; select.append(option); }
    const draft = draftFor(record); $('#jr-note-input').value = draft.fields.notes; $('#jr-job-description').value = draft.fields.description; urlInput.value = draft.fields.url; chatInput.value = draft.fields.conversationUrl; select.value = draft.fields.status;
    $('#jr-chat-error').hidden = !record.error; $('#jr-chat-error').textContent = record.error || '';
    $('#jr-chat-context').textContent = record.conversationUrl || 'Save a GPT conversation link in Update record to reopen it here.';
    $('#jr-retry-task').hidden = !queue || record.status !== 'Failed'; renderDescription(record);
  }
  let addForm;
  function renderAdd() {
    addForm?.remove(); addForm = undefined;
    if (!state.adding) return;
    addForm = el('form',null,'jr-add-form'); addForm.id = 'jr-add-form'; addForm.append(el('h3','Add job to queue'));
    const draft = state.drafts.$new?.fields || {};
    for (const [name,label,type,required,max] of [['company','Company','text',true,300],['role','Role','text',true,500],['url','Job URL','url',true,4000],['description','Job description','textarea',true,160000],['notes','Notes','textarea',false,10000],['conversationUrl','GPT conversation URL (optional)','url',false,4000]]) {
      const wrapper = el('label'); wrapper.append(el('span',label,'jr-label')); const control = el(type === 'textarea' ? 'textarea' : 'input'); if (type !== 'textarea') control.type = type; else { control.rows = name === 'description' ? 6 : 3; control.className = 'jr-textarea'; }
      control.name = name; control.value = draft[name] || ''; control.required = required; control.maxLength = max; wrapper.append(control); addForm.append(wrapper);
    }
    const actions = el('div',null,'jr-detail-actions'), save = button('Add to queue','','plus','jr-button primary'); save.type = 'submit'; actions.append(save,button('Cancel','cancel-add')); addForm.append(actions);
    $('#jr-body-anchor')?.remove(); $('#jr-main-panel').prepend(addForm);
  }
  function render(force = false) {
    if (!alive) return;
    $('#jr-app-count').textContent = String(data.applications.length); $('#jr-queue-count').textContent = String(data.jobs.length);
    for (const tab of ['applications','queue']) { const selected = state.tab === tab; $(`[data-tab="${tab}"]`).setAttribute('aria-selected',String(selected)); $(`[data-tab="${tab}"]`).tabIndex = selected ? 0 : -1; }
    $('#jr-main-panel').setAttribute('aria-labelledby',state.tab === 'queue' ? 'jr-tab-queue' : 'jr-tab-applications');
    if (!force && (state.editing || state.adding)) return;
    const record = current(); if (!record) { state.selected = null; state.editing = false; state.chat = false; }
    $('#jr-list').hidden = !!state.selected || state.adding; $('#jr-detail').hidden = !state.selected || state.adding;
    renderAdd(); if (record && !state.adding) renderDetail(record); else if (!state.adding) renderList();
  }
  async function command(name, record) {
    if (name === 'dashboard') { await persist(); onDashboard(); return; }
    if (name === 'refresh') { data = await request('DOCK_RECORDS_STATE'); render(true); return; }
    if (name === 'add' || name === 'cancel-add') { state.adding = name === 'add'; if (!state.adding) delete state.drafts.$new; state.editing = false; state.selected = null; await persist(); render(true); return; }
    if (name === 'undo-delete') {
      if (!state.deleted) return; const restored = await mutate('restore',state.deleted); state.deleted = null; state.selected = restored.selectedId; state.tab = 'queue'; await persist(); render(true); show('Job restored.'); return;
    }
    if (name === 'back') { state.selected = null; state.editing = false; state.chat = false; await persist(); render(true); return; }
    if (!record) return;
    if(name==='update-resume'||name==='cover-letter'){await resumeInput.open(record,{letter:name==='cover-letter'});return;}
    if (['view','description','edit','chat'].includes(name)) {
      state.selected = record.id; state.tab = record.type === 'queue' ? 'queue' : 'applications'; state.mode = ['edit','chat'].includes(name) ? 'details' : 'description'; state.chat = false; state.editing = name === 'edit';
      if (name === 'chat') { if (!record.conversationUrl) throw Error('Save a GPT conversation URL in Update record first.'); await browser.tabs.create({ url:record.conversationUrl,active:true }); }
      await persist(); render(true); return;
    }
    if (name === 'cancel-edit') { delete state.drafts[record.id]; state.editing = false; await persist(); render(true); return; }
    if (name === 'apply') { if(record.type==='queue'&&onApply){await persist();await onApply(record.id);return;} if (!safeJobUrl(record.url)) throw Error('This record has no valid application URL.'); await browser.tabs.create({ url:record.url,active:true }); return; }
    if(name==='open-resume'){
      await persist();data=await request('DOCK_RECORDS_OPEN_RESUME',{id:record.id,expectedRevision:record.revision,windowId});render(true);return;
    }
    if (name === 'studio' || name === 'save-resume') {
      data = await request(name === 'studio' ? 'DOCK_RECORDS_STUDIO' : 'DOCK_RECORDS_RESUME',{ id:record.id,expectedRevision:record.revision,windowId });
      state.selected = record.id; render(true); show(name === 'studio' ? 'Prepare this resume in Resume Studio, then return here and choose Save Studio result.' : 'Validated resume saved. Review it before applying.'); return;
    }
    const actions = { retry:'retry',delete:'delete',fail:'fail','mark-applied':'apply' };
    if (actions[name]) {
      const result = await mutate(actions[name],record);
      if (name === 'delete') { const deleted = { ...record,revision:record.revision + 1 }; state.deleted = deleted; state.selected = null; }
      else { state.selected = result.selectedId; if (name === 'mark-applied') state.tab = 'applications'; }
      state.editing = false; await persist(); render(true); show(name === 'delete' ? `${record.company} removed from Job Queues.` : name === 'mark-applied' ? 'Submission recorded in Applications.' : 'Queue record updated.',false,name === 'delete');
    }
  }
  function click(event) {
    const target = event.target.closest('button'); if (!target || !root.contains(target) || target.disabled) return;
    if (target.dataset.tab) { void run(async () => { state.tab = target.dataset.tab; state.selected = null; state.editing = false; state.chat = false; state.adding = false; await persist(); render(true); target.focus(); }); return; }
    if (target.dataset.mode) { void run(async () => { state.mode = target.dataset.mode; await persist(); render(true); target.focus(); }); return; }
    if (target.dataset.command) void run(() => command(target.dataset.command,target.dataset.record ? [...data.applications,...data.jobs].find(item => item.id === target.dataset.record) : current()));
  }
  function input(event) {
    if (!loaded || busy) return;
    if (event.target.closest('#jr-add-form')) {
      const fields = {}; for (const control of addForm.querySelectorAll('[name]')) fields[control.name] = control.value;
      state.drafts.$new = { fields }; void persist().catch(() => {}); return;
    }
    if (!event.target.closest('#jr-edit-form')) return;
    const record = current(); if (!record) return;
    state.drafts[record.id] = { revision:draftFor(record).revision, fields:{ notes:$('#jr-note-input').value,description:$('#jr-job-description').value,url:urlInput.value,conversationUrl:chatInput.value,status:$('#jr-status-select').value } };
    void persist().catch(() => {});
  }
  function submit(event) {
    if (!['jr-add-form','jr-edit-form'].includes(event.target.id)) return;
    event.preventDefault();
    void run(async () => {
      if (event.target.id === 'jr-add-form') {
        const fields = {}; for (const control of addForm.querySelectorAll('[name]')) fields[control.name] = control.value;
        const result = await mutate('create',null,fields); delete state.drafts.$new; state.adding = false; state.selected = result.selectedId; state.tab = 'queue';state.mode='description';
      } else {
        const record = current(); if (!record) throw Error('This record is no longer available. Your form text is retained.');
        const draft = draftFor(record), result = await mutate('update',{ ...record,revision:draft.revision },draft.fields); delete state.drafts[record.id]; state.selected = result.selectedId; state.editing = false;
      }
      await persist(); render(true); show('Record saved.');
    });
  }
  function keydown(event) {
    const tab = event.target.closest('[role="tab"]'); if (!tab || !['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const siblings = [...tab.parentElement.querySelectorAll('[role="tab"]')], index = siblings.indexOf(tab);
    event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? siblings.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + siblings.length) % siblings.length;
    siblings[next].click(); siblings[next].focus();
  }
  const changed = (changes, area) => {
    if (area === 'local' && (changes.appliedList || changes.profile)) void refresh();
  };
  root.addEventListener('click',click); root.addEventListener('input',input); root.addEventListener('change',input); root.addEventListener('submit',submit); root.addEventListener('keydown',keydown);
  browser.storage.onChanged.addListener(changed);
  const privateChanged = changes => { if (changes['dock-job-records:v1']) void refresh(); };
  privateStorage.onChanged.addListener(privateChanged);
  resumeInput=mountQueueResumeInput(root,{request,privateStorage,getWindowId:()=>windowId,icons:JOB_RECORD_ICONS,onUpdated(next){data=next;render(true);}});
  const ready = (async () => {
    try {
      windowId = (await browser.windows.getCurrent()).id; uiKey = `dock-records-ui:v1:${windowId}`;
      const previous = (await browser.storage.session.get(uiKey))[uiKey];
      if (!alive) return;
      if (previous && ['applications','queue'].includes(previous.tab)) Object.assign(state,previous,{ chat:false,drafts:previous.drafts || {} });
      state.mode=state.editing?'details':'description';
      data = await request('DOCK_RECORDS_STATE'); loaded = true; render(true);
    } catch (error) { loaded = true; render(true); show(error.message,true); }
  })();
  return { root, ready, refresh, async select(id) { await ready;await refresh();const record=[...data.applications,...data.jobs].find(record=>record.id===id);if(record){state.tab=record.type==='queue'?'queue':'applications';state.selected=id;state.mode='description';state.editing=false;state.adding=false;state.chat=false;render(true);} }, async show(tab, matchUrl) { await ready; if (tab) { state.tab = tab; state.selected = null; state.editing = false; state.adding = false; } await refresh(); if (matchUrl) { const match = data.applications.find(record => record.url === matchUrl); if (match) { state.selected = match.id; state.mode = 'description'; render(true); } } },
    close() { alive = false; version++;resumeInput.close(); void persist().catch(() => {}); root.removeEventListener('click',click); root.removeEventListener('input',input); root.removeEventListener('change',input); root.removeEventListener('submit',submit); root.removeEventListener('keydown',keydown); browser.storage.onChanged.removeListener(changed); privateStorage.onChanged.removeListener(privateChanged); } };
}
