import {withRequestDeadline} from './request-deadline.js';
import {readRecordPDF} from './record-pdf-preview.js';
import {mountNativePDF} from './native-pdf-view.js';
export async function viewDocumentInStudio(record,kind,browser=globalThis.chrome){
  const window=await browser.windows.getCurrent();
  if(record.type==='queue'){
    const reply=await withRequestDeadline(browser.runtime.sendMessage({version:1,requestId:crypto.randomUUID(),operation:'DOCK_RECORDS_OPEN_RESUME',payload:{id:record.id,type:'queue',expectedRevision:record.revision,windowId:window.id}}));
    if(!reply?.ok)throw Error(reply?.error?.message||'Resume Studio could not open.');return reply.result;
  }
  const url=browser.runtime.getURL('preview.html')+'?'+new URLSearchParams({submitted:record.id,kind:kind==='letter'?'letter':'resume'});
  const tabs=await browser.tabs.query({windowId:window.id}),existing=tabs.find(tab=>tab.url===url);
  return existing?browser.tabs.update(existing.id,{active:true}):browser.tabs.create({windowId:window.id,url,active:true});
}
export function buildSubmittedDocument(doc,record,kind){
  const el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  const body=el('article',null,'jr-document-copy');
  if(kind==='letter')body.textContent=record.coverLetterRaw??record.resume?.coverLetterRaw??'';
  else{
    const snapshot=record.resume?.snapshot||{},cv=snapshot.resume||JSON.parse(record.resume?.cvJsonRaw||'{}'),profile=snapshot.profile||{};
    body.classList.add('jr-resume-copy');
    body.append(el('h2',snapshot.candidate?.name||record.candidateName),el('p',cv.title,'jr-document-role'));
    if(profile.contact?.length)body.append(el('p',profile.contact.join(' · '),'jr-document-contact'));
    if(profile.links?.length)body.append(el('p',profile.links.join(' · '),'jr-document-contact'));
    function section(title){const node=el('section');node.append(el('h4',title));body.append(node);return node;}
    if(cv.summary)section('Summary').append(el('p',cv.summary));
    if(cv.skills?.length){const node=section('Skills');for(const group of cv.skills)for(const [name,values]of Object.entries(group))node.append(el('p',`${name}: ${Array.isArray(values)?values.join(', '):values}`));}
    for(const [key,title]of [['experience','Experience'],['education','Education']])if(cv[key]?.length){
      const node=section(title);
      cv[key].forEach((entry,index)=>{
        const facts=profile[key]?.find(item=>item.id===snapshot.bindings?.[key]?.[index])||{},item=el('div',null,'jr-document-entry');
        item.append(el('h5',[entry.title||facts.role||entry.degree||facts.degree,entry.company||facts.company||facts.school].filter(Boolean).join(' · ')));
        const dates=[facts.startDate,facts.current?'Present':facts.endDate].filter(Boolean).join(' – ');
        if(dates||facts.location)item.append(el('p',[dates,facts.location].filter(Boolean).join(' · '),'jr-document-contact'));
        if(entry.sentences?.length){const list=el('ul');for(const sentence of entry.sentences)list.append(el('li',sentence));item.append(list);}
        node.append(item);
      });
    }
    if(profile.certifications?.length){const node=section('Certifications');for(const item of profile.certifications)node.append(el('p',[item.name,item.issuer,item.issuedOn].filter(Boolean).join(' · ')));}
  }

  return body;
}
export function openSubmittedDocument(root,record,kind,{browser=globalThis.chrome,readPDF=readRecordPDF,mountPDF=mountNativePDF}={}) {
  const doc=root.ownerDocument,el=(tag,text,className)=>{const node=doc.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node;};
  for(const previous of root.querySelectorAll('.jr-document-dialog')){previous.close();previous.remove();}
  const dialog=el('dialog',null,'jr-document-dialog jr-pdf-dialog'),label=kind==='resume'?'Resume':'Cover letter';
  dialog.setAttribute('aria-label',label+' for '+record.company);
  const heading=el('header',null,'jr-document-heading'),view=el('button',null,'document-studio-action');view.type='button';view.title='View in Resume Studio';view.setAttribute('aria-label','View '+label.toLowerCase()+' in Resume Studio');
  view.textContent='Open in Resume Studio';
  const error=el('p',null,'jr-error');error.hidden=true;error.setAttribute('role','alert');
  view.addEventListener('click',async()=>{view.disabled=true;error.hidden=true;try{await viewDocumentInStudio(record,kind,browser);}catch(reason){error.textContent=reason.message;error.hidden=false;}finally{view.disabled=false;}});
  const content=el('div',null,'jr-document-pdf'),status=el('p','Preparing PDF preview…');status.setAttribute('role','status');
  let disposed=false,viewer=null;
  const cleanup=()=>{disposed=true;viewer?.dispose();viewer=null;};
  const ready=async()=>{try{
    const pdf=await readPDF(record,kind,{browser});if(disposed||!dialog.isConnected)return;
    viewer=mountPDF(content,{title:label+' PDF',url:doc.defaultView.URL,onRendered:()=>{status.hidden=true;dialog.dataset.previewState='ready';},onFailure:(_revision,message)=>{status.hidden=true;error.textContent=message;error.hidden=false;dialog.dataset.previewState='error';}});viewer.show(pdf);
  }catch(reason){if(!disposed){status.hidden=true;error.textContent=reason.message;error.hidden=false;dialog.dataset.previewState='error';}}};
  heading.append(el('h3',label+' \u00b7 '+record.company),view);dialog.append(heading,el('p',record.type==='queue'?'Saved document':'Submitted document \u00b7 Read only','jr-document-note'),error,status,content);
  const dismiss=()=>{cleanup();dialog.close();dialog.remove();};
  const close=el('button','Close','jr-button');close.type='button';close.dataset.documentAction='close';close.addEventListener('click',dismiss);
  dialog.addEventListener('cancel',event=>{event.preventDefault();dismiss();});
  dialog.addEventListener('click',event=>{event.stopPropagation();if(event.target!==dialog)return;const bounds=dialog.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dismiss();});dialog.addEventListener('close',()=>{cleanup();dialog.remove();},{once:true});dialog.append(close);root.append(dialog);dialog.showModal();dialog.dataset.previewState='loading';void ready();return dialog;
}
