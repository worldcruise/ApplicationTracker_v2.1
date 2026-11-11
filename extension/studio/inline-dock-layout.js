export function reserveDockSpace(document,host,width=384){
  const win=document.defaultView,saved=new Map();let observer,scheduled=0,open=false;
  function set(node,name,value){
    if(!saved.has(node))saved.set(node,new Map());const values=saved.get(node);
    if(!values.has(name))values.set(name,[node.style.getPropertyValue(name),node.style.getPropertyPriority(name)]);
    if(node.style.getPropertyValue(name)!==value||node.style.getPropertyPriority(name)!=='important')node.style.setProperty(name,value,'important');
  }
  function restore(){for(const[node,values]of saved)for(const[name,[value,priority]]of values){if(value)node.style.setProperty(name,value,priority);else node.style.removeProperty(name);}saved.clear();}
  function sync(){
    if(!open||!document.body)return;
    restore();
    if(win.innerWidth-width<320)return;
    const body=document.body,style=win.getComputedStyle(body),margins=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
    const fixed=[...body.querySelectorAll('*')].filter(node=>node!==host&&!host.contains(node)&&!node.closest('dialog,[aria-modal="true"],[role="dialog"]')).filter(node=>{
      const style=win.getComputedStyle(node),rect=node.getBoundingClientRect();return style.position==='fixed'&&rect.width>win.innerWidth*.5&&Math.abs(rect.right-win.innerWidth)<24;
    });
    set(body,'box-sizing','border-box');set(body,'width',`calc(100% - ${width+margins}px)`);set(body,'max-width',`calc(100% - ${width}px)`);
    for(const node of fixed){set(node,'right',`${width}px`);set(node,'max-width',`calc(100% - ${width}px)`);if(node.getBoundingClientRect().width>win.innerWidth-width)set(node,'width',`calc(100% - ${width}px)`);}
  }
  const schedule=()=>{if(open&&!scheduled)scheduled=win.requestAnimationFrame(()=>{scheduled=0;sync();});};
  return {setOpen(value){
    open=value;observer?.disconnect();observer=null;win.removeEventListener('resize',schedule);if(scheduled)win.cancelAnimationFrame(scheduled);scheduled=0;
    if(!open){restore();return;}
    sync();observer=new win.MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});win.addEventListener('resize',schedule);
  },close(){this.setOpen(false);}};
}
