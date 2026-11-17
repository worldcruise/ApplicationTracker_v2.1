import {useEffect,useState} from 'react';
import {studioStorage} from '../../extension/studio/storage.js';
import {DEFAULT_EXPORT_ROOT_KEY,saveDefaultExportRoot,saveDefaultExportRootPath} from '../../extension/studio/default-export-root.js';

export function DefaultExportRoot(){
  const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [path,setPath]=useState('');
  useEffect(()=>{setPath(value?.path||'');},[value?.id,value?.path]);
  useEffect(()=>{let alive=true;const read=()=>studioStorage.get(DEFAULT_EXPORT_ROOT_KEY).then(saved=>{if(alive)setValue(saved[DEFAULT_EXPORT_ROOT_KEY]||null);}).catch(error=>{if(alive)setMessage(error.message);});void read();const changed=changes=>{if(changes[DEFAULT_EXPORT_ROOT_KEY])void read();};studioStorage.onChanged.addListener(changed);return()=>{alive=false;studioStorage.onChanged.removeListener(changed);};},[]);
  async function choose(){
    if(busy)return;setBusy(true);setMessage('');
    try{if(typeof window.showDirectoryPicker!=='function')throw Error('Folder selection is unavailable in this browser.');const handle=await window.showDirectoryPicker({id:'default-export-root',mode:'readwrite'});setValue(await saveDefaultExportRoot(handle,studioStorage));setMessage('Default export root saved.');}
    catch(error){if(error.name!=='AbortError')setMessage(error.message);}
    finally{setBusy(false);}
  }
  async function savePath(){
    if(busy||!value)return;setBusy(true);setMessage('');
    try{setValue(await saveDefaultExportRootPath(value.id,path,studioStorage));setMessage('Full folder path saved.');}
    catch(error){setMessage(error.message);}
    finally{setBusy(false);}
  }
  return <section className="setup-group default-export-root" aria-labelledby="default-export-root-label"><h3 id="default-export-root-label">Default export root directory</h3><p>Use this folder for exports unless a different folder is selected.</p><div className="prompt-picker-row"><label>Root directory<input value={value?.path||value?.name||''} title={value?.path||value?.name||''} readOnly placeholder="Choose a root directory" aria-label="Default export root directory value" /></label><button type="button" className="button button-secondary" disabled={busy} onClick={()=>void choose()}>Choose folder</button></div>{value&&<><div className="prompt-picker-row"><label>Full folder path<input value={path} disabled={busy} onChange={event=>setPath(event.target.value)} placeholder={'D:\\Profiles\\Tom'} aria-describedby="export-root-path-help" spellCheck={false} /></label><button type="button" className="button button-secondary" disabled={busy||path===(value.path||'')} onClick={()=>void savePath()}>Save path</button></div><p id="export-root-path-help">Chrome only provides the folder name. Paste its full path from File Explorer to display it here. Exports use the folder selected above.</p></>}{message&&<p role="status">{message}</p>}</section>;
}
