import {useEffect,useState} from 'react';
import {studioStorage} from '../../extension/studio/storage.js';
import {DEFAULT_EXPORT_ROOT_KEY,saveDefaultExportRoot} from '../../extension/studio/default-export-root.js';

export function DefaultExportRoot(){
  const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  useEffect(()=>{let alive=true;const read=()=>studioStorage.get(DEFAULT_EXPORT_ROOT_KEY).then(saved=>{if(alive)setValue(saved[DEFAULT_EXPORT_ROOT_KEY]||null);}).catch(error=>{if(alive)setMessage(error.message);});void read();const changed=changes=>{if(changes[DEFAULT_EXPORT_ROOT_KEY])void read();};studioStorage.onChanged.addListener(changed);return()=>{alive=false;studioStorage.onChanged.removeListener(changed);};},[]);
  async function choose(){
    if(busy)return;setBusy(true);setMessage('');
    try{if(typeof window.showDirectoryPicker!=='function')throw Error('Folder selection is unavailable in this browser.');const handle=await window.showDirectoryPicker({id:'default-export-root',mode:'readwrite'});setValue(await saveDefaultExportRoot(handle,studioStorage));setMessage('Default export root saved.');}
    catch(error){if(error.name!=='AbortError')setMessage(error.message);}
    finally{setBusy(false);}
  }
  return <section className="setup-group default-export-root" aria-labelledby="default-export-root-label"><h3 id="default-export-root-label">Default export root directory</h3><p>Use this folder for exports unless a different folder is selected.</p><div className="prompt-picker-row"><label>Root directory<input value={value?.name||''} readOnly placeholder="Choose a root directory" aria-label="Default export root directory value" /></label><button type="button" className="button button-secondary" disabled={busy} onClick={()=>void choose()}>Choose folder</button></div>{message&&<p role="status">{message}</p>}</section>;
}
