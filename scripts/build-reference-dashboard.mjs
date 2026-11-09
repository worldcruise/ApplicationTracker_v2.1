import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { isMain } from './paths.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const icons = createRequire(import.meta.url)('lucide');
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
async function writeChanged(file, text) {
  try { if (await readFile(file, 'utf8') === text) return; } catch (error) { if (error.code !== 'ENOENT') throw error; }
  await writeFile(file, text);
}
function svg([tag, attributes, children = []], name) {
  const props = tag === 'svg' ? { ...attributes, width: 20, height: 20, 'stroke-width': 1.8, class: `lucide lucide-${name}`, 'aria-hidden': 'true' } : attributes;
  return `<${tag} ${Object.entries(props).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>${children.map(child => svg(child)).join('')}</${tag}>`;
}
export async function buildReferenceDashboard() {
  const source = await readFile(path.join(root, 'Baseline/application-tracker-dock.html'), 'utf8');
  const styles = [...source.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(match => match[1]);
  if (styles.length !== 2) throw new Error('The reference dashboard styles changed.');
  let markup = source.slice(source.indexOf('<div id="at-reference-dock">'), source.lastIndexOf('</div>') + 6)
    .replace(/<style>[\s\S]*?<\/style>/g, '').replace(/<script>[\s\S]*?<\/script>/g, '')
    .replace(/<i data-lucide="([^"]+)"[^>]*><\/i>/g, (_, name) => {
      const icon = icons[name.split('-').map(word => word[0].toUpperCase() + word.slice(1)).join('')];
      if (!icon) throw new Error(`Missing reference icon: ${name}`);
      return svg(icon, name);
    }).replace('>Application Tracker</span>', '>Application Tracker 2.1</span>')
    .replaceAll('Schedule Meeting', 'Meetings');
  const activity = markup.match(/<button[^>]*class="rd-activity application[^>]*>([\s\S]*?)<\/button>/)?.[1]
    ?.replace(/(<span class="rd-(?:activity-title|activity-company|time)">)[^<]*(<\/span>)/g, '$1$2');
  if (!activity) throw new Error('The reference activity markup changed.');
  // Reference records are design samples; the controller fills these from saved data.
  markup = markup.replace(/<select([^>]*)>[\s\S]*?<\/select>/, '<select$1 disabled><option value="">Candidate</option></select>')
    .replace('id="rd-name">Phoenix', 'id="rd-name">…').replace('id="rd-avatar">P', 'id="rd-avatar">–')
    .replace(/(<div class="rd-stat[^>]*>[\s\S]*?<strong>)[^<]*(<\/strong>)/g, '$1—$2')
    .replace(/<section class="rd-recent"[\s\S]*?<\/section>/, '<section class="rd-recent" aria-label="Recent activity"><p class="rd-empty">Loading activity…</p></section>');
  await writeChanged(path.join(root, 'extension/studio/reference-dashboard-markup.js'), `// Generated from Baseline/application-tracker-dock.html. Edit that reference or the generator.\nexport const DASHBOARD_MARKUP = ${JSON.stringify(markup)};\nexport const ACTIVITY_MARKUP = ${JSON.stringify(activity)};\n`);
  const palette = {
    '#121213':'#f7f7fa','#202022':'#ffffff','#323035':'#e2dfe7','#efedf2':'#28232e','#a19ba6':'#766d7f','#a18af0':'#7958c8','#57cfa5':'#226f56','#f29a55':'#92501c','#69c5df':'#286d84',
    '#2c292f':'#e1dce7','#262428':'#ebe7ef','#c8c2ce':'#5c5268','#1c1b1e':'#f0edf4','#302d33':'#e0d9e8','#34303f':'#ded5e9','#aca6b3':'#74667e',
    '#211c31':'#f1ecfb','#342b48':'#dcd0f2','#152d24':'#eaf7f0','#284539':'#cee9dc','#332217':'#fff2e7','#493326':'#efd8c5',
    '#3b2d53':'#dfd2ef','#241d32':'#f2ecfb','#ece8f1':'#342b40','#9e92ac':'#85728f','#241e34':'#f1ecfb','#3b2c55':'#ddcef0',
    '#301c32':'#f9edf9','#4c2751':'#ebd1ee','#d79cdb':'#aa5faf','#192e27':'#eaf6ef','#254a3d':'#cce7d8','#192d34':'#eaf4f8','#28434d':'#cde2eb',
    '#332319':'#fff1e6','#4c3526':'#efd6c0','#343136':'#e4dfe9','#2a2630':'#f3eef8','#f0edf2':'#332a3c','#26202f':'#f2ecfa','#423350':'#dcd0ed','#d3c5e8':'#70528e',
  };
  const light = styles[1].replace(/#at-reference-dock/g, 'html[data-theme="light"] #at-reference-dock').replace(/#[a-f\d]{6}\b/gi, color => palette[color] || color).replace('color-scheme:dark','color-scheme:light');
  // Expose the existing Dashboard component colors to other dock views, without
  // introducing another palette. Their light values use the same mapping above.
  const background = selector => {
    const start=styles[1].indexOf(`${selector}{`),end=styles[1].indexOf('}',start);
    const value=styles[1].slice(start,end).match(/(?:\{|;)background:(#[\da-f]+)/i)?.[1];
    if(start<0||!value)throw Error(`The shared dock color changed: ${selector}`);
    return value;
  };
  const sharedTokens={soft:background('.rd-refresh'),'accent-soft':background('.rd-stat-resume'),'good-soft':background('.rd-stat-applications'),'warn-soft':background('.rd-stat-meetings')};
  const sharedStyles=`#at-reference-dock { ${Object.entries(sharedTokens).map(([name,value])=>`--rd-${name}:${value};`).join(' ')} }\nhtml[data-theme="light"] #at-reference-dock { ${Object.entries(sharedTokens).map(([name,value])=>`--rd-${name}:${palette[value]||value};`).join(' ')} }`;
  const extra = `\n:root { --reference-dashboard-bg: #f7f7fa; }\n:root[data-theme="dark"] { --reference-dashboard-bg: #121213; }\nbody.reference-dashboard { margin: 0; background: var(--reference-dashboard-bg); }\n#at-reference-dock .rd-empty { margin: 0; padding: 18px 11px; font-size: 12px; color: var(--rd-muted); text-align: center; }\nhtml[data-theme] #at-reference-dock .rd-header { height:auto; min-height:53px; flex-wrap:wrap; }\nhtml[data-theme] #at-reference-dock .rd-person { max-width:100%; }\nhtml[data-theme] #at-reference-dock .rd-select { width:auto; max-width:250px; }\n#at-reference-dock button { cursor: pointer; }\n#at-reference-dock button:disabled { cursor: wait; opacity: .6; }\n`;
  await writeChanged(path.join(root, 'extension/dashboard.css'), `/* Original reference styles; local light palette follows. */\n${styles[1]}\n${light}\n${sharedStyles}\n${extra}`);
  await writeChanged(path.join(root, 'extension/dashboard.html'), '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Application Tracker 2.1 — Dashboard</title><link rel="icon" href="icons/icon-32.png"><link rel="stylesheet" href="studio/theme.css"><link rel="stylesheet" href="dashboard.css"><link rel="stylesheet" href="job-records.css"><link rel="stylesheet" href="apply-dock.css"><script type="module" src="studio/theme-bootstrap.js"></script></head><body class="reference-dashboard"><div id="reference-dashboard-root"></div><script type="module" src="dashboard.js"></script></body></html>\n');
  await writeChanged(path.join(root, 'extension/studio/LUCIDE-LICENSE.txt'), await readFile(path.join(root, 'node_modules/lucide/LICENSE'), 'utf8'));
}
if (isMain(import.meta.url)) await buildReferenceDashboard();
