import test from 'node:test';
import assert from 'node:assert/strict';
import {createPromptRepository,PROMPT_LIBRARY_KEY} from '../extension/studio/prompt-repository.js';
import {RESUME_JSON_PROMPT,RESUME_JSON_TEMPLATE} from '../extension/studio/resume-json-prompt.js';

test('application prompts include the exact conversion text in new and existing libraries',async()=>{
  for(const existing of [null,{revision:1,selectedId:'custom',templates:[{id:'custom',title:'My prompt',text:'Keep my instructions.'}]}]){
    const values=existing?{[PROMPT_LIBRARY_KEY]:structuredClone(existing)}:{};
    const repo=createPromptRepository({setAccessLevel:async()=>{},get:async()=>values,set:async input=>Object.assign(values,input)},task=>task());
    const library=await repo.read();assert.equal(library.templates.find(item=>item.id===RESUME_JSON_TEMPLATE.id).text,RESUME_JSON_PROMPT);
    if(existing)assert.equal(library.selectedId,'custom');
    const selected=await repo.selectDefault(RESUME_JSON_TEMPLATE.id,library.revision);assert.equal(selected.selectedId,RESUME_JSON_TEMPLATE.id);
    assert.equal((await repo.read()).templates.filter(item=>item.id===RESUME_JSON_TEMPLATE.id).length,1);
  }
});
