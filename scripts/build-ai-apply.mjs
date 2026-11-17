import {createHash} from 'node:crypto';
import {readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {projectRoot,isMain} from './paths.mjs';

export async function buildAIApply(){
  const root=path.join(projectRoot,'extension/ai-apply'),hash=createHash('sha256');
  async function visit(directory=''){
    for(const entry of (await readdir(path.join(root,directory),{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){
      const relative=path.posix.join(directory,entry.name);
      if(entry.isDirectory())await visit(relative);
      else if(relative!=='src/build-info.js'){hash.update(relative);hash.update(await readFile(path.join(root,relative)));}
    }
  }
  await visit();
  const {version}=JSON.parse(await readFile(path.join(projectRoot,'extension/manifest.json'),'utf8'));
  const output=`// Generated identity for the integrated Apply to Job runtime.\nglobalThis.AiAgentBuild = Object.freeze(${JSON.stringify({id:hash.digest('hex'),version})});\n`;
  await writeFile(path.join(root,'src/build-info.js'),output);
}
if(isMain(import.meta.url))await buildAIApply();
