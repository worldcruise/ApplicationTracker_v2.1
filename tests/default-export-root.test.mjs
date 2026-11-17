import test from 'node:test';
import assert from 'node:assert/strict';
import {IDBFactory} from 'fake-indexeddb';
import {createQueueDirectoryStore} from '../extension/studio/queue-export-folder.js';
import {defaultExportRoot,saveDefaultExportRoot,saveDefaultExportRootPath} from '../extension/studio/default-export-root.js';

test('default root creates reusable candidate-owned folder bindings for Studio and queue exports',async()=>{
  const values={},storage={get:async key=>({[key]:values[key]}),set:async next=>Object.assign(values,next)},store=createQueueDirectoryStore(new IDBFactory());
  assert.equal(await defaultExportRoot('one',storage,store),null);
  await saveDefaultExportRoot({name:'Exports',kind:'directory'},storage,store);
  const first=await defaultExportRoot('one',storage,store),second=await defaultExportRoot('two',storage,store);
  assert.equal(first.name,'Exports');assert.equal(first.candidateId,'one');assert.equal(second.candidateId,'two');assert.notEqual(first.id,second.id);
  assert.deepEqual(await store.matching('one','Exports'),first);assert.equal((await defaultExportRoot('one',storage,store)).id,first.id);
  await saveDefaultExportRoot({name:'New exports',kind:'directory'},storage,store);assert.equal((await defaultExportRoot('one',storage,store)).name,'New exports');
});

test('full display paths persist without changing export handles or folder bindings',async()=>{
  const values={},storage={get:async key=>({[key]:values[key]}),set:async next=>Object.assign(values,next)},store=createQueueDirectoryStore(new IDBFactory());
  const selected=await saveDefaultExportRoot({name:'Tom',kind:'directory'},storage,store);
  const before=await defaultExportRoot('one',storage,store);
  const saved=await saveDefaultExportRootPath(selected.id,'"D:\\Profiles\\Tom"',storage);
  assert.equal(saved.path,'D:\\Profiles\\Tom');
  assert.deepEqual(await defaultExportRoot('one',storage,store),before);
  await assert.rejects(saveDefaultExportRootPath(selected.id,'Tom',storage),/full folder path/);
  await assert.rejects(saveDefaultExportRootPath(selected.id,'D:\\Profiles\\Other',storage),/selected folder name/);
  await assert.rejects(saveDefaultExportRootPath('stale-id','D:\\Profiles\\Tom',storage),/selected folder changed/);
  assert.equal((await saveDefaultExportRootPath(selected.id,'',storage)).path,'');
  const replacement=await saveDefaultExportRoot({name:'Other',kind:'directory'},storage,store);
  assert.equal(replacement.path,undefined);
});
