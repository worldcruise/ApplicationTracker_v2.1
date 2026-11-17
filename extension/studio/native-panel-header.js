import {openDashboard} from './dock.js';
import {THEME_KEY} from './theme.js';

const icons={
  account:'M20 21v-2a7 7 0 0 0-14 0v2M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  sun:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  moon:'M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z'
};
const icon=name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]}"/></svg>`;

export function mountNativePanelHeader(root,{browser=chrome,navigate=route=>openDashboard(route,browser)}={}){
  const doc=root.ownerDocument,header=root.querySelector('.rd-header'),previous=root.querySelector('#rd-avatar');
  const avatar=doc.createElement('button');avatar.type='button';avatar.id=previous.id;avatar.className=previous.className;avatar.textContent=previous.textContent;avatar.dataset.action='Profile settings';avatar.title='Profile settings';avatar.setAttribute('aria-label','Profile settings');previous.replaceWith(avatar);
  const theme=doc.createElement('button'),account=doc.createElement('button');
  for(const node of [theme,account]){node.type='button';node.className='native-header-icon';}
  theme.classList.add('native-theme-toggle');account.classList.add('native-account-button');header.append(theme,account);
  let alive=true,writes=Promise.resolve();
  function render(){
    const dark=doc.documentElement.dataset.theme==='dark';theme.innerHTML=icon(dark?'moon':'sun');theme.title=`Switch to ${dark?'light':'dark'} theme`;theme.setAttribute('aria-label',theme.title);theme.setAttribute('aria-pressed',String(dark));
    account.innerHTML=icon('account');account.title='Profile settings';account.setAttribute('aria-label','Profile settings');
  }
  theme.addEventListener('click',()=>{
    const next=doc.documentElement.dataset.theme==='dark'?'light':'dark';doc.documentElement.dataset.theme=next;render();
    writes=writes.catch(()=>{}).then(()=>browser.storage.local.set({[THEME_KEY]:next}));void writes.catch(()=>{if(alive)theme.title='Could not save theme. Click to try again.';});
  });
  account.addEventListener('click',()=>{void navigate('/settings/profile').catch(error=>{account.title=error.message;});});
  const changed=(changes,area)=>{
    if(area!=='local'||!alive)return;
    if(changes[THEME_KEY])doc.documentElement.dataset.theme=changes[THEME_KEY].newValue==='dark'?'dark':'light';
    render();
  };
  browser.storage.onChanged.addListener(changed);render();const ready=Promise.resolve();
  return {ready,close(){alive=false;browser.storage.onChanged.removeListener(changed);theme.remove();account.remove();}};
}
