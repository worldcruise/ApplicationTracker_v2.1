import assert from 'node:assert/strict';
import test from 'node:test';
import {readCoverLetter} from '../extension/studio/cover-letter-import.js';

test('cover letters accept text and Markdown and reject unsupported or oversized files', async()=>{
  for(const name of ['letter.txt','letter.MD']) assert.equal(await readCoverLetter({name,size:5,text:async()=> 'Hello'}),'Hello');
  await assert.rejects(readCoverLetter({name:'letter.docx',size:5}),/\.txt, \.md, or \.pdf/);
  await assert.rejects(readCoverLetter({name:'letter.pdf',size:7*1024*1024}),/6 MiB/);
});

test('PDF import preserves page and line order and releases the reader on success or empty text', async()=>{
  let destroyed=0;
  const file={name:'letter.PDF',size:100,arrayBuffer:async()=>new ArrayBuffer(2)};
  const options={};
  const reader=items=>async()=>({GlobalWorkerOptions:options,getDocument:()=>({promise:Promise.resolve({numPages:2,getPage:async number=>({getTextContent:async()=>({items:items(number)})})}),destroy:async()=>{destroyed++;}})});
  assert.equal(await readCoverLetter(file,reader(number=>[{str:`Page ${number}`,hasEOL:true},{str:'Paragraph'}])),'Page 1\nParagraph\n\nPage 2\nParagraph');
  assert.match(options.workerSrc,/pdf\.worker\.min\.mjs$/);
  await assert.rejects(readCoverLetter(file,reader(()=>[])),/no readable text/);
  assert.equal(destroyed,2);
});
