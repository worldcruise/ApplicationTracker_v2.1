import { cp, lstat, mkdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { checkExtension } from './check.mjs';
import { buildPrompts } from './build-prompts.mjs';
import { buildReferenceDashboard } from './build-reference-dashboard.mjs';
import { buildJobRecords } from './build-job-records.mjs';
import { buildApplyDock } from './build-apply-dock.mjs';
import { distRoot, extensionRoot, isMain, outputRoot, projectRoot } from './paths.mjs';

async function assertGeneratedDirectory(target) {
  const resolved = path.resolve(target);
  const relative = path.relative(path.resolve(distRoot), resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Refusing to replace a directory outside dist: ${resolved}`);
  }
  try {
    if ((await lstat(resolved)).isSymbolicLink()) {
      throw new Error(`Refusing to replace a linked output directory: ${resolved}`);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function buildExtension() {
  await buildPrompts();
  await buildReferenceDashboard();
  await buildJobRecords();
  await buildApplyDock();
  const result = await checkExtension(extensionRoot, { quiet: true });
  await mkdir(distRoot, { recursive: true });
  const actual = await realpath(distRoot);
  const expected = path.resolve(distRoot);
  const normalize = value => process.platform === 'win32' ? value.toLowerCase() : value;
  if (normalize(actual) !== normalize(expected)) {
    throw new Error(`Refusing to write through a linked dist directory: ${actual}`);
  }
  await assertGeneratedDirectory(outputRoot);
  await rm(outputRoot, { recursive: true, force: true });
  await cp(extensionRoot, outputRoot, { recursive: true, force: false, errorOnExist: true });
  console.log(`Built ${result.files} files into ${path.relative(projectRoot, outputRoot)}.`);
  return result;
}

if (isMain(import.meta.url)) {
  buildExtension().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
