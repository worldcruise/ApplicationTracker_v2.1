const cursors=new WeakMap();
const cardsSelector='.meeting-card[data-meeting-alert="true"]';
const cardId=card=>card.dataset.meetingId||card.dataset.id;
export const ATTENTION_FOCUS_EVENT='application-tracker:focus-attention';
let pendingRequest=0,serial=0;
export const attentionFocusRequest=()=>pendingRequest;
export function finishAttentionFocus(request){if(pendingRequest===request)pendingRequest=0;}
export function requestAttentionFocus(){
  pendingRequest=++serial;
  if(!location.hash.startsWith('#/meetings')){location.hash='#/meetings';window.dispatchEvent(new Event('popstate'));}
  window.dispatchEvent(new CustomEvent(ATTENTION_FOCUS_EVENT));
}
export function restoreAttentionHighlight(host){
  const id=cursors.get(host);
  for(const card of host.querySelectorAll(`${cardsSelector},[data-attention-focus]`)){
    if(id&&cardId(card)===id&&card.dataset.meetingAlert==='true')card.dataset.attentionFocus='true';
    else card.removeAttribute('data-attention-focus');
  }
}
export function focusNextAttention(host){
  const cards=[...host.querySelectorAll(cardsSelector)];
  if(!cards.length){restoreAttentionHighlight(host);return null;}
  const index=cards.findIndex(card=>cardId(card)===cursors.get(host)),card=cards[(index+1)%cards.length];
  cursors.set(host,cardId(card));restoreAttentionHighlight(host);
  const reduced=host.ownerDocument.defaultView.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  card.scrollIntoView?.({block:'center',inline:'nearest',behavior:reduced?'auto':'smooth'});
  card.querySelector('.meeting-card-main,.jr-card-main')?.focus({preventScroll:true});
  return cardId(card);
}
export function waitForAttentionFocus(host,onFocused){
  const win=host.ownerDocument.defaultView;let frame=0;
  const stop=()=>{observer.disconnect();if(frame)win.cancelAnimationFrame(frame);};
  const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(()=>{frame=0;const id=focusNextAttention(host);if(id){stop();onFocused(id);}});};
  const observer=new win.MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true});schedule();
  return stop;
}
