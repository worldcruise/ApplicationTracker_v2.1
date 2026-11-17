import {build} from 'esbuild';
import path from 'node:path';
import {projectRoot,isMain} from './paths.mjs';
export async function buildApplyDock(){
  for(const [source,target]of [['src/dock-apply-content.js','extension/content-scripts/dock-apply.js'],['src/apply-network-content.js','extension/content-scripts/apply-network.js']])
    await build({entryPoints:[path.join(projectRoot,source)],outfile:path.join(projectRoot,target),bundle:true,format:'iife',target:'chrome116',legalComments:'none'});
}
if(isMain(import.meta.url))await buildApplyDock();
