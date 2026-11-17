import {mountAutofillProfile} from './profile-editor.mjs';
const token=new URL(location.href).searchParams.get('token');
async function request(action,payload={}){
  const response=await chrome.runtime.sendMessage({type:'ai-apply.tools',payload:{action,...payload}});
  if(!response?.ok)throw Error(response?.error||'Profile could not connect.');return response.value;
}
function close(){parent.postMessage({type:'tracker.profile.close',token},'*');}
const theme=(await chrome.storage.local.get('ui-theme:v1'))['ui-theme:v1'];if(theme)document.documentElement.dataset.theme=theme;
mountAutofillProfile(document.querySelector('#profile-editor'),{read:()=>request('profile.read'),save:payload=>request('profile.save',payload),preview:payload=>request('profile.preview',payload),close});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close();}});
