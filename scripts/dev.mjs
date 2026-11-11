import { watch } from 'node:fs';
import path from 'node:path';
import { buildExtension } from './build.mjs';
import { extensionRoot, projectRoot } from './paths.mjs';

let timer;
let running = false;
let pending = false;
let closed = false;

async function rebuild() {
  if (running) { pending = true; return; }
  running = true;
  try { await buildExtension(); }
  catch (error) { console.error(error.message); }
  finally {
    running = false;
    if (pending && !closed) { pending = false; await rebuild(); }
  }
}

try {
  await buildExtension();
  const changed = (event, filename) => {
    if (['studio/prompt-settings.js','content-scripts/inline-dock.js'].includes(String(filename).replaceAll('\\', '/'))) return;
    clearTimeout(timer);
    timer = setTimeout(() => { rebuild(); }, 200);
  };
  const watchers = [extensionRoot, path.join(projectRoot, 'src')].map(root => watch(root, { recursive: true }, changed));
  watchers.push(watch(path.join(projectRoot, 'Baseline/application-tracker-dock.html'), changed));
  for (const watcher of watchers) watcher.on('error', error => {
    console.error(`Watch failed: ${error.message}`);
    process.exitCode = 1;
    close();
  });
  function close() {
    closed = true;
    clearTimeout(timer);
    watchers.forEach(watcher => watcher.close());
  }
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
  console.log('Watching extension/ and src/prompts/. After a build, reload the extension in chrome://extensions and refresh the page you are testing.');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
