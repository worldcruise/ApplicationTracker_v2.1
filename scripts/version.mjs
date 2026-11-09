import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMain, projectRoot } from './paths.mjs';

export function validateVersion(version) {
  if (!/^2\.1\.(0|[1-9]\d*)$/.test(version) || Number(version.split('.')[2]) > 65535) {
    throw new Error('Use an Application Tracker version of 2.1.x with a numeric patch from 0 to 65535.');
  }
  return version;
}

export async function setProjectVersion(requested, root = projectRoot) {
  const files = ['package.json', 'package-lock.json', 'extension/manifest.json'];
  const [pkg, lock, manifest] = await Promise.all(files.map(async file => JSON.parse(await readFile(path.join(root, file), 'utf8'))));
  const current = requested ? null : validateVersion(pkg.version);
  const version = validateVersion(requested || `2.1.${Number(current.split('.')[2]) + 1}`);
  if (!lock.packages?.['']) throw new Error('The package lock is missing its root package.');
  pkg.version = lock.version = lock.packages[''].version = manifest.version = manifest.version_name = version;
  for (const [index, value] of [pkg, lock, manifest].entries()) {
    await writeFile(path.join(root, files[index]), JSON.stringify(value, null, 2) + '\n');
  }
  return version;
}

if (isMain(import.meta.url)) {
  setProjectVersion(process.argv[2]).then(version => console.log(`Application Tracker version ${version}`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}
