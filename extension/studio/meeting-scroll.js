import {initialMeetingFocus} from './meeting-model.js';

export function observeMeetingInitialScroll(host){
  const win=host.ownerDocument.defaultView,finished=new Set();let frame=0;
  function update(){
    frame=0;
    for(const status of ['screen','interview']){
      if(finished.has(status))continue;
      const column=host.querySelector(`[data-test="applications-board-column-${status}"]`);if(!column)continue;
      const cards=[...column.querySelectorAll('.meeting-card[data-entity-type="meeting"]')];
      const id=initialMeetingFocus(cards.map(card=>({id:card.dataset.meetingId,status,meeting:{startsAt:card.dataset.startsAt,endsAt:card.dataset.endsAt,lifecycle:card.dataset.lifecycle}})));
      const target=cards.find(card=>card.dataset.meetingId===id);if(!target)continue;
      const scroller=column.lastElementChild;
      const top=scroller.scrollTop+target.getBoundingClientRect().top-scroller.getBoundingClientRect().top-scroller.clientTop;
      const missing=Math.max(0,top+scroller.clientHeight-scroller.scrollHeight);
      if(missing)scroller.style.paddingBottom=`${(parseFloat(win.getComputedStyle(scroller).paddingBottom)||0)+missing}px`;
      scroller.scrollTop=Math.max(0,top);column.dataset.initialFocus=id;finished.add(status);
    }
  }
  const schedule=()=>{if(!frame)frame=win.requestAnimationFrame(update);};
  const observer=new win.MutationObserver(schedule);observer.observe(host,{childList:true,subtree:true});schedule();
  function interacted(event){if(event.type==='keydown'&&!['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' '].includes(event.key))return;for(const status of ['screen','interview'])if(event.target.closest?.(`[data-test="applications-board-column-${status}"]`))finished.add(status);}
  for(const name of ['wheel','touchstart','keydown'])host.addEventListener(name,interacted,{passive:true});
  return()=>{observer.disconnect();if(frame)win.cancelAnimationFrame(frame);for(const name of ['wheel','touchstart','keydown'])host.removeEventListener(name,interacted);};
}
