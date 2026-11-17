import {candidatePromptValues} from './prompt-builder';
import {useEffect,useRef,useState} from 'react';
import {DOCUMENT_SETTINGS_KEY,normalizeDocumentSettings} from '../../extension/ai-apply/src/document-settings.mjs';
import {GENERATION_MODULES,selectedDocumentSettings} from '../../extension/ai-apply/src/generation-selection.mjs';
import {WORKFLOW_PROMPTS_KEY,normalizeWritingPrompts} from '../../extension/ai-apply/src/writing-prompts.mjs';
import {generationInstructions} from '../../extension/ai-apply/src/generation-data.mjs';

export function GenerationPromptSelection({resumePrompt,candidate}:{resumePrompt:string;candidate?:any}){
  const [selection,setSelection]=useState<string[]>([]),[loaded,setLoaded]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [writing,setWriting]=useState(normalizeWritingPrompts()),[preview,setPreview]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{
    let alive=true;
    chrome.storage.local.get([DOCUMENT_SETTINGS_KEY,WORKFLOW_PROMPTS_KEY]).then(saved=>{
      if(!alive)return;
      setSelection(saved[DOCUMENT_SETTINGS_KEY]?.selectedModules ?? selectedDocumentSettings(null,normalizeDocumentSettings(saved[DOCUMENT_SETTINGS_KEY])).selectedModules);
      setWriting(normalizeWritingPrompts(saved[WORKFLOW_PROMPTS_KEY]));setLoaded(true);
    }).catch(error=>setMessage(error.message));
    const changed=(changes,area)=>{if(area!=='local'||!alive)return;if(changes[WORKFLOW_PROMPTS_KEY])setWriting(normalizeWritingPrompts(changes[WORKFLOW_PROMPTS_KEY].newValue));if(changes[DOCUMENT_SETTINGS_KEY]){const value=normalizeDocumentSettings(changes[DOCUMENT_SETTINGS_KEY].newValue);setSelection(value.selectedModules??selectedDocumentSettings(null,value).selectedModules);}};
    chrome.storage.onChanged.addListener(changed);
    return()=>{alive=false;chrome.storage.onChanged.removeListener(changed);};
  },[]);
  async function toggle(key:string){
    const next=GENERATION_MODULES.map(([id])=>id).filter(id=>id===key?!selection.includes(id):selection.includes(id));
    setBusy(true);setMessage('');
    try{const saved=await chrome.storage.local.get(DOCUMENT_SETTINGS_KEY);await chrome.storage.local.set({[DOCUMENT_SETTINGS_KEY]:normalizeDocumentSettings({...saved[DOCUMENT_SETTINGS_KEY],selectedModules:next})});setSelection(next);}
    catch(error){setMessage(error.message);}finally{setBusy(false);}
  }
  const labels=GENERATION_MODULES.filter(([key])=>selection.includes(key)).map(([,label])=>label);
  function openPreview(){
    try{const settings=selectedDocumentSettings(null,{selectedModules:selection});
      const values=candidate?candidatePromptValues(candidate):{};
      setPreview(generationInstructions({input:{prompt:resumePrompt,promptValues:values,job:{company:'{{job_company}}',role:'{{job_title}}',url:'{{job_url}}',description:'{{job_description}}'}}},settings,writing));
      dialog.current?.showModal();
    }catch(error){setMessage(error.message);}
  }
  return <section className="setup-group generation-prompt-selection">
    <fieldset disabled={!loaded||busy}><legend>Generate</legend><div className="generation-module-options">{GENERATION_MODULES.map(([key,label])=><label key={key}><input type="checkbox" checked={selection.includes(key)} onChange={()=>void toggle(key)} />{label}</label>)}</div></fieldset>
    <div className="prompt-picker-row"><span aria-live="polite">{selection.length} {selection.length===1?'section':'sections'} selected{labels.length?' · '+labels.join(' + '):''}</span><button className="button button-secondary" type="button" disabled={!loaded||busy||!selection.length} onClick={openPreview}>Copy combined prompt</button></div>
    <p role="status">{message}</p>
    <dialog ref={dialog} className="combined-prompt-dialog" onClick={event=>{if(event.target===dialog.current)dialog.current.close();}}>
      <div className="combined-prompt-content"><h3>Copy combined prompt</h3><p>{labels.join(' + ')}</p><p>This is the prompt sent to AI. For a queued job, the extracted company, title, URL, and description replace the placeholders at the end.</p><label>Combined prompt and expected JSON<textarea readOnly rows={18} value={preview} /></label><div className="prompt-picker-row"><button type="button" className="button button-primary" disabled={!selection.length} onClick={()=>void navigator.clipboard.writeText(preview).then(()=>setMessage('Combined prompt copied.')).catch(error=>setMessage(error.message))}>Copy</button><button type="button" className="button button-secondary" onClick={()=>dialog.current?.close()}>Close</button></div><p role="status">{message}</p></div>
    </dialog>
  </section>;
}
