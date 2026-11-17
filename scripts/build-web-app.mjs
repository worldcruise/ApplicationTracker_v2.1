import {build} from 'esbuild';
import path from 'node:path';
import {projectRoot,isMain} from './paths.mjs';

export async function buildWebApp(){
  await build({entryPoints:[path.join(projectRoot,'src/vendor-react.js')],outfile:path.join(projectRoot,'extension/vendor/react.js'),bundle:true,format:'esm',platform:'browser',target:'chrome116',minify:true,define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
  await build({entryPoints:[path.join(projectRoot,'src/web-app.jsx')],outfile:path.join(projectRoot,'extension/web-app.js'),bundle:true,format:'esm',platform:'browser',target:'chrome116',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',plugins:[{
    name:'shared-runtime',setup(builder){builder.onResolve({filter:/extension\/(studio|vendor)\//},args=>({path:'./'+args.path.split('extension/')[1],external:true}));}
  }]});
}
if(isMain(import.meta.url))await buildWebApp();
