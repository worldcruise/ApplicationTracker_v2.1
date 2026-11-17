import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {mountNativePDF,pdfBytes} from '../extension/studio/native-pdf-view.js';
import {createRecordPDFRenderer,registerDocumentPreviewRenderer} from '../extension/studio/document-preview-renderer.js';
import {createDockRecordsService} from '../extension/studio/dock-records-service.js';
import {dockFixture} from './helpers/dock-records-fixture.mjs';

test('native viewer retains the completed revision, ignores obsolete loads and revokes all URLs',async t=>{
  const page=new Window({settings:{enableIframePageLoading:true}});t.after(()=>page.happyDOM.abort());const host=page.document.createElement('section');page.document.body.append(host);
  const blobs=[],revoked=[],rendered=[],failed=[],viewer=mountNativePDF(host,{url:{createObjectURL:blob=>{blobs.push(blob);return 'about:blank?pdf='+blobs.length;},revokeObjectURL:url=>revoked.push(url)},onRendered:revision=>rendered.push(revision),onFailure:(revision,message)=>failed.push({revision,message})});
  const pdf=revision=>({base64:btoa('%PDF-1.7\nRevision '+revision),documentRevision:revision,pageCount:2});
  viewer.show(pdf(1));const first=host.querySelector('iframe');first.dispatchEvent(new page.Event('load'));assert.deepEqual(rendered,[1]);assert.equal(host.dataset.documentRevision,'1');
  assert.equal(blobs[0].type,'application/pdf');assert.equal(await blobs[0].text(),'%PDF-1.7\nRevision 1');
  viewer.show(pdf(2));const obsolete=host.lastElementChild;assert.equal(first.isConnected,true);assert.equal(obsolete.getAttribute('aria-hidden'),'true');
  viewer.show(pdf(3));obsolete.dispatchEvent(new page.Event('load'));assert.deepEqual(rendered,[1]);assert.equal(first.isConnected,true);
  const latest=host.lastElementChild;latest.dispatchEvent(new page.Event('load'));assert.deepEqual(rendered,[1,3]);assert.equal(first.isConnected,false);assert.equal(host.dataset.pageCount,'2');assert.equal(latest.getAttribute('aria-hidden'),null);
  viewer.show({base64:btoa('invalid document'),documentRevision:4});assert.equal(failed.length,1);assert.equal(latest.isConnected,true);assert.equal(blobs.length,3);
  viewer.dispose();latest.dispatchEvent(new page.Event('load'));assert.deepEqual(rendered,[1,3]);assert.equal(host.childElementCount,0);assert.deepEqual(revoked.sort(),['about:blank?pdf=1','about:blank?pdf=2','about:blank?pdf=3']);
  assert.throws(()=>pdfBytes({base64:'%%%'}));
});

test('record PDF preview renders the stored snapshot and cover letter without changing the editor or record',async t=>{
  const fixture=await dockFixture(t),record=await fixture.ready(await fixture.create()),renders=[];
  const service=createDockRecordsService({...fixture.deps,renderRecordPDF:async(row,kind)=>{renders.push({row:structuredClone(row),kind});return {base64:'saved-pdf'};}}),before=structuredClone(fixture.draft),sender={id:fixture.browser.runtime.id,url:fixture.browser.runtime.getURL('dashboard.html')};
  const payload={id:record.id,type:'queue',expectedRevision:record.revision,kind:'resume'};
  assert.equal((await service.handle('DOCK_RECORDS_DOCUMENT_PREVIEW',payload,sender)).base64,'saved-pdf');assert.equal(renders[0].row.resume.snapshot.resume.summary,'Real saved summary');assert.deepEqual(fixture.draft,before);
  await assert.rejects(service.handle('DOCK_RECORDS_DOCUMENT_PREVIEW',{...payload,expectedRevision:0},sender),/record changed/);
  await assert.rejects(service.handle('DOCK_RECORDS_DOCUMENT_PREVIEW',{...payload,kind:'jd'},sender),/Choose a saved/);
  const beforeRecord=(await service.handle('DOCK_RECORDS_STATE',{},sender)).jobs.find(row=>row.id===record.id);assert.equal(beforeRecord.revision,record.revision);
});

test('offscreen preview accepts only the worker and uses the frozen profile, formatting and letter',async()=>{
  let listener,ensured=0;const calls=[],browser={runtime:{id:'test',getURL:path=>'chrome-extension://test/'+path,onMessage:{addListener:fn=>{listener=fn;},removeListener:()=>{}},sendMessage:message=>new Promise(resolve=>{assert.equal(listener(message,{id:'test',url:'chrome-extension://test/service-worker.js'},resolve),true);})}};
  const unregister=registerDocumentPreviewRenderer({browser,validate:snapshot=>assert.equal(snapshot.candidate.name,'Original Name'),render:async(snapshot,letter)=>{calls.push({snapshot,letter});return {bytes:new TextEncoder().encode('%PDF-1.7\nFrozen preview'),sha256:'abc',pageCount:1};}});
  const record={company:'Employer',coverLetterRaw:'First paragraph.\n\nSecond paragraph.',resume:{snapshot:{candidate:{id:'frozen',name:'Original Name'},draftId:'original-draft',documentRevision:7,formattingOverrides:{fontSize:11}}}},before=structuredClone(record);
  const render=createRecordPDFRenderer({browser,ensure:async()=>ensured++}),pdf=await render(record,'letter');
  assert.equal(ensured,1);assert.equal(pdf.documentRevision,7);assert.equal(atob(pdf.base64),'%PDF-1.7\nFrozen preview');assert.equal(pdf.filename,'cover letter.pdf');assert.deepEqual(calls[0].letter,{schemaVersion:1,candidateId:'frozen',jobId:'original-draft',paragraphs:['First paragraph.','Second paragraph.']});assert.deepEqual(record,before);
  assert.equal(listener({target:'offscreen',version:1,requestId:'x',operation:'RENDER_DOCUMENT_PREVIEW'},{id:'test',url:'https://employer.test',tab:{id:1}},()=>{}),false);unregister();
});
