import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {setTimeout as delay} from 'node:timers/promises';
import {openSubmittedDocument,viewDocumentInStudio} from '../extension/studio/submitted-document-view.js';
import {mountNativePDF} from '../extension/studio/native-pdf-view.js';

test('document modals preview the saved PDF, replace older modals and open a read-only Studio document',async t=>{
  const page=new Window({settings:{enableIframePageLoading:true}});t.after(()=>page.happyDOM.abort());
  const record={id:'remote:application one',type:'applications',company:'Example',role:'Engineer',coverLetterRaw:'Dear hiring team,\nMy submitted cover letter.',resume:{snapshot:{candidate:{name:'Alex Example'},resume:{title:'Engineer',summary:'The submitted resume summary.'}}}},before=structuredClone(record),tabs=[],updates=[];
  const browser={runtime:{getURL:path=>'chrome-extension://test/'+path},windows:{getCurrent:async()=>({id:4})},tabs:{query:async()=>tabs,create:async input=>{const tab={...input,id:tabs.length+1};tabs.push(tab);return tab;},update:async(id,input)=>{updates.push({id,...input});return tabs.find(tab=>tab.id===id);}}};
  const loaded=[],revoked=[],options={browser,readPDF:async(value,kind)=>{loaded.push({value,kind});return {base64:btoa('%PDF-1.7\nSaved '+kind),documentRevision:1};},mountPDF:(host,settings)=>mountNativePDF(host,{...settings,url:{createObjectURL:()=>`about:blank?preview=${loaded.length}`,revokeObjectURL:value=>revoked.push(value)}})};
  const resume=openSubmittedDocument(page.document.body,record,'resume',options);await delay(0);
  assert.match(resume.querySelector('iframe').src,/^about:blank/);assert.equal(loaded[0].value,record);assert.equal(loaded[0].kind,'resume');
  resume.querySelector('iframe').dispatchEvent(new page.Event('load'));assert.equal(resume.dataset.previewState,'ready');
  assert.equal(resume.querySelector('input,textarea'),null);
  const letter=openSubmittedDocument(page.document.body,record,'letter',options);await delay(0);
  assert.equal(resume.isConnected,false);assert.equal(page.document.querySelectorAll('.jr-document-dialog').length,1);
  assert.equal(loaded[1].kind,'letter');assert.match(letter.querySelector('iframe').src,/^about:blank/);assert.equal(revoked.length,1);
  letter.querySelector('.document-studio-action').click();
  for(let i=0;i<100&&!tabs.length;i++)await delay(5);
  const destination=new URL(tabs[0].url);assert.equal(destination.searchParams.get('submitted'),record.id);assert.equal(destination.searchParams.get('kind'),'letter');assert.equal(tabs[0].windowId,4);
  await viewDocumentInStudio(record,'letter',browser);assert.equal(tabs.length,1);assert.deepEqual(updates,[{id:1,active:true}]);
  letter.querySelector('[data-document-action=close]').click();assert.equal(page.document.querySelector('.jr-document-dialog'),null);
  assert.deepEqual(record,before);
});

test('a closed modal ignores a late PDF response and failed previews remain dismissible',async t=>{
  const page=new Window();t.after(()=>page.happyDOM.abort());let resolve,mounted=0;
  const record={id:'saved',type:'applications',company:'Employer'},dialog=openSubmittedDocument(page.document.body,record,'resume',{readPDF:()=>new Promise(done=>{resolve=done;}),mountPDF:()=>{mounted++;}});
  dialog.querySelector('[data-document-action=close]').click();await delay(0);resolve({base64:'late'});await delay(0);assert.equal(mounted,0);
  const failed=openSubmittedDocument(page.document.body,record,'resume',{readPDF:async()=>{throw Error('The saved resume is unavailable.');}});await delay(0);
  assert.equal(failed.dataset.previewState,'error');assert.match(failed.querySelector('[role=alert]').textContent,/unavailable/);failed.querySelector('[data-document-action=close]').click();
});
