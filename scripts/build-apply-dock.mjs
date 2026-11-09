import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Window } from 'happy-dom';
import { build } from 'esbuild';
import { projectRoot, isMain } from './paths.mjs';
import path from 'node:path';

const lucide = createRequire(import.meta.url)('lucide');
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
function svg([tag, attrs, children = []], name) {
  const props = tag === 'svg' ? { ...attrs, width:16, height:16, 'aria-hidden':'true' } : attrs;
  return `<${tag} ${Object.entries(props).map(([key,value])=>`${key}="${escape(value)}"`).join(' ')}>${children.map(child=>svg(child)).join('')}</${tag}>`;
}
async function write(file, value) { const target=path.join(projectRoot,file); if(await readFile(target,'utf8').catch(()=>'')!==value) await writeFile(target,value); }
export async function buildApplyDock() {
  const outer=new Window(), inner=new Window();
  outer.document.body.innerHTML=await readFile(path.join(projectRoot,'Baseline/apply-to-job-ready-queue-code.html'),'utf8');
  const html=outer.document.querySelector('iframe')?.getAttribute('data-srcdoc');
  if(!html) throw Error('The Apply to Job reference srcdoc changed.');
  inner.document.body.innerHTML=html;
  const root=inner.document.querySelector('#apply-ready-queue-design');
  if(!root) throw Error('The Apply to Job authored block changed.');
  // The reference adds the prepared-job component in a second style block.
  // Preserve every authored block, in source order.
  const css=[...root.querySelectorAll('style')].map(style=>style.textContent).join('\n');
  root.querySelectorAll('style,script').forEach(node=>node.remove());
  const names=new Set([...root.querySelectorAll('[data-lucide]')].map(node=>node.dataset.lucide));
  ['chevron-left','chevron-right','chevrons-left','chevrons-right','refresh-cw','inbox','file-text','check','file-json-2','upload','panel-right-open'].forEach(name=>names.add(name));
  const icons=Object.fromEntries([...names].map(name=>{
    const data=lucide[name.split('-').map(word=>word[0].toUpperCase()+word.slice(1)).join('')];
    if(!data) throw Error(`Missing Apply to Job icon: ${name}`);
    return [name,svg(data,name)];
  }));
  root.querySelectorAll('[data-lucide]').forEach(node=>{node.outerHTML=icons[node.dataset.lucide];});
  root.querySelector('#aj-profile').replaceChildren();
  root.insertAdjacentHTML('afterbegin',`<nav class="aj-navigation" aria-label="Dock navigation"><button type="button" class="aj-button aj-quiet" data-action="dashboard">${icons['chevron-left']}Dashboard</button><h2>Apply to Job</h2></nav>`);
  root.querySelector('.aj-navigation').append(root.querySelector('#aj-header-state'));
  root.querySelector('.aj-header').remove();
  root.querySelector('#aj-change-job').outerHTML=`<div class="aj-job-pager" role="group" aria-label="Job queue card navigation"><button type="button" data-action="job-first" aria-label="First queued job">${icons['chevrons-left']}</button><button type="button" data-action="job-prev" aria-label="Previous queued job">${icons['chevron-left']}</button><span id="aj-job-position" aria-live="polite">0/0</span><button type="button" data-action="job-next" aria-label="Next queued job">${icons['chevron-right']}</button><button type="button" data-action="job-last" aria-label="Last queued job">${icons['chevrons-right']}</button></div>`;
  root.querySelector('#aj-job-picker').remove();
  root.querySelector('.aj-prepared-state .aj-badge').id='aj-prepared-status';
  root.querySelector('.aj-prepared-state').insertAdjacentHTML('afterbegin','<span class="aj-badge" id="aj-sample-label" hidden>Sample</span>');
  root.querySelector('#aj-selected-job').insertAdjacentHTML('beforeend',`<div class="aj-card-actions"><button type="button" class="aj-button" data-action="job-url">${icons['arrow-up-right']}Go to URL</button><button type="button" class="aj-button" data-action="job-details">${icons['panel-right-open']}View details</button></div>`);
  root.querySelector('#aj-no-ready-jobs').insertAdjacentHTML('afterend','<button type="button" class="aj-button aj-wide" id="aj-open-queue" data-action="queue">Open Job Queues</button>');
  root.querySelector('#aj-update-profile').insertAdjacentHTML('beforebegin','<details class="aj-import-facts"><summary>Review imported details</summary><p id="aj-import-summary" class="aj-small"></p><div id="aj-import-details" class="aj-import-details"></div></details>');
  root.querySelector('#aj-file').accept='.pdf,.docx';
  root.querySelector('#aj-upload-target').remove();
  root.querySelector('[data-action="use-prepared-resume"]').remove();
  const file=root.querySelector('#aj-file'),name=root.querySelector('#aj-upload-name'),box=root.querySelector('.aj-upload-box');
  box.before(file,name);box.remove();file.className='aj-file-hidden';file.hidden=true;name.className='aj-small';name.hidden=true;
  root.querySelector('#aj-upload').insertAdjacentHTML('afterbegin',`<div class="aj-import-sources"><button type="button" class="aj-button aj-source-button" data-action="import-queue-json">${icons['file-json-2']}<span>Import JSON from job queue</span></button><button type="button" class="aj-button aj-source-button" data-action="manual-upload">${icons.upload}<span>Manual upload</span></button></div>`);
  root.querySelector('#aj-import-review .aj-badge').id='aj-import-source';
  root.querySelector('#aj-tailor').setAttribute('checked','');
  root.querySelector('#aj-upload').removeAttribute('hidden');
  root.querySelector('#aj-jd').readOnly=true;
  root.querySelector('#aj-progress').setAttribute('aria-valuemax','0');
  root.querySelector('#aj-run-description').setAttribute('role','status');
  root.querySelector('[data-action="rescan"]').id='aj-rescan';
  root.querySelector('#aj-review-panel .aj-card .aj-badge').id='aj-review-count';
  root.querySelector('#aj-fill-answer').childNodes.forEach(node=>{if(node.nodeType===3&&node.textContent.trim()){const label=inner.document.createElement('span');label.id='aj-fill-label';label.textContent=node.textContent;node.replaceWith(label);}});
  root.querySelector('#aj-success').insertAdjacentHTML('beforebegin','<div id="aj-confirm-submission" class="aj-card" hidden><p class="aj-small">Check the employer page for its submission confirmation.</p><button type="button" class="aj-button aj-wide" data-action="confirm-submission" style="margin-top:10px">I submitted the application</button></div>');
  let markup=root.outerHTML.replace(/Application Tracker · Demo workflow/g,'Application Tracker 2.1').replace(/Demo import/g,'Resume import')
    .replace(/Morgan Taylor · Backend|Jamie Chen · Data/g,'').replace(/Morgan_Northstar\.pdf|Morgan_Backend\.pdf/g,'Prepared resume')
    .replace(/Morgan Taylor|Jamie Chen/g,'Selected profile').replace(/Morgan/g,'candidate').replace(/Northstar/g,'Selected company');
  markup=markup.replace(/9 of 9 fields/g,'0 of 0 fields').replace(/Page 1 of 2/g,'Current page').replace(/0 of 6 filled|0 of 3 filled|3 found/g,'Not scanned');
  const scope='#at-reference-dock #apply-ready-queue-design';
  const themeTokens={
    bg:'--rd-bg',card:'--rd-panel',soft:'--rd-soft',line:'--rd-line',text:'--rd-text',muted:'--rd-muted',
    brand:'--rd-purple','brand-text':'--color-on-accent','brand-soft':'--rd-accent-soft',
    purple:'--rd-purple','purple-soft':'--rd-accent-soft',good:'--rd-green','good-soft':'--rd-good-soft',
    warn:'--rd-orange','warn-soft':'--rd-warn-soft',red:'--color-danger-ink',
  };
  // Import both complete style blocks, replacing only the reference's color
  // definitions. Application Tracker owns every token and the theme preference.
  const themed=css.replace(/--aj-([\w-]+):light-dark\(#[\da-f]+,#[\da-f]+\)/gi,(_,name)=>{
    if(!themeTokens[name])throw Error(`Map the new reference color token: ${name}`);
    return `--aj-${name}:var(${themeTokens[name]})`;
  });
  if(themed.includes('light-dark('))throw Error('An Apply reference palette was not mapped to the application theme.');
  const scoped=themed.replaceAll('#apply-ready-queue-design',scope);
  const extra=`
/* Only dock framing and live-data additions sit outside the reference styles. */
#at-reference-dock:has(#apply-ready-queue-design:not([hidden])) { padding:0; }
#at-reference-dock .rd-dock:has(#apply-ready-queue-design:not([hidden])) { max-width:none; border:0; border-radius:0; overflow:visible; background:transparent; color-scheme:inherit; }
body.reference-dashboard:has(#apply-ready-queue-design:not([hidden])) { min-height:100dvh; background:var(--reference-dashboard-bg); }
${scope} { color-scheme:inherit; -webkit-font-smoothing:antialiased; background-image:radial-gradient(circle,color-mix(in srgb,var(--aj-text) 14%,transparent) .8px,transparent .8px); background-position:center; background-size:16px 16px; }
${scope} .aj-primary,${scope} .aj-step[aria-current=step]>span,${scope} .aj-toggle:checked { background:var(--color-accent-solid); color:var(--color-on-accent); }
${scope} .aj-navigation { display:flex; align-items:center; gap:12px; max-width:430px; margin:0 auto 10px; }
${scope} .aj-navigation h2 { margin:0; font-size:18px; font-weight:500; letter-spacing:-.5px; line-height:1.3; }
${scope} .aj-navigation #aj-header-state { margin-left:auto; }
${scope} .aj-job-pager { display:inline-flex; align-items:center; gap:2px; margin-left:auto; }
${scope} .aj-job-pager button { display:grid; place-items:center; width:23px; height:28px; padding:0; border:1px solid var(--aj-line); border-radius:5px; background:var(--aj-bg); color:var(--aj-text); }
${scope} .aj-job-pager svg { width:14px; height:14px; }
${scope} #aj-job-position { min-width:34px; text-align:center; font-size:11px; color:var(--aj-muted); font-variant-numeric:tabular-nums; }
${scope} .aj-card-actions { display:flex; gap:8px; margin-top:12px; }
${scope} .aj-card-actions .aj-button { flex:1; min-width:0; }
${scope} .aj-import-sources { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
${scope} .aj-source-button { display:flex; flex-direction:column; gap:8px; min-height:80px; padding:12px 8px; line-height:1.35; }
${scope} .aj-source-button svg { width:22px; height:22px; color:var(--aj-brand); }
${scope} #aj-upload-name { display:block; margin-top:8px; font-weight:400; }
${scope} select option { color:var(--aj-text); background:var(--aj-bg); }
${scope} :is(button,summary):not(:disabled) { cursor:pointer; }
${scope} .aj-pdf { display:block; width:100%; height:430px; border:1px solid var(--aj-line); border-radius:8px; background:var(--aj-card); }
${scope} .aj-small { overflow-wrap:anywhere; }
${scope} .aj-question-navigation { flex-wrap:wrap; }
${scope} .aj-import-facts { padding:9px 0; border-block:1px solid var(--aj-line); }
${scope} .aj-import-facts>summary { color:var(--aj-text); }
${scope} .aj-import-details { max-height:260px; overflow-y:auto; overflow-wrap:anywhere; font-size:12px; }
${scope} .aj-import-details h4 { margin:8px 0 4px; }
${scope} .aj-import-details p { margin:4px 0; white-space:pre-wrap; }
${scope} .aj-target-tab { display:grid; gap:5px; padding-top:10px; border-top:1px solid var(--aj-line); }
`;
  await write('extension/studio/apply-dock-markup.js',`// Generated from Baseline/apply-to-job-ready-queue-code.html; demo scripts excluded.\nexport const APPLY_DOCK_MARKUP=${JSON.stringify(markup)};\nexport const APPLY_DOCK_ICONS=${JSON.stringify(icons)};\n`);
  await write('extension/apply-dock.css',scoped+'\n'+extra);
  await build({ entryPoints:[path.join(projectRoot,'src/dock-apply-content.js')],outfile:path.join(projectRoot,'extension/content-scripts/dock-apply.js'),bundle:true,format:'iife',target:'chrome116',legalComments:'none' });
  await Promise.all([outer.happyDOM.close(),inner.happyDOM.close()]);
}
if(isMain(import.meta.url)) await buildApplyDock();
