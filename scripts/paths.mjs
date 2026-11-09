import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const extensionRoot = path.join(projectRoot, 'extension');
export const distRoot = path.join(projectRoot, 'dist');
export const outputRoot = path.join(distRoot, 'autofill');

export function isMain(moduleUrl) {
  return Boolean(process.argv[1]) &&
    path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

export async function listFiles(directory) {
  const files = [];

  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const target = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Extension files must not be symlinks: ${target}`);
      }
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile()) files.push(target);
    }
  }

  await visit(directory);
  return files;
}
