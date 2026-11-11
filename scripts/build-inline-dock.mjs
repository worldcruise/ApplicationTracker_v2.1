import {build} from 'esbuild';
import path from 'node:path';
import {projectRoot,isMain} from './paths.mjs';

export async function buildInlineDock(){
  await build({entryPoints:[path.join(projectRoot,'src/inline-dock-content.js')],outfile:path.join(projectRoot,'extension/content-scripts/inline-dock.js'),bundle:true,format:'iife',target:'chrome116',legalComments:'none',loader:{'.css':'text'},
    plugins:[{name:'extension-origin-cv-editor',setup(builder){builder.onResolve({filter:/queue-resume-input\.js$/},()=>({path:path.join(projectRoot,'src/inline-cv-input.js')}));}}]});
}
if(isMain(import.meta.url))await buildInlineDock();
