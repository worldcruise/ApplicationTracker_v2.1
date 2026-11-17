import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import test from 'node:test';
const execute=promisify(execFile);
async function check(route,action){const {stderr}=await execute(process.execPath,['scripts/web-runtime-smoke.mjs',route,...action?[action]:[]],{windowsHide:true,timeout:15000});const report=JSON.parse(stderr.split('\n').find(line=>line.startsWith('{"route"')));assert.deepEqual(report.errors,[]);return report;}
test('current web pages mount with no old account or application providers',async()=>{
  const cases=[['/','Applications'],['/dashboard','Make your next move.'],['/meetings','Meetings'],['/?tab=queue','Applications'],['/settings/profile','Settings'],['/settings/ai/resume-generation','Resume Generation'],['/settings/ai/autofill','Autofill'],['/settings/ai/candidate','Settings'],['/settings/ai/prompt','Prompt settings'],['/settings/keywords','Keyword highlights'],['/settings/keyboard','Keyboard shortcuts'],['/settings/other','Other']];
  for(const [route,heading]of cases){const report=await check(route);assert.ok(report.headings.includes(heading),route+': '+report.text);}
});
for(const [label,route,action]of [['sidebar state','/dashboard','sidebar-toggle'],['application search','/','filters'],['application board','/','application-board'],['calendar controls','/meetings','calendar-ranges'],['local header actions','/dashboard','header-actions'],['Studio preview navigation','/resume-studio','studio']])test(label,()=>check(route,action));
