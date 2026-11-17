const KEY='web-sidebar-collapsed:v1';
export function createWebSidebarHook(React){
  return function useWebSidebar(){
    const [collapsed,setCollapsed]=React.useState(()=>{try{return localStorage.getItem(KEY)==='true';}catch{return false;}});
    React.useLayoutEffect(()=>{document.documentElement.dataset.webSidebarCollapsed=String(collapsed);},[collapsed]);
    React.useEffect(()=>{const changed=event=>{if(event.key===KEY)setCollapsed(event.newValue==='true');};window.addEventListener('storage',changed);return()=>window.removeEventListener('storage',changed);},[]);
    function toggle(){setCollapsed(previous=>{const next=!previous;try{localStorage.setItem(KEY,String(next));}catch{}return next;});}
    return {collapsed,toggle};
  };
}
