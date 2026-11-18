import {formElementById,formFieldCaption,queryFormTree,closestFormAncestor,composedParent} from './apply-form-dom.js';

const text=value=>String(value||'').replace(/\s+/g,' ').trim();
const documentKind=value=>{const normalized=text(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();return /cover[\s_-]*letter/.test(normalized)?'Cover Letter':/resume|\bcv\b|curriculum\s+vitae/.test(normalized)?'Resume/CV':'';};
const labelled=node=>(node?.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>formElementById(node,id)?.textContent||'').join(' ');

export function uploadFieldContainer(node){
  const group=node.closest('.file-upload,.file-upload-container,.dropzone,[role="group"],.field,[id^="s3_upload_for_"],[data-automation-id^="formField-"],fieldset');
  if(group)return group;
  for(let parent=node.parentElement;parent&&!/^(FORM|BODY|HTML)$/.test(parent.tagName);parent=parent.parentElement){
    if(documentKind([parent.id,parent.getAttribute('aria-label'),labelled(parent),parent.querySelector(':scope > label,:scope > h3,:scope > legend')?.textContent].join(' ')))return parent;
  }
  const label=[...(node.labels||[])].find(item=>item.isConnected);
  return label?.parentElement&&!/^(FORM|BODY|HTML)$/.test(label.parentElement.tagName)?label.parentElement:node.parentElement;
}

export function uploadFieldLabel(node) {
  const direct=[node.getAttribute('aria-label'),labelled(node),...(node.labels||[]),node.id,node.name].filter(Boolean).map(item=>typeof item==='string'?item:item.textContent).join(' ');
  const own=documentKind(direct);if(own)return own;
  const group=uploadFieldContainer(node),caption=group?.getAttribute('aria-label')||labelled(group)||group?.querySelector('.upload-label,legend,h3,label')?.textContent||'';
  return documentKind([group?.id,group?.getAttribute('data-automation-id'),caption].join(' '))||text(caption);
}

export function nativeSelectProxy(node) {
  if(node.tagName!=='SELECT')return null;
  const explicit=formElementById(node,`s2id_${node.id}`);
  if(explicit)return explicit;
  return [node.previousElementSibling,node.nextElementSibling].find(item=>item?.classList.contains('select2-container'))||null;
}

// Greenhouse uses react-select: its input value is a search query, while the
// committed answer lives in a selected-value element or a hidden form input.
export function createComboboxController(document,{visible,writeValue}) {
  const win=document.defaultView;
  const discovered=new WeakSet();
  const widgetSelector='.select-shell,.select__container,.select__control,.Select,.select2-container,.ant-select,.MuiAutocomplete-root,[data-automation-id^="formField-"],[role="combobox"]';
  const isCombo=node=>discovered.has(node)||node.getAttribute('role')==='combobox'||node.tagName==='INPUT'&&(['list','both','inline'].includes(node.getAttribute('aria-autocomplete'))||node.getAttribute('aria-haspopup')==='listbox'||node.classList.contains('pac-target-input')||!!node.getAttribute('list')||!!closestFormAncestor(composedParent(node),'.select2-container,.select__control,.ant-select,.MuiAutocomplete-root,[role="combobox"]')||[node.getAttribute('aria-controls'),node.getAttribute('aria-owns')].filter(Boolean).flatMap(value=>value.split(/\s+/)).some(id=>formElementById(node,id)?.matches('[role="listbox"],[role="tree"],.ui-autocomplete')))||node.matches('button,[role="button"]')&&(['listbox'].includes(node.getAttribute('aria-haspopup'))||node.getAttribute('aria-haspopup')==='true'&&!!(formFieldCaption(node)||closestFormAncestor(node,'[data-automation-id^="formField-"]')));
  const root=node=>closestFormAncestor(composedParent(node),widgetSelector)||(node.parentElement&&!/^(FORM|BODY|HTML)$/.test(node.parentElement.tagName)?node.parentElement:node);
  const placeholder=value=>!text(value)||/^(?:please\s+)?(?:select|choose)(?:\s+(?:one|an?\b.*|your\b.*|country|state|school|university|option))?[.\s…-]*$|^(?:search|type to search)[.\s…]*$/i.test(text(value));
  const proofs=new WeakMap();
  const fieldText=node=>formFieldCaption(node)||formFieldCaption(closestFormAncestor(composedParent(node),'[role="combobox"]')||node);
  const isSchoolInput=node=>node.tagName==='INPUT'&&!['hidden','file','password'].includes(node.type)&&/\b(?:school|university|college|institution)\b/i.test([fieldText(node),node.name,node.id].join(' ').replace(/([a-z])([A-Z])/g,'$1 $2'));
  const streetField=node=>{
    const auto=(node.autocomplete||'').split(/\s+/).at(-1);
    if(auto&&!['off','on'].includes(auto))return ['street-address','address-line1'].includes(auto);
    const caption=text([fieldText(node),node.name,node.id].join(' ')).replace(/([a-z])([A-Z])/g,'$1 $2');
    return !/\b(?:city|state|province|country|postal|zip|email|e-mail|line\s*2)\b/i.test(caption)&&/\bstreet\b|\baddress\s*(?:line\s*)?1\b|^address(?: address)*$/i.test(caption);
  };
  function value(node) {
    const container=root(node);
    // A plain street input can sit directly inside a form containing unrelated
    // hidden job IDs and other selects. Those are never its selected answer.
    if(node.tagName==='INPUT'&&streetField(node)&&!container?.matches(widgetSelector))return text(node.getAttribute('aria-valuetext'))||(node.getAttribute('aria-expanded')!=='true'?text(node.value):'');
    const selected=container?.querySelector('.select__single-value,[class*="-singleValue"],.Select-value-label,.select2-chosen');
    if(selected&&visible(selected)&&!placeholder(selected.textContent))return text(selected.textContent);
    const hidden=container!==node?[...container?.querySelectorAll('input[type="hidden"][name]')||[]].find(item=>container.matches(widgetSelector)||item.name===node.name||item.name===node.id):null;
    if(hidden?.value)return text(hidden.value);
    if(node.getAttribute('aria-valuetext'))return text(node.getAttribute('aria-valuetext'));
    const selectedOption=options(node,{includeHidden:true}).find(option=>option.getAttribute('aria-selected')==='true'||option.getAttribute('aria-checked')==='true'||option.querySelector('input:checked'));
    if(selectedOption)return text(selectedOption.getAttribute('aria-label')||selectedOption.textContent);
    if(node.tagName==='BUTTON')return placeholder(node.textContent)?'':text(node.textContent);
    const proof=proofs.get(node);
    if(proof&&proof.inputValue&&node.value===proof.inputValue&&node.getAttribute('aria-expanded')!=='true')return streetField(node)?text(node.value):proof.label;
    // Address inputs can also accept an ordinary street without a suggestion.
    // A live autocomplete query remains pending until its menu is closed.
    return streetField(node)&&node.getAttribute('aria-expanded')!=='true'?text(node.value):'';
  }
  function menus(node,scope=root(node)) {
    const owners=[node,...scope&&scope!==node?[scope,...queryFormTree(scope,'[aria-controls],[aria-owns]')]:[]];
    const ids=[...new Set(owners.flatMap(owner=>[owner.getAttribute('aria-controls'),owner.getAttribute('aria-owns')].filter(Boolean).flatMap(value=>value.split(/\s+/))))];
    const containers=ids.map(id=>formElementById(node,id)).filter(Boolean);
    if(!ids.length&&(node.getAttribute('aria-expanded')==='true'||document.activeElement===node)){const open=queryFormTree(document,'[role="listbox"],.pac-container,.ui-autocomplete,.select2-drop,.select2-dropdown,.tt-menu,.autocomplete-suggestions').filter(visible);if(open.length===1)containers.push(open[0]);}
    const datalist=formElementById(node,node.getAttribute('list'));if(datalist?.tagName==='DATALIST')containers.push(datalist);
    return [...new Set(containers)];
  }
  function options(node,{includeHidden=false,scope=root(node)}={}) {
    const containers=[scope,...menus(node,scope)];
    return [...new Set(containers.filter(Boolean).flatMap(container=>queryFormTree(container,'[role="option"],.select__option,.Select-option,.select2-results__option,.select2-result-selectable,.ui-menu-item,.tt-suggestion,.autocomplete-suggestion,[data-automation-id="menuItem"],.pac-item,datalist option')))]
      .filter(option=>(includeHidden||visible(option))&&option.getAttribute('aria-disabled')!=='true'&&!option.classList.contains('select__option--is-disabled'));
  }
  const countryKey=value=>text(value).toLowerCase().replace(/^[\u{1F1E6}-\u{1F1FF}]{2}\s*/u,'').replace(/\s*\(?\+\d[\d\s-]*\)?$/,'').replace(/^united states of america$/,'united states').replace(/^(us|usa)$/,'united states').replace(/^(uk|great britain)$/,'united kingdom').trim();
  const countryField=node=>/\bcountry\b/i.test(fieldText(node)||node.id);
  const states=Object.fromEntries('AL:Alabama|AK:Alaska|AZ:Arizona|AR:Arkansas|CA:California|CO:Colorado|CT:Connecticut|DE:Delaware|DC:District of Columbia|FL:Florida|GA:Georgia|HI:Hawaii|ID:Idaho|IL:Illinois|IN:Indiana|IA:Iowa|KS:Kansas|KY:Kentucky|LA:Louisiana|ME:Maine|MD:Maryland|MA:Massachusetts|MI:Michigan|MN:Minnesota|MS:Mississippi|MO:Missouri|MT:Montana|NE:Nebraska|NV:Nevada|NH:New Hampshire|NJ:New Jersey|NM:New Mexico|NY:New York|NC:North Carolina|ND:North Dakota|OH:Ohio|OK:Oklahoma|OR:Oregon|PA:Pennsylvania|RI:Rhode Island|SC:South Carolina|SD:South Dakota|TN:Tennessee|TX:Texas|UT:Utah|VT:Vermont|VA:Virginia|WA:Washington|WV:West Virginia|WI:Wisconsin|WY:Wyoming'.split('|').map(row=>row.split(':')));
  const canonical=value=>text(value).toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function choice(value){const key=canonical(value);return /^yes\b|^true$/.test(key)?'yes':/^no\b|^false$/.test(key)?'no':/^(?:prefer not|i (?:do not|dont) wish|decline|undisclosed)/.test(key)?'undisclosed':({'bachelors degree':'bachelors','bachelor':'bachelors','masters degree':'masters','master':'masters','bs':'bachelor of science','bsc':'bachelor of science','ba':'bachelor of arts','ms':'master of science','msc':'master of science','ph d':'phd','doctorate':'phd'})[key]||key;}
  function matches(node,option,answer){
    if(countryField(node))return countryKey(option)===countryKey(answer);
    if(/\bstate\b|\bprovince\b/i.test(fieldText(node))){const state=value=>canonical(states[text(value).toUpperCase()]||text(value).replace(/\s*\([A-Z]{2}\)$/,''));return state(option)===state(answer);}
    if(/\bmonth\b/i.test(fieldText(node))){const month=value=>{const key=canonical(value),number=Number(key);return number>=1&&number<=12?number:['january','february','march','april','may','june','july','august','september','october','november','december'].findIndex(item=>item===key||item.slice(0,3)===key)+1;};if(month(option)&&month(option)===month(answer))return true;}
    const optionKey=choice(option),answerKey=choice(answer);
    return optionKey===answerKey||optionKey==='bachelors'&&answerKey.startsWith('bachelor of ')||optionKey==='masters'&&answerKey.startsWith('master of ');
  }
  const activate=target=>{
      if(typeof win.PointerEvent==='function')target.dispatchEvent(new win.PointerEvent('pointerdown',{bubbles:true,cancelable:true,composed:true,pointerType:'mouse',button:0}));
      if(!target.isConnected)return;
      target.dispatchEvent(new win.MouseEvent('mousedown',{bubbles:true,cancelable:true,composed:true,button:0}));
      if(!target.isConnected)return;
      if(typeof win.PointerEvent==='function')target.dispatchEvent(new win.PointerEvent('pointerup',{bubbles:true,cancelable:true,composed:true,pointerType:'mouse',button:0}));
      target.dispatchEvent(new win.MouseEvent('mouseup',{bubbles:true,cancelable:true,composed:true,button:0}));target.click();
    };
  async function select(node,answer,{check=()=>{},allowPlain=false}={}) {
    const identity={id:node.id,name:node.name,caption:fieldText(node),tag:node.tagName};
    const reconnect=()=>{
      if(node.isConnected)return;
      const candidates=queryFormTree(document,'input,[role="combobox"],[aria-haspopup="listbox"],button[aria-haspopup="true"]').filter(item=>item.tagName===identity.tag&&(identity.id?item.id===identity.id:identity.name?item.name===identity.name:!!identity.caption&&fieldText(item)===identity.caption));
      if(candidates.length!==1)throw Error('The dropdown changed. Choose an option on the employer page.');node=candidates[0];
    };
    const before=node.value,country=countryField(node),street=streetField(node),query=country&&countryKey(answer)==='united states'?'United States':answer;
    const expected=option=>{
      const caption=option.getAttribute('aria-label')||option.label||option.textContent;
      if(option.getAttribute('data-value')===answer||option.getAttribute('value')===answer)return true;
      if(street){const address=option.querySelector('.pac-item-query')?.textContent||text(caption).split(',')[0];return canonical(address)===canonical(answer)||canonical(caption)===canonical(answer);}
      if(isSchoolInput(node)){const school=value=>canonical(text(value).replace(/\s*\([^)]*\)\s*$/,'').split(',')[0]);return school(caption)===school(answer);}
      return matches(node,caption,answer);
    };
    const list=formElementById(node,node.getAttribute('list'));
    if(list?.tagName==='DATALIST'){
      const matched=[...list.options].filter(expected);if(matched.length!==1)throw Error('Choose a value from the employer dropdown.');
      check();writeValue(node,matched[0].value);node.blur();proofs.set(node,{label:matched[0].value,inputValue:node.value});return;
    }
    check();node.focus();activate(node);
    node.dispatchEvent(new win.KeyboardEvent('keydown',{key:'ArrowDown',code:'ArrowDown',bubbles:true,composed:true}));
    const typed=new WeakSet();let editor=null;
    function search(){
      reconnect();const scope=root(node);
      const input=node.tagName==='INPUT'&&!node.readOnly?node:[scope,...menus(node)].filter(Boolean).flatMap(container=>queryFormTree(container,'input:not([type="hidden"]):not([type="file"])')).find(input=>!input.readOnly&&!input.disabled);
      if(input&&!typed.has(input)){editor=input;typed.add(input);if(input!==node)input.focus();writeValue(input,query,{change:false});input.dispatchEvent(new win.KeyboardEvent('keyup',{key:String(query).at(-1)||'Unidentified',bubbles:true,composed:true}));}
      if(editor?.isConnected&&editor.value!==query)throw Error('The dropdown changed while it was being filled. Review its answer on the employer page.');
    }
    search();let option,sawMenu=false;
    for(let attempt=0;attempt<(isSchoolInput(node)?40:25);attempt++){
      check();search();const available=options(node);if(available.length){sawMenu=true;discovered.add(node);}
      const matched=available.filter(expected);
      // Nested option markup can expose both a list item and its child label.
      const distinct=matched.filter(item=>!matched.some(other=>other!==item&&item.contains(other)));
      if(distinct.length===1){option=distinct[0];break;}
      if(distinct.length>1)throw Error('More than one dropdown option matches. Choose an option on the employer page.');
      await new Promise(resolve=>win.setTimeout(resolve,60));
    }
    check();reconnect();if(editor?.isConnected&&editor.value!==query)throw Error('The dropdown changed while it was being filled. Review its answer on the employer page.');
    if(!option){
      if(allowPlain&&!sawMenu&&!isCombo(node)){writeValue(node,query);node.blur();await new Promise(resolve=>win.setTimeout(resolve,60));check();return;}
      if(editor?.isConnected)writeValue(editor,before||'',{change:false});node.dispatchEvent(new win.KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true}));throw Error('Choose a value from the employer dropdown.');
    }
    const selectedLabel=text(option.getAttribute('aria-label')||option.label||option.textContent),selectedValue=option.getAttribute('data-value')||option.getAttribute('value');
    activate(option);let validated=false;
    for(let attempt=0;attempt<30;attempt++){
      await new Promise(resolve=>win.setTimeout(resolve,40));check();reconnect();
      const closed=node.getAttribute('aria-expanded')!=='true'&&(options(node).length===0||node.value!==query);
      if(node.value&&closed)proofs.set(node,{label:selectedLabel,inputValue:node.value});
      const committed=value(node);
      if(committed&&(matches(node,committed,answer)||canonical(committed)===canonical(selectedLabel)||selectedValue&&committed===selectedValue)){
        if(allowPlain&&!validated){validated=true;node.dispatchEvent(new win.Event('change',{bubbles:true,composed:true}));node.blur();continue;}
        return;
      }
    }
    throw Error('The employer dropdown did not accept this answer. Choose its option on the application page.');
  }
  return {activate,isCombo,isSchoolInput,isPlaceholder:placeholder,value,options,select,matches,root,menus};
}
