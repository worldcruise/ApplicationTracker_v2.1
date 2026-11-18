import {studioStorage} from './storage.js';
import {flushStudioTab} from './navigation-flush.js';

export async function studioHeaderRequest(payload={},browser=globalThis.chrome){
  const requestId=crypto.randomUUID(),reply=await browser.runtime.sendMessage({version:1,requestId,operation:'PREVIEW_DOCUMENT_PREFERENCES',payload});
  if(!reply?.ok||reply.requestId!==requestId)throw Error(reply?.error?.message||'Resume preferences could not be loaded.');
  return reply.result;
}
async function flushStudio(){const tab=await chrome.tabs.getCurrent();if(!Number.isSafeInteger(tab?.id))throw Error('Reload Resume Studio before saving preferences.');await flushStudioTab(tab.id);}

export function createStudioHeaderControls(React,{request=studioHeaderRequest,flush=flushStudio,storage=studioStorage}={}){
  const h=React.createElement;
  return function StudioHeaderControls({controls,onChanged,section='default'}){
    const [value,setValue]=React.useState(null),[busy,setBusy]=React.useState(false),[error,setError]=React.useState(''),[reload,setReload]=React.useState(0);
    const pending=React.useRef(false),sequence=React.useRef(0),live=React.useRef(false),callbacks=React.useRef({onChanged});callbacks.current={onChanged};
    const settings=JSON.stringify([controls?.draft?.candidateId,controls?.draft?.documentTemplate,controls?.draft?.formattingOverrides]);
    React.useEffect(()=>{live.current=true;return()=>{live.current=false;sequence.current++;};},[]);
    React.useEffect(()=>{
      let alive=true;const version=++sequence.current;
      request().then(next=>{if(alive&&version===sequence.current&&!pending.current)setValue(next);}).catch(reason=>{if(alive&&version===sequence.current)setError(reason.message);});
      return()=>{alive=false;};
    },[settings,reload]);
    React.useEffect(()=>{const changed=changes=>{if(Object.keys(changes).some(key=>key.startsWith('autofill-profile:')))setReload(value=>value+1);};storage.onChanged.addListener(changed);return()=>storage.onChanged.removeListener(changed);},[]);
    async function save(payload){
      if(pending.current||!value?.candidateId)return;
      pending.current=true;sequence.current++;setBusy(true);setError('');
      try{await flush();const next=await request(payload);if(!live.current)return;setValue(next);await callbacks.current.onChanged?.();}
      catch(reason){if(live.current)setError(reason.message);}
      finally{pending.current=false;if(live.current){setBusy(false);setReload(value=>value+1);}}
    }
    const disabled=busy||!value?.candidateId,websites=value?.websites||{},visible=Object.values(websites).some(Boolean);
    return h('div',{className:section==='websites'?'studio-website-settings':'studio-header-controls','aria-label':section==='websites'?'Resume websites':'Resume preferences','aria-busy':busy},
      section==='websites'&&h(React.Fragment,null,h('h3',null,'Websites'),
        h('fieldset',{disabled},h('legend',{className:'visually-hidden'},'Websites on resume'),
          h('label',{className:'setting-row setting-switch studio-websites-all'},'Show websites',h('input',{type:'checkbox',role:'switch','aria-label':'Show websites',checked:visible,onChange:event=>{void save({action:'websites',visible:event.target.checked});}})),
          ...[['linkedin','LinkedIn'],['github','GitHub'],['website','Other website']].map(([key,label])=>h('label',{key,className:'setting-row setting-switch'},label,h('input',{type:'checkbox',role:'switch','aria-label':label,checked:websites[key]!==false,onChange:event=>{void save({action:'websites',key,visible:event.target.checked});}}))))),
      section!=='websites'&&h('button',{id:'studio-set-default',type:'button',className:`button ${!disabled&&!value?.isDefault?'button-primary':'button-secondary'}`,disabled:disabled||value?.isDefault,title:value?.isDefault?'This style is already your default':'Save this template and customization as your default',onClick:()=>{void save({action:'default'});}},busy?'Saving…':'Set as default'),
      error&&h('span',{className:'studio-header-preferences-error',role:'alert'},error,' ',h('button',{type:'button',className:'button button-secondary',disabled:busy,onClick:()=>{setError('');setReload(value=>value+1);}},'Retry')));
  };
}
