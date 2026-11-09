import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { extensionRoot, isMain, listFiles, projectRoot } from './paths.mjs';
import { validateVersion } from './version.mjs';

const remoteReference = /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i;

export async function checkExtension(directory = extensionRoot, { quiet = false } = {}) {
  const files = await listFiles(directory);
  const names = new Set(files.map(file => path.relative(directory, file).split(path.sep).join('/')));
  const errors = [];
  let scripts = 0;
  let jsonFiles = 0;

  function reference(from, value, label, { external = false, glob = false } = {}) {
    if (typeof value !== 'string' || !value.trim()) {
      errors.push(`${from}: ${label} must be a nonempty path.`);
      return;
    }
    if (remoteReference.test(value)) {
      if (!external) errors.push(`${from}: ${label} must reference a packaged file (${value}).`);
      return;
    }

    const clean = value.split(/[?#]/)[0];
    const target = path.posix.normalize(clean.startsWith('/')
      ? clean.slice(1)
      : path.posix.join(path.posix.dirname(from), clean));
    if (target === '..' || target.startsWith('../') || target.includes('\\')) {
      errors.push(`${from}: ${label} escapes the extension or uses a backslash (${value}).`);
      return;
    }

    if (glob && target.includes('*')) {
      const pattern = new RegExp('^' + target.split('*')
        .map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$');
      if (![...names].some(name => pattern.test(name))) {
        errors.push(`${from}: ${label} matches no packaged files (${value}).`);
      }
    } else if (!names.has(target)) {
      errors.push(`${from}: missing ${label}: ${value}`);
    }
  }

  for (const file of files) {
    const name = path.relative(directory, file).split(path.sep).join('/');
    const extension = path.extname(file);
    if (!['.json', '.html', '.js', '.mjs', '.css'].includes(extension)) continue;
    const source = await readFile(file, 'utf8');

    if (extension === '.json') {
      jsonFiles++;
      try { JSON.parse(source); }
      catch (error) { errors.push(`${name}: invalid JSON: ${error.message}`); }
    }

    if (extension === '.js' || extension === '.mjs') {
      scripts++;
      const result = spawnSync(process.execPath, ['--check', file], {
        encoding: 'utf8', windowsHide: true,
      });
      if (result.error || result.status !== 0) {
        errors.push(`${name}: ${result.error?.message || result.stderr.trim() || 'JavaScript syntax check failed.'}`);
      }

      // Check literal local paths in the shipped bundles. This intentionally
      // skips bare package names (also present in library help strings).
      // Dynamic expressions and package resolution need browser verification.
      const imports = /\b(?:from\s*|import\s*(?:\(\s*)?)["']((?:\.{1,2}\/|\/)[^"'\s]+)["']/g;
      for (const match of source.matchAll(imports)) {
        reference(name, match[1], 'module import');
      }
    }

    if (extension === '.html') {
      const assets = /<(?:script|link|img|iframe)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi;
      for (const match of source.matchAll(assets)) {
        reference(name, match[1], 'HTML asset', { external: true });
      }
    }

    if (extension === '.css') {
      const assets = /url\(\s*["']?([^\s)'"?]+)(?:\?[^)'" ]*)?["']?\s*\)/g;
      for (const match of source.matchAll(assets)) {
        reference(name, match[1], 'CSS asset', { external: true });
      }
    }
  }

  let manifest;
  try { manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')); }
  catch (error) { errors.push(`manifest.json: ${error.message}`); }

  if (manifest) {
    if (manifest.manifest_version !== 3) errors.push('manifest.json: Manifest V3 is required.');
    try {
      validateVersion(manifest.version);
      const [pkg, lock] = await Promise.all(['package.json', 'package-lock.json'].map(async file => JSON.parse(await readFile(path.join(projectRoot, file), 'utf8'))));
      const versions = [manifest.version_name, pkg.version, lock.version, lock.packages?.['']?.version];
      if (versions.some(version => version !== manifest.version)) errors.push('Project, package lock, extension version and version_name must match. Run npm.cmd run version:patch to update them together.');
    } catch (error) { errors.push(`Version validation: ${error.message}`); }
    if (manifest.key || manifest.update_url) {
      errors.push('manifest.json: remove the upstream key and update_url from this local development copy.');
    }
    const add = (value, label) => {
      if (value !== undefined) reference('manifest.json', value, label);
    };
    const addIcons = (icons, label) => {
      for (const icon of typeof icons === 'string' ? [icons] : Object.values(icons || {})) add(icon, label);
    };
    add(manifest.background?.service_worker, 'service worker');
    add(manifest.action?.default_popup, 'popup');
    add(manifest.options_page, 'options page');
    add(manifest.options_ui?.page, 'options page');
    add(manifest.side_panel?.default_path, 'side panel');
    addIcons(manifest.icons, 'icon');
    addIcons(manifest.action?.default_icon, 'action icon');
    for (const content of manifest.content_scripts || []) {
      for (const value of [...content.js || [], ...content.css || []]) add(value, 'content script asset');
    }
    for (const rule of manifest.declarative_net_request?.rule_resources || []) add(rule.path, 'network rules');
    for (const resource of manifest.web_accessible_resources || []) {
      for (const value of resource.resources || []) {
        reference('manifest.json', value, 'web accessible resource', { glob: true });
      }
    }
  }

  if (errors.length) throw new Error(`Extension validation failed:\n${errors.map(error => `- ${error}`).join('\n')}`);
  const result = { files: files.length, scripts, jsonFiles, manifest };
  if (!quiet) console.log(`Checked ${result.files} files: ${scripts} JavaScript, ${jsonFiles} JSON; packaged references resolve.`);
  return result;
}

if (isMain(import.meta.url)) {
  checkExtension().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
