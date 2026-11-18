import {createComboboxController,nativeSelectProxy,uploadFieldLabel,uploadFieldContainer} from './apply-form-widgets.js';
import {applicationControls,applicationReceipt,applicationErrors} from './apply-navigation.js';
import {profileFieldAnswer} from './autofill-profile.js';
import {queryFormTree,composedParent,closestFormAncestor,formFieldCaption} from './apply-form-dom.js';
import {createChoiceFields} from './apply-choice-fields.js';

// Runs only in the extension's isolated content-script world. Unknown widgets
// stay manual; a field is counted as filled only after its actual value validates.
export function createApplyForm(document, { uploadResume } = {}) {
  const win=document.defaultView, ids=new WeakMap(), nodes=new Map(),uploadErrors=new WeakMap(),uploadProofs=new Map(); let serial=0, currentRun=null, paused=false, candidateProfile={};
  const normalize=value=>String(value||'').replace(/\s+/g,' ').trim();
  const clean=value=>normalize(value).slice(0,2000);
  const label=node=>clean((node.type==='file'?uploadFieldLabel(node):'') || formFieldCaption(node) || node.getAttribute('placeholder') || node.name || node.id);
  const fieldLabel=node=>choices.label(node)||(node.type==='radio'?clean(closestFormAncestor(node,'fieldset')?.querySelector('legend')?.textContent)||label(node):label(node));
  const visible=node=>{for(let item=node;item;item=composedParent(item)){if(item.disabled||item.matches('[hidden],[aria-hidden="true"],fieldset[disabled]'))return false;const style=win.getComputedStyle(item);if(style.display==='none'||style.visibility==='hidden')return false;}return true;};
  function writeValue(node,value,{change=true}={}){
    const prototype=node.tagName==='SELECT'?win.HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?win.HTMLTextAreaElement.prototype:win.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value').set.call(node,value);
    node.dispatchEvent(new win.Event('input',{bubbles:true,composed:true}));if(change)node.dispatchEvent(new win.Event('change',{bubbles:true,composed:true}));
  }
  const combos=createComboboxController(document,{visible,writeValue});
  const choices=createChoiceFields(document,{combos,visible});
  const choiceErrors=new Map();
  function key(node) { if(!ids.has(node)){const previous=[...nodes].find(([,old])=>!old.isConnected&&old.tagName===node.tagName&&(node.id?old.id===node.id:node.name&&old.name===node.name)&&(node.id||label(old)===label(node)));ids.set(node,previous?.[0]||`field-${++serial}`);} const id=ids.get(node);nodes.set(id,node);return id; }
  const sameRadioGroup=(node,other)=>other.type==='radio'&&other.name===node.name&&other.form===node.form&&other.getRootNode()===node.getRootNode();
  function controls() {
    const raw=queryFormTree(document,'input,textarea,select,[role="combobox"],[role="listbox"],[role="radiogroup"],[aria-haspopup="listbox"],button[aria-haspopup="true"][aria-controls],button[data-automation-id][aria-haspopup="true"]').filter(node=>(combos.isCombo(node)||!['hidden','password','submit','button','reset','image'].includes(node.type))&&(!node.readOnly||combos.isCombo(node))&&
      (node.type==='file'? visible(node)||!node.disabled&&!node.closest('fieldset[disabled]')&&!!uploadFieldLabel(node)&&!!uploadFieldContainer(node)&&visible(uploadFieldContainer(node)):visible(node)||!node.disabled&&nativeSelectProxy(node)&&visible(nativeSelectProxy(node))));
    return choices.collect(raw);
  }
  function uploadedName(node){const native=node.files?.[0]?.name;if(native)return native;const expected=uploadProofs.get(uploadFieldLabel(node));return expected&&uploadFieldContainer(node)?.textContent.includes(expected)?expected:'';}
  function hasValue(node) { return choices.has(node)?choices.info(node).filled:node.type==='file'?!!uploadedName(node):['checkbox','radio'].includes(node.type)?node.checked:combos.isCombo(node)?!!combos.value(node):node.tagName==='SELECT'?[...node.options].some(option=>option.selected&&!!option.value&&!option.disabled&&!combos.isPlaceholder(option.textContent)):!!normalize(node.value); }
  function valid(node) { return node.getAttribute('aria-invalid')!=='true'&&(combos.isCombo(node)||!node.validity||node.validity.valid); }
  function entries() {
    const seen=new Set(),fields=controls();
    return fields.filter(node=>{if(node.type!=='radio')return true;const group=`${key(node.form||node.getRootNode())}:${node.name||key(node)}`;if(seen.has(group))return false;seen.add(group);return true;}).map(node=>{
      const radios=node.type==='radio'?fields.filter(other=>sameRadioGroup(node,other)):null;
      const selected=radios?.find(other=>other.checked),choice=choices.info(node);
      return { id:key(node),canAutofill:(node.type!=='checkbox'||!!choice)&&node.type!=='file'&&!!profileFieldAnswer(node,candidateProfile,fieldLabel(node)),kind:/\bwhy\b|\bdescribe\b|\btell us\b|\bcover letter\b|\bmotivat/i.test(fieldLabel(node))?'ai':'fact',type:node.tagName==='BUTTON'?'select-one':node.type,
        filled:radios?!!selected:hasValue(node)&&valid(node),...node.type==='file'&&uploadErrors.has(node)?{uploadError:uploadErrors.get(node)}:{},answer:radios?(selected?.value||''):node.type==='file'?uploadedName(node):node.type==='checkbox'?(node.checked?'Yes':''):combos.isCombo(node)?combos.value(node):String(node.value||'').slice(0,10000),options:radios?radios.map(other=>({value:other.value,label:label(other)})):node.tagName==='SELECT'?[...node.options].map(option=>({value:option.value,label:option.textContent,...option.disabled?{disabled:true}:{}})):combos.isCombo(node)?combos.options(node).map(option=>({value:option.getAttribute('data-value')||option.textContent,label:option.textContent})):[],
        ...choice,label:fieldLabel(node),...choice?{filled:choice.filled&&valid(node)}:{},...choiceErrors.has(key(node))&&!hasValue(node)?{optionMessage:'Choose an option'}:{},required:!!(node.required||choice?.required||/\*/.test(fieldLabel(node))||node.getAttribute('aria-required')==='true'||node.type==='file'&&node.closest('[aria-required="true"]')!==null||radios?.some(other=>other.required)) };
    });
  }
  function check(runId) { if(!currentRun||currentRun!==runId)throw Error('This form belongs to another autofill run.');if(paused)throw Error('Resume the paused run first.'); }
  async function set(node,value,check=()=>{}) {
    if(choices.has(node))return choices.set(node,value,{check});
    if(combos.isCombo(node))return combos.select(node,value,{check});
    if(combos.isSchoolInput(node))return combos.select(node,value,{check,allowPlain:true});
    if(node.type==='radio') { const radio=controls().find(other=>sameRadioGroup(node,other)&&(other.value===value||combos.matches(node,label(other),value)));if(!radio)throw Error('Choose one of the available answers.');radio.click();return; }
    if(node.type==='checkbox') { if(!/^(yes|no|true|false)$/i.test(value))throw Error('Enter Yes or No for this checkbox.');const next=/^(yes|true)$/i.test(value);if(node.checked!==next)node.click();return; }
    if(node.tagName==='SELECT') { const option=[...node.options].find(option=>!option.disabled&&option.value&&(option.value.toLowerCase()===value.toLowerCase()||combos.matches(node,option.textContent,value)));if(!option)throw Error('Choose a value from the employer dropdown.');value=option.value; }
    writeValue(node,value);
  }
  async function request(message) {
    const {action,runId}=message;
    if(message.profile&&typeof message.profile==='object')candidateProfile=message.profile;
    if(action==='inspect')return scan();
    if(action==='bind'){currentRun=runId;paused=false;return scan();}
    if(action==='pause'||action==='cancel'){if(currentRun===runId){paused=true;if(action==='cancel')currentRun=null;}return {stopped:true};}
    if(action==='resume'){if(currentRun!==runId)throw Error('The application page was reloaded. Rescan to reconnect.');paused=false;return scan();}
    check(runId);
    if(action==='scan')return scan();
    if(action==='fill') {
      const profile=message.profile||{}, saved=message.answers||{},pending=controls(),queued=new WeakSet(pending),attemptedDocuments=new Set();
      const reconnect=()=>{for(const node of controls())if(!queued.has(node)){queued.add(node);pending.push(node);}};
      for(let count=0;count<500&&count<pending.length;count++) {
        const node=pending[count];if(!node.isConnected){reconnect();continue;}
        check(runId);const schoolQuery=combos.isSchoolInput(node)&&normalize(node.value)===normalize(profileFieldAnswer(node,profile,fieldLabel(node)));
        if(!node.isConnected||hasValue(node)&&!schoolQuery||node.type==='radio'&&controls().some(other=>sameRadioGroup(node,other)&&other.checked))continue;
        const documentField=/cover.?letter/i.test(label(node))||node.type==='file'&&/resume|\bcv\b/i.test(label(node));
        if(Array.isArray(message.selectedIds)&&!message.selectedIds.includes(key(node))&&!documentField)continue;
        if(node.type==='file') {
          const file=/cover.?letter/i.test(label(node))?message.coverLetter:/resume|\bcv\b/i.test(label(node))?message.resume:null;
          if(file?.resumeBase64&&!attemptedDocuments.has(label(node))) {attemptedDocuments.add(label(node));try{
            const mime=/\.docx$/i.test(file.fileName)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':/\.doc$/i.test(file.fileName)?'application/msword':/\.txt$/i.test(file.fileName)?'text/plain':/\.rtf$/i.test(file.fileName)?'application/rtf':'application/pdf';
            const accept=(node.accept||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
            if(accept.length&&!accept.some(value=>value==='*/*'||value.startsWith('.')&&file.fileName.toLowerCase().endsWith(value)||value===mime||value.endsWith('/*')&&mime.startsWith(value.slice(0,-1))))throw Error(`This field accepts ${node.accept}. ${file.fileName} cannot be attached.`);
            uploadErrors.delete(node);uploadProofs.set(label(node),file.fileName);
            if(uploadResume)await uploadResume(node,file);else {const raw=file.resumeBase64.replace(/^data:[^,]*;base64,/i,''),bytes=Uint8Array.from(win.atob(raw),char=>char.charCodeAt(0)),transfer=new win.DataTransfer();transfer.items.add(new win.File([bytes],file.fileName,{type:mime}));Object.getOwnPropertyDescriptor(win.HTMLInputElement.prototype,'files').set.call(node,transfer.files);node.dispatchEvent(new win.Event('input',{bubbles:true,composed:true}));node.dispatchEvent(new win.Event('change',{bubbles:true,composed:true}));}
          }catch(error){uploadErrors.set(node,error.message||'The page did not accept this document.');}}
        } else { const type=choices.info(node)?.type||node.type;if(node.type==='checkbox'&&!choices.has(node)&&!message.edits?.[key(node)]&&!saved[`${type}:${normalize(fieldLabel(node)).toLowerCase()}`])continue;const value=message.edits?.[key(node)]||(/cover.?letter/i.test(label(node))?message.coverLetter?.text:'')||profileFieldAnswer(node,profile,fieldLabel(node))||saved[`${type}:${normalize(fieldLabel(node)).toLowerCase()}`];if(value)try{choiceErrors.delete(key(node));await set(node,String(value),()=>check(runId));}catch{if(choices.has(node)||combos.isCombo(node)||node.tagName==="SELECT")choiceErrors.set(key(node),true);} }
        // Yield between fields so pause/cancel stops subsequent writes.
        await new Promise(resolve=>win.setTimeout(resolve,0));
        reconnect();
      }
      check(runId);return scan();
    }
    if(action==='answer') {
      const node=nodes.get(message.fieldId);if(!node?.isConnected||fieldLabel(node)!==message.label)throw Error('The question changed. Rescan the page before filling it.');
      if(node.type==='file')throw Error('Upload this document on the employer page.');
      await set(node,String(message.answer||''),()=>check(runId));return scan();
    }
    throw Error('Unsupported form action.');
  }
  function scan() {
    const controls=applicationControls(document),receipt=applicationReceipt(document);
    return {url:document.location.href,origin:win.origin,title:document.title,fields:entries(),applyAvailable:controls.some(control=>control.kind==='apply'),nextAvailable:controls.some(control=>control.kind==='next'),submitAvailable:controls.some(control=>control.kind==='submit'),success:!!receipt,receipt,errors:applicationErrors(document)};
  }
  return {request,scan};
}
