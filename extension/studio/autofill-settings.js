export const AUTOFILL_SETTINGS_KEY='application-tracker:autofill-preferences:v1';
export const AUTOFILL_DEFAULTS=Object.freeze({reuse:true,saveAnswers:true,record:true});
export function autofillPreferences(value={}){
  return Object.fromEntries(Object.entries(AUTOFILL_DEFAULTS).map(([key,fallback])=>[key,typeof value?.[key]==='boolean'?value[key]:fallback]));
}
export function createAutofillSettings(React){
  const h=React.createElement;
  return function AutofillSettings(){
    const [value,setValue]=React.useState(AUTOFILL_DEFAULTS),[loaded,setLoaded]=React.useState(false),[message,setMessage]=React.useState('');
    const current=React.useRef(AUTOFILL_DEFAULTS),pending=React.useRef(Promise.resolve()),revision=React.useRef(0),writes=React.useRef(0);
    React.useEffect(()=>{let alive=true;const initial=revision.current,changed=(changes,area)=>{if(alive&&area==='local'&&changes[AUTOFILL_SETTINGS_KEY]&&!writes.current){revision.current++;current.current=autofillPreferences(changes[AUTOFILL_SETTINGS_KEY].newValue);setValue(current.current);}};chrome.storage.onChanged.addListener(changed);chrome.storage.local.get(AUTOFILL_SETTINGS_KEY).then(saved=>{if(alive){if(initial===revision.current){current.current=autofillPreferences(saved[AUTOFILL_SETTINGS_KEY]);setValue(current.current);}setLoaded(true);}}).catch(error=>{if(alive)setMessage(error.message);});return()=>{alive=false;chrome.storage.onChanged.removeListener(changed);};},[]);
    async function change(key,checked){const next={...current.current,[key]:checked},ticket=++revision.current;current.current=next;setValue(next);setMessage('Saving…');writes.current++;pending.current=pending.current.catch(()=>{}).then(()=>chrome.storage.local.set({[AUTOFILL_SETTINGS_KEY]:next}));try{await pending.current;if(ticket===revision.current)setMessage('Saved');}catch(error){if(ticket===revision.current)setMessage(error.message);}finally{writes.current--;}}
    return h('section',{className:'prompt-settings ai-apply-preferences'},h('header',{className:'settings-pane-heading'},h('h2',null,'Autofill')),h('p',null,'Autofill starts when you click Autofill on an application page.'),h('fieldset',{className:'setup-group',disabled:!loaded},...[
      ['reuse','Reuse saved application answers'],['saveAnswers','Save answers for later applications'],['record','Record confirmed submissions in Applications']
    ].map(([key,label])=>h('label',{key},h('input',{type:'checkbox',checked:value[key],onChange:event=>void change(key,event.target.checked)}),' ',label))),h('p',{role:'status'},message));
  };
}
