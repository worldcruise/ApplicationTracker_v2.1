import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { isMain, projectRoot } from './paths.mjs';
export async function buildPrompts() {
  const root = path.join(projectRoot, 'src/prompts');
  const target = path.join(projectRoot, 'extension/studio/prompt-settings.js');
  const result = await build({ absWorkingDir: projectRoot, entryPoints: [path.join(root, 'index.ts')], outfile: target,
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'chrome116', tsconfigRaw: {}, jsx: 'automatic',
    plugins: [{ name: 'host-react', setup(builder) {
      builder.onResolve({ filter: /^react$/ }, () => ({ path: path.join(root, 'react-host.ts') }));
      builder.onResolve({ filter: /^react\/jsx-runtime$/ }, () => ({ path: path.join(root, 'jsx-host.ts') }));
      builder.onResolve({ filter: /extension\/studio\/storage\.js$/ }, () => ({ path: './storage.js', external: true }));
      builder.onResolve({ filter: /\.css$/ }, () => ({ path: 'styles', namespace: 'styles' }));
      builder.onLoad({ filter: /.*/, namespace: 'styles' }, () => ({ contents: '', loader: 'js' }));
    } }],
  });
  const code = result.outputFiles[0].text;
  const previous = await readFile(target, 'utf8').catch(error => { if (error.code === 'ENOENT') return ''; throw error; });
  if (previous !== code) await writeFile(target, code);
  await build({absWorkingDir:projectRoot,entryPoints:[path.join(root,'prompt-templates.ts')],outfile:path.join(projectRoot,'extension/studio/prompt-repository.js'),bundle:true,format:'esm',platform:'browser',target:'chrome116'});
}
if (isMain(import.meta.url)) buildPrompts().catch(error => { console.error(error.message); process.exitCode = 1; });
