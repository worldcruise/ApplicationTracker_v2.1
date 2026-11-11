import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { Window } from 'happy-dom';
import { DASHBOARD_MARKUP } from '../extension/studio/reference-dashboard-markup.js';
import { JOB_RECORDS_MARKUP } from '../extension/studio/job-records-markup.js';
import { APPLY_DOCK_MARKUP } from '../extension/studio/apply-dock-markup.js';

function luminance(color) {
  let channels;
  if (color.startsWith('#')) { const hex = color.slice(1); channels = (hex.length === 3 ? [...hex].map(value => value + value) : hex.match(/../g)).map(value => parseInt(value, 16)); }
  else channels = color.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  assert.equal(channels?.length, 3, `Unresolved color: ${color}`);
  const linear = channels.map(value => { const v = value / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function check(window, textSelector, backgroundSelector, label) {
  const color = window.getComputedStyle(window.document.querySelector(textSelector)).color;
  const background = window.getComputedStyle(window.document.querySelector(backgroundSelector || textSelector)).backgroundColor;
  const a = luminance(color), b = luminance(background), ratio = (Math.max(a,b) + .05) / (Math.min(a,b) + .05);
  assert.ok(ratio >= 4.5, `${label}: ${color} on ${background} is ${ratio.toFixed(2)}:1`);
}
test('light and dark inspector text, active choices, inputs, and export controls retain readable contrast', async () => {
  const files = ['extension/preview.css', 'extension/assets/web-pages.css', 'extension/studio/theme.css', 'extension/studio/resume-customize.css'];
  const styles = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n');
  for (const theme of ['light','dark']) {
    const window = new Window(); window.document.documentElement.dataset.theme = theme;
    window.document.head.innerHTML = `<style>${styles}</style>`;
    window.document.body.innerHTML = '<div class="preview-web-page"><div class="web-header-actions"><button id="theme" class="web-theme-toggle" aria-label="Switch color theme"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v2"/></svg></button></div><div class="preview-header"><div class="preview-title"><h1 id="title">Resume Studio</h1></div></div><div id="customize-panel" class="customize-panel"><label id="label">Font size</label><input id="field" value="12"><div class="template-select"><label id="template-label">Template</label><select id="template"><option id="template-option">Classic</option></select></div><input id="disabled-field" value="Disabled" disabled><details class="customize-group" open><summary id="summary">Typography</summary></details><div class="setting-choices"><button id="choice" aria-pressed="true">Selected</button><button id="disabled-choice" disabled>Unavailable</button></div><div class="template-picker"><button id="template-choice" aria-pressed="true"><span id="template-name">Classic</span></button></div></div><button id="export" class="button button-primary">Export PDF</button></div>';
    for (const [text, background] of [['#label','.customize-panel'],['#field'],['#summary'],['#choice'],['#export'],['#theme'],['#title','.preview-header'],['#template-label','.customize-panel'],['#template'],['#template-option'],['#disabled-field'],['#disabled-choice'],['#template-name','#template-choice']]) check(window, text, background, `${theme} ${text}`);
    const color = theme === 'light' ? '#182339' : '#e5eaf3';
    const background = theme === 'light' ? '#fff' : '#101929';
    for (const selector of ['#field','#template','#template-option']) {
      const style = window.getComputedStyle(window.document.querySelector(selector));
      assert.equal(luminance(style.color), luminance(color), `${theme} ${selector} text matches palette`);
      assert.equal(luminance(style.backgroundColor), luminance(background), `${theme} ${selector} background matches palette`);
    }
    for (const selector of ['#label','#template-label','#template-name']) assert.equal(luminance(window.getComputedStyle(window.document.querySelector(selector)).color),luminance(color),`${theme} ${selector} uses the exact text color`);
    const disabledFieldset=window.document.createElement('fieldset');disabledFieldset.disabled=true;window.document.querySelector('#customize-panel').append(disabledFieldset);
    assert.equal(window.getComputedStyle(disabledFieldset).opacity,'1',`${theme} disabled fieldsets do not fade all inspector text`);
    await window.happyDOM.abort();
  }
});

test('Resume Studio editor and candidate/prompt dropdowns match the exact shared palettes', async () => {
  const styles = (await Promise.all(['extension/workspace.css','extension/studio/resume-workspace.css','extension/studio/theme.css'].map(file => readFile(file, 'utf8')))).join('\n');
  for (const theme of ['light','dark']) {
    const window = new Window(); window.document.documentElement.dataset.theme = theme;
    window.document.head.innerHTML = `<style>${styles}</style>`;
    window.document.body.innerHTML = '<section class="resume-studio-panel"><div class="studio-selector-row"><label id="label">Candidate<select id="candidate"><option id="option">A candidate</option></select></label><label>Prompt<select id="prompt"><option>A prompt</option></select></label><select id="disabled" disabled><option>Loading</option></select></div><section class="workspace-card editor-card"><div class="section-heading"><h3 id="heading">Job description</h3><button id="copy" class="button button-secondary">Copy Prompt + JD</button></div><textarea id="jd">Description</textarea><textarea id="invalid" aria-invalid="true">Invalid CV</textarea></section><div id="error" class="studio-selector-error">Save failed</div></section>';
    for (const [text, background] of [['#label','.resume-studio-panel'],['#candidate'],['#prompt'],['#option'],['#disabled'],['#heading','.editor-card'],['#copy'],['#jd'],['#invalid'],['#error']]) {
      if (text === '#label') window.document.querySelector('.resume-studio-panel').style.background = 'var(--color-canvas)';
      check(window, text, background, `${theme} ${text}`);
    }
    for (const selector of ['#candidate','#prompt','#option','#jd','#invalid']) {
      const style = window.getComputedStyle(window.document.querySelector(selector));
      assert.equal(luminance(style.color), luminance(theme === 'light' ? '#182339' : '#e5eaf3'), `${theme} ${selector} text matches palette`);
      assert.equal(luminance(style.backgroundColor), luminance(theme === 'light' ? '#fff' : '#101929'), `${theme} ${selector} background matches palette`);
    }
    assert.equal(window.getComputedStyle(window.document.querySelector('.studio-selector-row')).gridTemplateColumns, 'repeat(2,minmax(0,1fr))');
    await window.happyDOM.abort();
  }
});

test('web Dashboard and Applications use readable labels, metric values, and table text in both themes', async () => {
  const files = ['extension/assets/web-pages.css', 'extension/web-dashboard.css', 'extension/studio/theme.css'];
  const styles = (await Promise.all(files.map(file => readFile(file, 'utf8')))).join('\n');
  for (const theme of ['light','dark']) {
    const window = new Window(); window.document.documentElement.dataset.theme = theme;
    window.document.head.innerHTML = `<style>${styles}</style>`;
    window.document.body.innerHTML = '<div class="web-dashboard"><article class="web-dashboard-stat web-dashboard-stat-today"><div id="label">Today</div><strong id="number">1</strong><small id="note">Today’s submissions</small></article><button id="primary" class="web-button web-button-primary">Capture job</button><section class="web-card web-dashboard-recent"><h2 id="heading">Recent applications</h2></section></div><section class="applications-page"><table><thead><tr><th id="th">Job</th></tr></thead><tbody><tr><td id="td">Engineer</td></tr></tbody></table></section>';
    for (const [text, background] of [['#label','.web-dashboard-stat'],['#number','.web-dashboard-stat'],['#note','.web-dashboard-stat'],['#primary'],['#heading','.web-card'],['#th'],['#td','.applications-page']]) {
      if (text === '#td') window.document.querySelector('.applications-page').style.background = 'var(--color-surface)';
      check(window, text, background, `${theme} ${text}`);
    }
    await window.happyDOM.abort();
  }
});

test('dock job records use readable light and dark cards, form fields and status badges',async()=>{
  const styles=(await Promise.all(['extension/studio/theme.css','extension/dashboard.css','extension/job-records.css'].map(file=>readFile(file,'utf8')))).join('\n');
  for(const theme of ['light','dark']){
    const window=new Window();window.document.documentElement.dataset.theme=theme;window.document.head.innerHTML=`<style>${styles}</style>`;window.document.body.innerHTML=DASHBOARD_MARKUP;
    window.document.querySelector('.rd-main').innerHTML=JOB_RECORDS_MARKUP;
    window.document.querySelector('#jr-list').innerHTML='<article class="jr-record"><div class="jr-company"><h3 id="dock-title">Company</h3><p id="dock-role">Software Engineer</p></div><span id="dock-screen" class="jr-status screening">Screening</span><span id="dock-ready" class="jr-status ready">Ready</span><span id="dock-failed" class="jr-status failed">Failed</span><input id="dock-input" class="jr-select" value="Job URL"><button id="dock-primary" class="jr-button primary">Save update</button></article>';
    for(const[text,background]of [['#dock-title','.jr-record'],['#dock-role','.jr-record'],['#dock-screen'],['#dock-ready'],['#dock-failed'],['#dock-input'],['#dock-primary']])check(window,text,background,`${theme} ${text}`);
    const card=window.getComputedStyle(window.document.querySelector('.jr-record'));
    assert.equal(luminance(card.backgroundColor),luminance(theme==='light'?'#fff':'#202022'));
    await window.happyDOM.abort();
  }
});

test('dock Apply keeps borderless framing, reference controls and readable application themes',async()=>{
  const styles=(await Promise.all(['extension/studio/theme.css','extension/dashboard.css','extension/apply-dock.css'].map(file=>readFile(file,'utf8')))).join('\n');
  const outer=new Window(),reference=new Window();outer.document.body.innerHTML=await readFile('Baseline/apply-to-job-ready-queue-code.html','utf8');reference.document.body.innerHTML=outer.document.querySelector('iframe').getAttribute('data-srcdoc');
  const authored=reference.document.querySelector('#apply-ready-queue-design'),sourceStyles=[...authored.querySelectorAll('style')].map(node=>node.textContent).join('\n');
  authored.querySelectorAll('style,script').forEach(node=>node.remove());const sourceMarkup=authored.outerHTML;
  for(const theme of ['light','dark']){
    const window=new Window();window.document.documentElement.dataset.theme=theme;window.document.head.innerHTML=`<style>${styles}</style>`;window.document.body.innerHTML=DASHBOARD_MARKUP;
    window.document.querySelector('.rd-main').innerHTML=APPLY_DOCK_MARKUP;
    assert.equal(window.getComputedStyle(window.document.querySelector('.rd-header')).display,'flex','Apply retains the default dock header');
    for(const[text,background]of [['.aj-navigation h2','.aj-window'],['.aj-label','.aj-card'],['.aj-small','.aj-card'],['#aj-profile'],['#aj-answer'],['#aj-start'],['.aj-badge.good'],['[data-action="import-queue-file"]'],['[data-action="manual-upload"]'],['[data-action="job-next"]']])check(window,text,background,`${theme} Apply ${text}`);
    reference.document.head.innerHTML=`<style>${sourceStyles.replace(/light-dark\((#[\da-f]+),(#[\da-f]+)\)/gi,(_,light,dark)=>theme==='light'?light:dark)}</style>`;reference.document.body.innerHTML=sourceMarkup;
    for(const [selector,properties]of [
      ['.aj-header h2',['fontSize','fontWeight']],
      ['.aj-prepared-head',['display','gridTemplateColumns','gap']],['.aj-prepared-document',['display','marginTop','paddingTop']],
      ['.aj-prepared-option',['borderRadius','padding']],['.aj-primary',['fontSize','padding','borderRadius']],
      ['#aj-profile',['padding','borderRadius']],['.aj-import-review',['display','gap','padding']],
    ]){
      const actualNode=window.document.querySelector(selector==='.aj-header h2'?'.aj-navigation h2':selector),expectedNode=reference.document.querySelector(selector);
      // Job-picker options are populated from live data; their styling is checked
      // against a reference-class element rather than a demo record.
      const actual=actualNode||Object.assign(window.document.createElement('button'),{className:'aj-prepared-option'}),expected=expectedNode||Object.assign(reference.document.createElement('button'),{className:'aj-prepared-option'});
      if(!actualNode)window.document.querySelector('.aj-prepared-job').append(actual);if(!expectedNode)reference.document.querySelector('#aj-job-picker').append(expected);
      for(const property of properties)assert.equal(window.getComputedStyle(actual)[property],reference.getComputedStyle(expected)[property],`${theme} ${selector} ${property} matches the authored reference`);
    }
    const frame=window.getComputedStyle(window.document.querySelector('.aj-window'));
    for(const [property,value]of Object.entries({borderRadius:'0px',maxWidth:'none',margin:'0px',borderWidth:'0px'}))assert.equal(frame[property],value,`${theme} Apply frame keeps the requested edge-to-edge layout`);
    const dock=window.getComputedStyle(window.document.querySelector('#at-reference-dock')),app=window.getComputedStyle(window.document.documentElement);
    for(const [selector,property,token,source]of [
      ['.aj-window','backgroundColor','--rd-bg',dock],['.aj-card','backgroundColor','--rd-panel',dock],
      ['.aj-navigation h2','color','--rd-text',dock],['.aj-small','color','--rd-muted',dock],
      ['#aj-start','backgroundColor','--color-accent-solid',app],['#aj-start','color','--color-on-accent',app],
    ])assert.equal(luminance(window.getComputedStyle(window.document.querySelector(selector))[property]),luminance(source.getPropertyValue(token)),`${theme} ${selector} inherits ${token}`);
    await window.happyDOM.abort();
  }
  const applyCss=await readFile('extension/apply-dock.css','utf8');assert.ok(!/light-dark\(|data-theme/.test(applyCss),'Apply has no independent theme palettes');
  assert.ok(!APPLY_DOCK_MARKUP.includes('data-action="theme"'),'Apply has no separate theme control');
  await outer.happyDOM.abort();await reference.happyDOM.abort();
});
