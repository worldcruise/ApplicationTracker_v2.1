import test from 'node:test';
import assert from 'node:assert/strict';
import {readSavedQueueFile} from '../extension/studio/saved-queue-file.js';

test('queue imports read the actual completed PDF from its candidate-owned export folder',async()=>{
  const job={candidateId:'one',resume:{export:{state:'complete',bindingId:'root',companyFolder:'Employer',fileName:'resume.pdf'}}},opened=[];
  const store={root:async()=>({candidateId:'one',handle:{queryPermission:async()=> 'granted',getDirectoryHandle:async name=>{opened.push(name);return {getFileHandle:async filename=>{opened.push(filename);return {getFile:async()=>({size:4,arrayBuffer:async()=>new TextEncoder().encode('%PDF saved').buffer})};}};}}})};
  assert.deepEqual(await readSavedQueueFile(job,store),{resumeBase64:btoa('%PDF saved'),fileName:'resume.pdf'});assert.deepEqual(opened,['Employer','resume.pdf']);
  await assert.rejects(readSavedQueueFile({...job,candidateId:'two'},store),/Choose the export folder/);
  await assert.rejects(readSavedQueueFile({...job,resume:{export:{...job.resume.export,state:'pending'}}},store),/not complete/);
  await assert.rejects(readSavedQueueFile({...job,resume:{export:{...job.resume.export,fileName:'../resume.pdf'}}},store),/invalid/);
  assert.equal(await readSavedQueueFile({resume:{}}),null);
});
