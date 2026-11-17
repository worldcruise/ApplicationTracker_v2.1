import {queryFormTree,formFieldCaption,closestFormAncestor,composedParent} from './apply-form-dom.js';
import {nativeSelectProxy} from './apply-form-widgets.js';

const text=value=>String(value??'').replace(/\s+/g,' ').trim();
const optionLabel=node=>node.matches('input')?formFieldCaption(node)||text(node.value):text(node.getAttribute('aria-label')||node.label||node.textContent||node.value);
const optionValue=node=>node.getAttribute('data-value')??node.querySelector('input')?.value??node.getAttribute('value')??optionLabel(node);
const disabled=node=>node.disabled||node.getAttribute('aria-disabled')==='true'||!!node.closest('optgroup[disabled]');
const chosen=node=>node.selected||node.checked||node.getAttribute('aria-selected')==='true'||node.getAttribute('aria-checked')==='true'||!!node.querySelector('input:checked');
const contains=(container,node)=>{for(let item=node;item;item=composedParent(item))if(item===container)return true;return false;};
const comboScope='[role="combobox"],.select-shell,.select__container,.Select,.select2-container,[data-automation-id^="formField-"]';

// A choice widget is one application question, even when its implementation
// contains a search input, several hidden values, and a portalled option menu.
export function createChoiceFields(document,{combos,visible}) {
  let groups=new Map();
  function collect(raw) {
    groups=new Map();const suppressed=new Set(),owners=[];
    const suppress=(owner,scope)=>{if(scope)for(const node of raw)if(node!==owner&&contains(scope,node))suppressed.add(node);};
    // Keep a native select as the source of truth for Select2-style proxies.
    for(const node of raw.filter(node=>node.tagName==='SELECT')) {
      const proxy=nativeSelectProxy(node);if(proxy){suppress(node,proxy);for(const menu of combos.menus(node,proxy))suppress(node,menu);}
      if(node.multiple)groups.set(node,{kind:'native',multiple:true,scope:node,label:formFieldCaption(node)});
    }
    for(const item of raw.filter(node=>combos.isCombo(node)&&!closestFormAncestor(composedParent(node),'[role="listbox"]'))) {
      if(suppressed.has(item)||owners.some(owner=>contains(owner.scope,item)))continue;
      const scope=closestFormAncestor(composedParent(item),comboScope)||item;
      const inside=raw.filter(node=>contains(scope,node)&&!suppressed.has(node));
      const node=inside.find(node=>node.tagName==='INPUT'&&combos.isCombo(node))||inside.find(node=>node.tagName==='BUTTON'&&combos.isCombo(node))||item;
      const menus=combos.menus(node,scope),multiple=[node,scope,...menus].some(node=>node.getAttribute('aria-multiselectable')==='true')||scope.matches('.Select--multi,.select2-selection--multiple')||!!scope.querySelector('.select__multi-value,.Select--multi,.select2-selection--multiple,[class*="-multiValue"]');
      const label=formFieldCaption(node)||formFieldCaption(scope)||text(scope.querySelector('label')?.textContent);
      const group={kind:'combo',scope,node,label,multiple};groups.set(node,group);owners.push(group);suppress(node,scope);for(const menu of menus)suppress(node,menu);suppressed.delete(node);
    }
    // An inline listbox/radiogroup can own choices without a separate trigger.
    for(const node of raw.filter(node=>node.matches('[role="listbox"],[role="radiogroup"]'))) {
      if(suppressed.has(node)||owners.some(owner=>combos.menus(owner.node,owner.scope).includes(node)||contains(owner.scope,node)))continue;
      groups.set(node,{kind:'list',scope:node,label:formFieldCaption(node),multiple:node.getAttribute('aria-multiselectable')==='true'});suppress(node,node);
    }
    // Native checkbox sets with one explicit question are also one field.
    for(const node of raw.filter(node=>node.type==='checkbox'&&!suppressed.has(node))) {
      const scope=closestFormAncestor(composedParent(node),'fieldset,[role="group"][aria-label],[role="group"][aria-labelledby]');
      if(!scope||owners.some(owner=>contains(owner.scope,node)))continue;
      const label=formFieldCaption(scope)||text(scope.querySelector(':scope > legend')?.textContent);
      if(!label||/consent|terms|privacy|acknowledge|certify/i.test(label))continue;
      const members=raw.filter(other=>other.type==='checkbox'&&!suppressed.has(other)&&closestFormAncestor(composedParent(other),'fieldset,[role="group"][aria-label],[role="group"][aria-labelledby]')===scope);
      if(members.length<2)continue;
      groups.set(node,{kind:'checks',scope,members,label,multiple:true});for(const member of members)if(member!==node)suppressed.add(member);
    }
    return raw.filter(node=>!suppressed.has(node));
  }
  function nodes(node,{includeHidden=true}={}) {
    const group=groups.get(node);if(!group)return [];
    if(group.kind==='native')return [...node.options];
    if(group.kind==='checks')return group.members;
    if(group.kind==='combo')return combos.options(node,{includeHidden,scope:group.scope});
    return queryFormTree(group.scope,'[role="option"],[role="radio"],input[type="checkbox"],input[type="radio"]').filter(item=>!item.matches('input')||!item.closest('[role="option"],[role="radio"]'));
  }
  function selected(node) {
    const group=groups.get(node),all=nodes(node),values=all.filter(chosen).map(item=>({value:item.tagName==='OPTION'||group.kind==='checks'?item.value:optionValue(item),label:optionLabel(item)}));
    if(group.kind==='combo'&&group.multiple&&!values.length) {
      const labels=queryFormTree(group.scope,'.select__multi-value__label,.Select-value-label,.select2-selection__choice__display,[class*="-multiValue"] [class*="-label"]').map(node=>text(node.textContent));
      const hidden=queryFormTree(group.scope,'input[type="hidden"][name]').filter(node=>node.value);
      return labels.map((label,index)=>({value:hidden[index]?.value||label,label}));
    }
    return values;
  }
  function info(node) {
    const group=groups.get(node);if(!group)return null;
    const options=nodes(node).map(item=>({value:item.tagName==='OPTION'||group.kind==='checks'?item.value:optionValue(item),label:optionLabel(item),...disabled(item)?{disabled:true}:{}}));
    const selections=selected(node),answer=group.kind==='combo'&&!group.multiple?combos.value(node):selections.map(item=>item.label).join(', ');
    return {label:group.label,type:group.multiple?'select-multiple':'select-one',multiple:group.multiple,options,answer,...group.multiple?{answerValues:selections.map(item=>item.value)}:{},filled:!!answer,required:node.required||group.scope.getAttribute('aria-required')==='true'||!!group.members?.some(item=>item.required)};
  }
  function parse(answer) {
    if(Array.isArray(answer))return answer.map(String);
    const value=String(answer??'').trim();if(!value)return [];
    if(value.startsWith('[')){let values;try{values=JSON.parse(value);}catch{throw Error('Choose answers from the available options.');}if(!Array.isArray(values)||values.some(value=>typeof value!=='string'))throw Error('Choose answers from the available options.');return [...new Set(values)];}
    return [value];
  }
  async function set(node,answer,{check=()=>{}}={}) {
    const group=groups.get(node);if(!group)return false;
    if(group.kind==='combo'&&!group.multiple){await combos.select(node,answer,{check});return true;}
    check();const wanted=parse(answer);if(!group.multiple&&wanted.length>1)throw Error('Choose one answer from the available options.');
    if(group.kind==='combo'&&!nodes(node,{includeHidden:false}).length){node.focus();node.click();for(let attempt=0;attempt<25&&!nodes(node,{includeHidden:false}).length;attempt++){await new Promise(resolve=>document.defaultView.setTimeout(resolve,60));check();}}
    const available=nodes(node),matched=wanted.map(value=>available.find(item=>!disabled(item)&&(optionValue(item)===value||item.value===value||combos.matches(node,optionLabel(item),value))));
    if(matched.some(item=>!item))throw Error('Choose answers from the available dropdown options.');
    if(group.kind==='native') {
      for(const option of available){check();option.selected=matched.includes(option);}
      node.dispatchEvent(new document.defaultView.Event('input',{bubbles:true,composed:true}));node.dispatchEvent(new document.defaultView.Event('change',{bubbles:true,composed:true}));
    } else {
      for(const previous of available){
        const target=matched.includes(previous),value=optionValue(previous);if(disabled(previous))continue;
        let option=nodes(node).find(item=>optionValue(item)===value);if(option&&!!chosen(option)===target)continue;check();
        if(group.kind==='combo'&&(!option||!visible(option))){node.click();for(let attempt=0;attempt<25;attempt++){await new Promise(resolve=>document.defaultView.setTimeout(resolve,60));check();option=nodes(node).find(item=>optionValue(item)===value&&visible(item));if(option)break;}}
        if(!option||!visible(option))throw Error('Choose an option');
        option.click();await new Promise(resolve=>document.defaultView.setTimeout(resolve,0));check();
      }
    }
    check();const actual=selected(node);if(wanted.length!==actual.length||matched.some(item=>!actual.some(value=>value.value===optionValue(item)||value.value===item.value)))throw Error('The employer did not accept all selected answers. Review this question on its page.');
    return true;
  }
  return {collect,info,set,has:node=>groups.has(node),label:node=>groups.get(node)?.label||''};
}
