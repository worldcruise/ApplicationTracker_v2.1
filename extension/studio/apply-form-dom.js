// Employer forms can place their native controls inside open web components.
// Keep queries and labels within the control's tree before using page fallbacks.
export const composedParent=node=>node?.parentElement||node?.getRootNode?.().host||null;

export function queryFormTree(root,selector) {
  const found=[];
  for(const node of root.querySelectorAll('*')) {
    if(node.matches(selector))found.push(node);
    if(node.shadowRoot)found.push(...queryFormTree(node.shadowRoot,selector));
  }
  return found;
}

export function formElementById(node,id) {
  return id&&(node.getRootNode()?.getElementById?.(id)||node.ownerDocument.getElementById(id));
}

export function closestFormAncestor(node,selector) {
  for(let item=node;item;item=composedParent(item))if(item.matches(selector))return item;
  return null;
}

const text=value=>String(value||'').replace(/\s+/g,' ').trim();
const labelText=node=>{const copy=node.cloneNode(true);copy.querySelectorAll('input,select,textarea,button').forEach(child=>child.remove());return text(copy.textContent);};
const labelled=node=>text(node.getAttribute('aria-label'))||text((node.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>formElementById(node,id)?.textContent||'').join(' '));

export function formFieldCaption(node) {
  const own=labelled(node)||text([...(node.labels||[])].map(labelText).join(' '));
  if(own)return own;
  const wrapping=closestFormAncestor(node,'label');
  if(wrapping&&labelText(wrapping))return labelText(wrapping);
  // An outer label belongs to a custom element only when it exposes one field.
  // Never apply a whole section's heading to all of its controls.
  for(let host=node.getRootNode()?.host;host;host=host.getRootNode()?.host) {
    if(queryFormTree(host.shadowRoot,'input:not([type="hidden"]),textarea,select,button[role="combobox"],button[aria-haspopup="listbox"]').length!==1)break;
    const associated=host.id?[...host.getRootNode().querySelectorAll('label[for]')].find(label=>label.htmlFor===host.id):null;
    const caption=labelled(host)||text(host.getAttribute('label'))||(associated&&labelText(associated));
    if(caption)return caption;
  }
  return '';
}
