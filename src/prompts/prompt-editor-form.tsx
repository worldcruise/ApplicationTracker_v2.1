import {useRef,useState,type ReactNode} from 'react';
import {candidatePromptValues} from './prompt-builder';
import {PROMPT_TOKENS} from './prompt-composer';
import {substitutePromptPlaceholders} from '../../extension/studio/prompt-placeholders.js';

type Props={id:string;title:string;value:string;candidate?:any;disabled?:boolean;dirty:boolean;issue?:string|null;message?:string;tools?:ReactNode;onChange:(text:string)=>void;onSave:()=>void;onReset:()=>void;onCancel?:()=>void};
export function PromptEditorForm({id,title,value,candidate,disabled=false,dirty,issue,message,tools,onChange,onSave,onReset,onCancel}:Props){
  const [sampleJob,setSampleJob]=useState(''),[copyMessage,setCopyMessage]=useState('');
  const input=useRef<HTMLTextAreaElement>(null),output=useRef<HTMLTextAreaElement>(null);
  const preview=issue?'':substitutePromptPlaceholders(value,{...(candidate?candidatePromptValues(candidate):{}),job_description:sampleJob});
  function insert(token:string){
    const element=input.current;if(!element)return;
    element.focus();const found=value.indexOf(token);
    if(found>=0)element.setSelectionRange(found,found+token.length);
    else{element.setRangeText(token,element.selectionStart,element.selectionEnd,'end');onChange(element.value);}
  }
  async function copy(){
    try{await navigator.clipboard.writeText(preview);setCopyMessage('Preview copied.');}
    catch{output.current?.focus();output.current?.select();setCopyMessage('Preview selected. Press Ctrl+C or Command+C to copy.');}
  }
  return <form className="shared-prompt-editor resume-prompt" aria-label={`${title} prompt editor`} onSubmit={event=>{event.preventDefault();onSave();}}>
    <fieldset disabled={disabled}><div className="resume-prompt-grid">
      <section className="resume-prompt-left"><label htmlFor={`${id}-prompt`}>Prompt</label><textarea id={`${id}-prompt`} ref={input} aria-label={`${title} prompt`} aria-invalid={!!issue} aria-describedby={issue?`${id}-status`:undefined} rows={17} required maxLength={32000} spellCheck={false} value={value} onChange={event=>{onChange(event.target.value);setCopyMessage('');}} />
        <details className="rp-placeholders"><summary>Insert a placeholder</summary><p>Default values: <a href="#/settings/ai/candidate">Candidate Form</a></p><div className="rp-row" role="group" aria-label={`${title} placeholders`}>{Object.values(PROMPT_TOKENS).map(token=><button type="button" className="button button-secondary" key={token} onClick={()=>insert(token)}><code>{token}</code></button>)}</div></details>
        <div className="rp-row"><button type="submit" className="button button-primary" disabled={!dirty||!value.trim()||!!issue}>Save prompt</button><button type="button" className="button button-secondary" onClick={onReset}>Restore default</button>{dirty&&onCancel&&<button type="button" className="button button-secondary" onClick={onCancel}>Cancel</button>}</div>
      </section>
      <section className="resume-live-preview"><label htmlFor={`${id}-preview`}>Live preview</label><textarea id={`${id}-preview`} className="prompt-editor-preview" ref={output} aria-label={`${title} live preview`} rows={17} readOnly spellCheck={false} value={preview} />
        <label htmlFor={`${id}-sample`}>Sample job description</label><textarea id={`${id}-sample`} aria-label={`${title} sample job description`} rows={3} value={sampleJob} onChange={event=>{setSampleJob(event.target.value);setCopyMessage('');}} />
        <div className="rp-row"><button type="button" className="button button-secondary" disabled={!preview||!!issue} onClick={()=>void copy()}>Copy preview</button></div>
      </section>
    </div></fieldset>
    <p id={`${id}-status`} role={issue?'alert':'status'}>{issue||message||copyMessage||(dirty?'Unsaved changes.':'')}</p>
    {tools&&<details className="prompt-editor-tools"><summary>Saved templates</summary>{tools}</details>}
  </form>;
}
