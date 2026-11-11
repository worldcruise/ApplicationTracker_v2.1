import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isMain } from './paths.mjs';
import { Window } from 'happy-dom';
const root = fileURLToPath(new URL('../', import.meta.url));
const lucide = createRequire(import.meta.url)('lucide');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function svg([tag,attrs,children = []], name) {
  const props = tag === 'svg' ? { ...attrs, width: 16, height: 16, 'aria-hidden': 'true', class: `lucide lucide-${name}` } : attrs;
  return `<${tag} ${Object.entries(props).map(([key,value]) => `${key}="${escape(value)}"`).join(' ')}>${children.map(child => svg(child)).join('')}</${tag}>`;
}
async function write(file, contents) { const target = path.join(root,file); if (await readFile(target,'utf8').catch(() => '') !== contents) await writeFile(target,contents); }
export async function buildJobRecords() {
  const source = await readFile(path.join(root,'Baseline/applications-job-queues-code.html'),'utf8');
  const encoded = source.match(/data-srcdoc="([\s\S]*?)"\s*><\/iframe>/)?.[1];
  if (!encoded) throw Error('The job records reference srcdoc changed.');
  const entities = { amp:'&',lt:'<',gt:'>',quot:'"',apos:"'" };
  const html = encoded.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_,entity) => entity[0] === '#' ? String.fromCodePoint(parseInt(entity.slice(entity[1]?.toLowerCase() === 'x' ? 2 : 1), entity[1]?.toLowerCase() === 'x' ? 16 : 10)) : entities[entity]);
  const start = html.indexOf('<div id="job-records-design"'), end = html.indexOf('<script>',start);
  if (start < 0 || end < start) throw Error('The job records reference markup changed.');
  const fragment = html.slice(start,end), css = fragment.match(/<style>([\s\S]*?)<\/style>/)?.[1];
  if (!css) throw Error('The job records reference styles changed.');
  const names = ['chevron-left','plus','scan-text','check-check','calendar-days','badge-check','circle-x','archive','clock-3','loader-circle','file-check-2','circle-alert','panel-right-open','eye','arrow-up-right','messages-square','square-pen','trash-2','inbox','file-text','check','workflow','rotate-ccw','refresh-cw','folder-open','save','download','upload','x'];
  const icons = Object.fromEntries(names.map(name => {
    const icon = lucide[name.split('-').map(word => word[0].toUpperCase()+word.slice(1)).join('')];
    if (!icon) throw Error(`Missing job records icon: ${name}`);
    return [name,svg(icon,name)];
  }));
  let markup = fragment.replace(/<style>[\s\S]*?<\/style>/,'') + '</div>';
  markup = markup.replace(/<header class="jr-header">[\s\S]*?<\/header>/,
    `<header class="jr-header"><button type="button" class="jr-back" data-command="dashboard">${icons['chevron-left']}Dashboard</button><h2>Application Workspace</h2></header>`)
    .replace(/(id="jr-(?:app|queue)-count">)\d+/g,(_,prefix) => prefix + '0')
    .replace('GPT conversation · Demo','GPT conversation')
    .replace('<div class="jr-body"', '<div class="jr-toolbar"><button type="button" class="jr-button primary" data-command="add">Add manually</button><button type="button" class="jr-button danger" data-command="delete-all" hidden>Delete all</button><button type="button" class="jr-icon" data-command="refresh" aria-label="Refresh records">'+icons['refresh-cw']+'</button></div><div class="jr-body"');
  markup = markup.replace(/<i data-lucide="([^"]+)"[^>]*><\/i>/g, (_,name) => icons[name] || '');
  const window=new Window();window.document.body.innerHTML=markup;
  const design=window.document.querySelector('#job-records-design');
  design.querySelector('.jr-detail-heading').innerHTML='<div class="jr-detail-title"><h3 class="jr-detail-company" id="jr-detail-company"></h3><span id="jr-detail-status" hidden></span></div><p class="jr-detail-role" id="jr-detail-role"></p><div class="jr-detail-meta"><span id="jr-detail-candidate"></span><time class="jr-updated" id="jr-detail-updated"></time></div>';
  const descriptionTab=design.querySelector('#jr-view-preview'),detailsTab=design.querySelector('#jr-view-details'),descriptionPane=design.querySelector('#jr-preview-pane'),detailsPane=design.querySelector('#jr-details-pane');
  design.querySelector('.jr-detail-heading').after(design.querySelector('#jr-detail-actions'));
  descriptionTab.id='jr-view-description';descriptionTab.textContent='Job description';descriptionTab.dataset.mode='description';descriptionTab.setAttribute('aria-controls','jr-description-pane');descriptionTab.setAttribute('aria-selected','true');descriptionTab.tabIndex=0;
  detailsTab.setAttribute('aria-selected','false');detailsTab.tabIndex=-1;descriptionTab.parentElement.prepend(descriptionTab);
  descriptionPane.id='jr-description-pane';descriptionPane.setAttribute('aria-labelledby',descriptionTab.id);descriptionPane.hidden=false;detailsPane.hidden=true;detailsPane.before(descriptionPane);
  descriptionPane.querySelector('#jr-preview-kind').id='jr-description-kind';descriptionPane.querySelector('#jr-preview-content').id='jr-description-content';
  const tabs=design.querySelector('.jr-detail-subnav'),navigation=window.document.createElement('div');navigation.className='jr-detail-navigation';tabs.before(navigation);navigation.append(tabs);const editSlot=window.document.createElement('div');editSlot.id='jr-edit-slot';navigation.append(editSlot);
  design.querySelector('#jr-note-input').closest('label').remove();
  const documents=window.document.createElement('div');documents.className='jr-document-fields';documents.innerHTML='<label><span class="jr-label">Resume (CV JSON)</span><textarea class="jr-textarea" id="jr-resume-input" rows="7" spellcheck="false"></textarea></label><label class="jr-cover-letter-control"><input type="checkbox" id="jr-letter-enabled"> Include cover letter</label><label><span class="jr-label">Cover letter</span><textarea class="jr-textarea" id="jr-letter-input" rows="5"></textarea></label>';
  design.querySelector('#jr-edit-form .jr-detail-actions').before(documents);
  markup=design.outerHTML;
  const controlStyle=window.document.createElement('style');controlStyle.textContent=await readFile(path.join(root,'extension/workspace.css'),'utf8');window.document.head.append(controlStyle);
  const controlScope='#job-records-design .jr-cv-modal';
  const allowed=/^\.(?:workspace-card|editor-card|cv-card|section-heading|cv-heading-labels|cv-company|json-editor|letter-switch|letter-off|export-folder|folder-picker|visually-hidden)(?:[\s.:[>#]|$)/;
  function importControls(rules){return [...rules].map(rule=>{if(rule.selectorText){const selectors=rule.selectorText.split(/,(?![^()]*\))/).map(selector=>selector.trim()).filter(selector=>allowed.test(selector));return selectors.length?`${selectors.map(selector=>`${controlScope} ${selector}`).join(',')}{${rule.style.cssText}}`:'';}if(rule.cssRules&&rule.conditionText)return `@media ${rule.conditionText}{${importControls(rule.cssRules)}}`;return '';}).join('\n');}
  const studioControls=importControls(controlStyle.sheet.cssRules);await window.happyDOM.close();
  const lightCss = css.replace(/light-dark\((#[\da-f]+),(#[\da-f]+)\)/gi,'$1');
  const darkVariables = css.match(/#job-records-design\{([^}]+)\}/)?.[1].replace(/light-dark\((#[\da-f]+),(#[\da-f]+)\)/gi,'$2');
  const extra = `
[data-theme="dark"] #job-records-design { ${darkVariables} }
/* Adapt the imported dock layout to the existing dock palette and shared theme. */
#at-reference-dock #job-records-design { --jr-bg:var(--rd-bg); --jr-card:var(--rd-panel); --jr-raised:var(--color-button-fill); --jr-hover:var(--color-button-hover); --jr-text:var(--rd-text); --jr-muted:var(--rd-muted); --jr-line:var(--rd-line); --jr-accent:var(--rd-purple); --jr-accent-bg:var(--color-accent-soft); padding:0; }
#at-reference-dock .rd-dock:has(#job-records-design:not([hidden])) { max-width:430px; }
#job-records-design .jr-window { max-width:none; margin:0; border:0; border-radius:0; }
#job-records-design .jr-body { margin:0; padding:0; border:0; }
#job-records-design .jr-tabs { margin:0; border:0; }
#job-records-design :is(.jr-record,.jr-detail-card) { margin:0; border:0; }
#job-records-design .jr-header h2 { font-size:14px; }
#job-records-design .jr-detail-title { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; }
#job-records-design .jr-detail-title .jr-detail-company { flex:1; min-width:0; }
#job-records-design .jr-detail-title #jr-detail-status { flex-shrink:0; }
#job-records-design .jr-detail-heading { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 12px; align-items:start; }
#job-records-design .jr-detail-heading>.jr-detail-role { grid-column:1; margin:0; }
#job-records-design .jr-detail-meta { grid-column:2; grid-row:1 / 3; display:flex; flex-direction:column; align-items:flex-end; gap:4px; max-width:160px; text-align:right; overflow-wrap:anywhere; font-size:11px; color:var(--jr-muted); }
#job-records-design .jr-edit-form :disabled { opacity:1; color:var(--jr-muted); cursor:default; }
#job-records-design .jr-detail-navigation { display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; margin:0; border:0; }
#job-records-design .jr-detail-navigation .jr-detail-subnav { flex:1 1 auto; margin:0; padding:0; border:0; }
#job-records-design .jr-detail-navigation.jr-editing { position:sticky; top:0; z-index:5; background:var(--jr-card); padding-top:8px; box-shadow:0 5px 8px -7px #0006; }
#job-records-design #jr-edit-slot { margin-left:auto; padding-bottom:4px; }
#job-records-design #jr-edit-slot .jr-button { width:122px; min-height:36px; padding:7px 10px; font-size:11px; }
#job-records-design .jr-document-fields { display:grid; gap:12px; }
#job-records-design .jr-cover-letter-control { display:flex; align-items:center; gap:7px; font-size:12px; }
#job-records-design .jr-required { margin-left:4px; color:var(--color-danger-ink); }
#job-records-design #jr-detail-actions { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,135px),1fr)); align-items:stretch; gap:8px; }
#job-records-design #jr-detail-actions .jr-button,#job-records-design .jr-edit-form .jr-button { min-width:0; min-height:40px; padding:8px 10px; line-height:1.4; white-space:normal; overflow-wrap:anywhere; }
#job-records-design #jr-detail-actions .jr-button svg { flex-shrink:0; }
#job-records-design .jr-edit-form .jr-detail-actions { display:flex; flex-wrap:wrap; gap:8px; }
#job-records-design .jr-edit-form .jr-detail-actions>.jr-button { flex:1 1 120px; }
#job-records-design .jr-detail-card { container-type:inline-size; }
@container (max-width:270px) {
  #job-records-design .jr-detail-heading { grid-template-columns:minmax(0,1fr); }
  #job-records-design .jr-detail-meta { grid-column:1; grid-row:auto; max-width:none; align-items:flex-start; text-align:left; }
}
#job-records-design .jr-detail-meta .jr-updated { max-width:none; }
#job-records-design .jr-detail-meta .jr-detail-role { margin:0; min-width:0; overflow-wrap:anywhere; }
#job-records-design .jr-description-copy { margin:10px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; font-size:12px; line-height:1.7; }
#job-records-design .jr-source-link { display:inline-flex; align-items:center; gap:5px; margin:0 0 5px; color:var(--jr-accent); font-size:12px; overflow-wrap:anywhere; }
#job-records-design .jr-source-link svg { width:13px; height:13px; flex-shrink:0; }
#job-records-design .jr-toolbar { display:flex; flex-wrap:wrap; align-items:center; gap:6px; padding:0 13px 13px; }
#job-records-design .jr-toolbar>.jr-icon { margin-left:auto; }
#job-records-design .jr-add-form { display:grid; gap:12px; padding:var(--dock-gutter,13px); margin:0; background:var(--jr-card); border:0; border-radius:12px; }
#job-records-design .jr-add-form input { display:block; width:100%; min-width:0; padding:8px 10px; border:1px solid var(--jr-line); border-radius:8px; background:var(--jr-bg); color:var(--jr-text); }
#job-records-design .jr-select option { color:var(--jr-text); background:var(--jr-bg); }
#job-records-design .jr-feedback[data-error=true] { color:var(--color-danger-ink); background:var(--color-danger-fill); border-color:var(--color-danger-border); }
#job-records-design .jr-unsaved { color:var(--jr-accent); font-size:11px; margin:6px 0; }
#job-records-design .jr-candidate-note { padding:0 14px 12px; margin:0; color:var(--jr-muted); font-size:11px; }
#job-records-design .jr-preview-document { max-width:100%; }
#job-records-design .jr-preview-document :is(p,li) { white-space:pre-wrap; }
#job-records-design .jr-preview-document ul { padding-left:17px; font-size:12px; }
#job-records-design .jr-saved-resume { margin-top:10px; }
#job-records-design [aria-busy=true] { cursor:wait; }
#job-records-design .jr-action-rail { flex-wrap:wrap; }
#job-records-design .jr-sample { font-size:10px; color:var(--jr-muted); }
#job-records-design .jr-queue-list { gap:8px; }
#job-records-design .jr-queue-record { padding:10px var(--dock-gutter,13px); border-radius:10px; }
#job-records-design .jr-queue-record .jr-record-head { grid-template-columns:minmax(0,1fr) auto; gap:8px; }
#job-records-design .jr-queue-record .jr-company h3 { font-size:15px; line-height:1.3; margin:0 0 4px; }
#job-records-design .jr-queue-record .jr-company p { font-size:13px; line-height:1.35; }
#job-records-design .jr-queue-record .jr-company .jr-card-salary { margin-top:7px; font-size:12px; color:var(--jr-muted); }
#job-records-design .jr-card-main { cursor:pointer; border-radius:6px; }
#job-records-design .jr-card-main:focus-visible { outline:2px solid var(--jr-accent); outline-offset:4px; }
#job-records-design .jr-card-main:hover .jr-company h3 { color:var(--jr-accent); }
#job-records-design .jr-queue-record .jr-stamp { gap:4px; max-width:132px; }
#job-records-design .jr-queue-status { display:flex; align-items:center; justify-content:flex-end; gap:5px; flex-wrap:wrap; }
#job-records-design .jr-queue-record .jr-status { padding:3px 6px; }
#job-records-design .jr-queue-record .jr-updated { font-size:10px; line-height:1.3; }
#job-records-design .jr-queue-record .jr-record-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:stretch; gap:6px; margin-top:12px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-button { display:flex; flex-direction:column; justify-content:center; min-width:0; min-height:42px; padding:4px 2px; font-size:10px; gap:3px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-icon { width:29px; height:29px; }
#job-records-design .jr-queue-record .jr-record-actions .jr-button { white-space:nowrap; }
#job-records-design .jr-queue-record .jr-record-actions svg { flex-shrink:0; width:13px; height:13px; }
#job-records-design .jr-button.primary { background:var(--color-accent-solid); color:var(--color-on-accent); }
#job-records-design :is(input,textarea)::placeholder { color:var(--jr-muted); opacity:1; }
`;
  await write('extension/studio/job-records-markup.js',`// Generated from the authored block in Baseline/applications-job-queues-code.html.\nexport const JOB_RECORDS_MARKUP = ${JSON.stringify(markup)};\nexport const JOB_RECORD_ICONS = ${JSON.stringify(icons)};\n`);
  const inputStyles=await readFile(path.join(root,'extension/studio/queue-resume-input.css'),'utf8');
  await write('extension/job-records.css',`/* Authored Applications / Job Queues dock layout. */\n${lightCss}\n${extra}\n/* Resume Studio CV and letter controls. */\n${studioControls}\n${inputStyles}`);
}
if (isMain(import.meta.url)) await buildJobRecords();
