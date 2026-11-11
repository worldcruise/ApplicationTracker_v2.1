import {defaultExportRoot} from './default-export-root.js';
import {RESUME_JSON_PROMPT,RESUME_JSON_COMMENT} from './resume-json-prompt.js';
import {readCoverLetter} from './cover-letter-import.js';
import {createQueueDirectoryStore} from './queue-export-folder.js';

export function mountQueueResumeInput(host,{request,privateStorage,getWindowId,onUpdated,icons,directoryStore=createQueueDirectoryStore()}={}){
  const doc=host.ownerDocument,win=doc.defaultView,dialog=doc.createElement('dialog');dialog.className='jr-cv-modal';dialog.id='jr-cv-dialog';dialog.setAttribute('aria-labelledby','jr-cv-heading');
  dialog.innerHTML=`<header class="jr-cv-heading"><div><h2 id="jr-cv-heading">CV input</h2><p id="jr-cv-context"></p></div><button type="button" class="jr-icon" data-cv-action="cancel" aria-label="Close CV input">${icons.x}</button></header>
  <div class="jr-cv-body"><section class="workspace-card editor-card cv-card" aria-labelledby="jr-cv-json-heading"><div class="section-heading"><div class="cv-heading-labels"><h3 id="jr-cv-json-heading">CV JSON</h3><span class="cv-company" id="jr-cv-company"></span></div><div class="jr-cv-json-actions"><button type="button" class="jr-icon" data-cv-action="import-cv" aria-label="Import CV JSON (.json)" title="Import .json">${icons.upload}<span>.json</span></button><button type="button" class="jr-icon" data-cv-action="preview" aria-label="Preview current CV in Resume Studio" title="Preview current CV in Resume Studio">${icons.eye}</button><button type="button" class="jr-button jr-copy-prompt" data-cv-action="copy-prompt" title="${RESUME_JSON_COMMENT}" aria-describedby="jr-cv-prompt-comment">Copy prompt</button></div></div><p class="jr-prompt-comment" id="jr-cv-prompt-comment">${RESUME_JSON_COMMENT}</p><label class="visually-hidden" for="jr-cv-input">CV JSON</label><textarea id="jr-cv-input" class="json-editor" rows="9" spellcheck="false" placeholder="Paste the generated six-field CV JSON." aria-describedby="jr-cv-status"></textarea><input type="file" id="jr-cv-file" accept=".json,application/json" hidden></section>
  <div class="jr-cv-status" id="jr-cv-status" role="status" aria-live="polite"><span class="jr-cv-status-light" aria-hidden="true"></span><span id="jr-cv-status-text">Paste a CV to begin.</span></div>
  <section class="workspace-card editor-card letter-card" aria-labelledby="jr-cv-letter-heading"><div class="section-heading"><h3 id="jr-cv-letter-heading">Cover letter</h3><div class="jr-cv-letter-actions"><button type="button" class="jr-icon" data-cv-action="import-letter" aria-label="Import cover letter (.txt, .md, .pdf)" title="Import .txt, .md, .pdf">${icons.upload}<span>.txt, .md, .pdf</span></button><button type="button" class="letter-switch" role="switch" aria-checked="false" aria-label="Include cover letter" id="jr-cv-letter-toggle"><span aria-hidden="true"></span><b id="jr-cv-letter-toggle-label">Off</b></button></div></div><label class="visually-hidden" for="jr-cv-letter">Cover letter text</label><textarea id="jr-cv-letter" rows="7" placeholder="Enter or paste a separate cover letter." hidden></textarea><input type="file" id="jr-cv-letter-file" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" hidden></section>
  <div class="jr-cv-folder"><label for="jr-cv-folder-name">Export folder</label><div class="export-folder"><input id="jr-cv-folder-name" placeholder="Choose export folder" readonly><button type="button" class="jr-icon folder-picker" data-cv-action="folder" aria-label="Choose export folder">${icons['folder-open']}</button></div><button type="button" class="jr-view" id="jr-cv-folder-grant" data-cv-action="grant" hidden>Allow folder access</button></div>
  <div class="jr-cv-export" id="jr-cv-export" hidden role="status"></div></div><footer class="jr-cv-footer"><button type="button" class="jr-button" data-cv-action="cancel">Cancel</button><button type="button" class="jr-button primary" id="jr-cv-update" data-cv-action="save-export">Save &amp; Export</button></footer>`;
  host.append(dialog);const $=selector=>dialog.querySelector(selector);
  let alive=true,record=null,candidate=null,busy=false,checking=false,validation=null,folder=null,permission='prompt',generation=0,editVersion=0,timer=null,pollTimer=null,ticket=null,updateId=null,saveRequest=null,savedVersion=-1,exportId=null;
  const fields=()=>({cvJsonRaw:$('#jr-cv-input').value,coverLetterRaw:$('#jr-cv-letter').value,coverLetterEnabled:$('#jr-cv-letter-toggle').getAttribute('aria-checked')==='true'});
  const payload=extra=>({id:record.id,expectedRevision:record.revision,windowId:getWindowId(),...extra});
  function status(message,kind='neutral'){if(!alive)return;$('#jr-cv-status-text').textContent=message;$('#jr-cv-status').dataset.state=kind;}
  function sync(){
    if(!alive)return;const enabled=fields().coverLetterEnabled,valid=validation?.state==='valid'&&!checking;
    $('#jr-cv-letter').hidden=!enabled;$('#jr-cv-letter-toggle-label').textContent=enabled?'On':'Off';
    dialog.querySelectorAll('button,textarea,input[type=file]').forEach(control=>control.disabled=busy||!!ticket?.pending&&control.dataset.cvAction!=='cancel');
    $('#jr-cv-update').disabled=busy||!valid||!!ticket?.pending;
    $('[data-cv-action="preview"]').disabled=busy||!valid||!!ticket?.pending;
    $('[data-cv-action="import-letter"]').disabled=busy||!enabled||!!ticket?.pending;
    $('#jr-cv-letter-file').disabled=busy||!enabled||!!ticket?.pending;
    $('#jr-cv-letter').disabled=busy||!enabled||!!ticket?.pending;
    $('#jr-cv-folder-name').value=folder?.name||'';$('#jr-cv-folder-grant').hidden=!folder||permission==='granted';
    $('#jr-cv-input').setAttribute('aria-invalid',String(!!validation&&!['valid','empty','letter_error'].includes(validation.state)));$('#jr-cv-letter').setAttribute('aria-invalid',String(validation?.state==='letter_error'));
    dialog.setAttribute('aria-busy',String(busy));
  }
  function displayTicket(next){ticket=next;const box=$('#jr-cv-export');box.hidden=!next;if(next){box.replaceChildren();const message=doc.createElement('p');message.textContent=next.message;box.append(message);for(const file of next.files||[]){const item=doc.createElement('p');item.textContent=`${file.kind==='cv'?'CV':'Cover letter'}: ${file.state}${file.filename?' — '+file.filename:''}`;box.append(item);if(file.retryable){const retry=doc.createElement('button');retry.type='button';retry.className='jr-view';retry.dataset.cvAction='retry';retry.dataset.kind=file.kind;retry.textContent=`Retry ${file.kind==='cv'?'CV':'cover letter'}`;box.append(retry);}}if(['render_failed','interrupted'].includes(next.phase)){const retry=doc.createElement('button');retry.type='button';retry.className='jr-view';retry.dataset.cvAction='retry';retry.textContent='Retry download';box.append(retry);}}sync();}
  async function poll(current=generation){clearTimeout(pollTimer);if(!ticket?.pending||!alive||!dialog.open)return;pollTimer=setTimeout(async()=>{try{const next=await request('DOCK_RECORDS_CV_INPUT',payload({action:'export-status',ticketId:ticket.id}));if(current!==generation||!alive)return;displayTicket(next);void poll(current);}catch(error){if(current===generation)status(error.message,'error');}},650);}
  async function check(current=generation,version=editVersion){
    checking=true;sync();try{const result=await request('DOCK_RECORDS_CV_INPUT',payload({action:'validate',...fields()}));if(!alive||current!==generation||version!==editVersion)return;candidate=result.candidate;validation=result.validation;$('#jr-cv-context').textContent=[candidate.name,validation.company||record.company,validation.title||record.role].filter(Boolean).join(' · ');$('#jr-cv-company').textContent=validation.company||'';$('#jr-cv-company').title=[validation.company,validation.title].filter(Boolean).join(' · ');status(validation.message,validation.state==='valid'?'valid':validation.state==='empty'?'neutral':'error');}
    catch(error){if(current===generation&&version===editVersion){validation=null;status(error.message,'error');}}
    finally{if(current===generation&&version===editVersion){checking=false;sync();}}
  }
  function edited(){editVersion++;validation=null;updateId=null;saveRequest=null;exportId=null;clearTimeout(timer);clearTimeout(pollTimer);displayTicket(null);status('Checking CV input…','checking');checking=true;sync();timer=setTimeout(()=>{void check();},220);}
  async function work(action){if(busy)return;busy=true;sync();try{await action();}catch(error){status(error.message,'error');}finally{busy=false;sync();}}
  function close(){if(busy)return;generation++;clearTimeout(timer);clearTimeout(pollTimer);dialog.close();record=null;}
  async function chooseFolder(){
    if(busy||!candidate)return;const current=generation;
    // Invoke the native picker directly from the click's user activation.
    let selection;try{if(typeof win.showDirectoryPicker!=='function')throw Error('Folder selection is unavailable in this browser.');selection=win.showDirectoryPicker({id:'candidate-export-root',mode:'readwrite'});}catch(error){status(error.message,'error');return;}
    await work(async()=>{try{const handle=await selection;if(current!==generation)return;const next={id:crypto.randomUUID(),candidateId:candidate.id,preference:handle.name,name:handle.name,handle};await directoryStore.remember(next);await privateStorage.set({[`dock-cv-folder:v1:${candidate.id}`]:next.id});folder=next;exportId=null;permission=await handle.queryPermission({mode:'readwrite'});status(`Export folder selected: ${next.name}.`,'valid');}catch(error){if(error.name!=='AbortError')throw error;}});
  }
  function click(event){
    const button=event.target.closest('button');if(!button||button.disabled)return;event.stopPropagation();
    const action=button.dataset.cvAction;
    if(button.id==='jr-cv-letter-toggle'){button.setAttribute('aria-checked',String(button.getAttribute('aria-checked')!=='true'));edited();return;}
    if(action==='cancel'){close();return;}
    if(action==='import-cv'||action==='import-letter'){$(action==='import-cv'?'#jr-cv-file':'#jr-cv-letter-file').click();return;}
    if(action==='preview')void work(async()=>{await request('DOCK_RECORDS_CV_INPUT',payload({action:'preview',...fields()}));status('Current CV opened in Resume Studio.','valid');});
    if(action==='copy-prompt')void work(async()=>{await win.navigator.clipboard.writeText(RESUME_JSON_PROMPT);status('Resume conversion prompt copied.','valid');});
    if(action==='folder'){void chooseFolder();return;}
    if(action==='grant'){const handle=folder?.handle;if(!handle)return;try{const grant=handle.requestPermission({mode:'readwrite'});void work(async()=>{permission=await grant;if(permission!=='granted')throw Error('Folder access was not granted.');status('Export folder access allowed.','valid');});}catch(error){status(error.message,'error');}return;}
    if(action==='save-export')void work(async()=>{
      if(!folder)throw Error('Choose an export folder or set the default root in Settings before saving and exporting.');
      permission=await folder.handle.queryPermission({mode:'readwrite'});if(permission!=='granted')throw Error('Allow access to the selected folder before saving and exporting.');
      if(savedVersion!==editVersion){
        updateId||=crypto.randomUUID();saveRequest||={...payload({}),action:'update-resume',type:'queue',mutationId:updateId,fields:fields()};
        const next=await request('DOCK_RECORDS_MUTATE',saveRequest);record=next.jobs.find(job=>job.id===record.id);savedVersion=editVersion;onUpdated(next);
      }
      try{exportId||=crypto.randomUUID();displayTicket(await request('DOCK_RECORDS_CV_INPUT',payload({action:'export',ticketId:exportId,bindingId:folder.id,...fields()})));void poll();}
      catch(error){throw Error('Resume saved. Export could not complete: '+error.message);}
    });
    if(action==='retry')void work(async()=>{displayTicket(await request('DOCK_RECORDS_CV_INPUT',payload({action:'export-retry',ticketId:ticket.id,...button.dataset.kind?{kind:button.dataset.kind}:{}})));void poll();});
  }
  function input(event){if(['jr-cv-input','jr-cv-letter'].includes(event.target.id)){event.stopPropagation();edited();}}
  async function change(event){if(!['jr-cv-file','jr-cv-letter-file'].includes(event.target.id))return;event.stopPropagation();const file=event.target.files?.[0];if(!file)return;const cv=event.target.id==='jr-cv-file';await work(async()=>{if(cv&&(!/\.json$/i.test(file.name)||file.size>1024*1024))throw Error('Choose a .json CV file up to 1 MiB.');$(cv?'#jr-cv-input':'#jr-cv-letter').value=cv?await file.text():await readCoverLetter(file);if(!cv)$('#jr-cv-letter-toggle').setAttribute('aria-checked','true');event.target.value='';edited();});}
  const cancel=event=>{event.preventDefault();close();};dialog.addEventListener('click',click);dialog.addEventListener('input',input);dialog.addEventListener('change',change);dialog.addEventListener('cancel',cancel);
  return {dialog,sync,async open(next,{letter=false}={}){
    generation++;editVersion++;record=next;candidate=null;validation=null;folder=null;ticket=null;updateId=null;saveRequest=null;savedVersion=-1;exportId=null;busy=false;checking=true;clearTimeout(timer);clearTimeout(pollTimer);const current=generation;
    let cvJson=next.resume?.cvJsonRaw||'';if(next.isMock&&cvJson){try{const value=JSON.parse(cvJson);if(typeof value.summary==='string')value.summary=value.summary.replace(/\bsample\b\s*/gi,'');cvJson=JSON.stringify(value,null,2);}catch{}}$('#jr-cv-input').value=cvJson;$('#jr-cv-letter').value=next.resume?.coverLetterRaw||'';$('#jr-cv-letter-toggle').setAttribute('aria-checked',String(!!next.resume?.coverLetterEnabled));$('#jr-cv-context').textContent=`${next.company} · ${next.role}`;$('#jr-cv-company').textContent='';$('#jr-cv-export').hidden=true;
    status('Checking CV input…','checking');if(!dialog.open)dialog.showModal();sync();await check();if(current!==generation||!candidate)return;
    try{const id=(await privateStorage.get(`dock-cv-folder:v1:${candidate.id}`))[`dock-cv-folder:v1:${candidate.id}`];const selected=id?await directoryStore.root(id):candidate.exportDirectory?await directoryStore.matching(candidate.id,candidate.exportDirectory):null;const saved=selected||await defaultExportRoot(candidate.id,privateStorage,directoryStore);if(current!==generation)return;if(saved?.candidateId===candidate.id){folder=saved;permission=await folder.handle.queryPermission({mode:'readwrite'});}}catch(error){status(error.message,'error');}
    if(current===generation){sync();$(letter?'#jr-cv-letter':'#jr-cv-input').focus();}
  },close(){alive=false;generation++;clearTimeout(timer);clearTimeout(pollTimer);dialog.remove();}};
}
