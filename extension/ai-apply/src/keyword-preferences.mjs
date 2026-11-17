import './keyword-matcher.js';

// The job toolbar keeps its quick toggle; the editor lives in host Settings.
export function connectKeywordPreferences({onChange,browser=chrome,root=document,events=window}) {
  const {storageKey,normalize}=globalThis.AiAgentKeywords,toggle=root.getElementById('highlight-keywords');
  let value=normalize(),revision=0,disposed=false;
  function apply(next){if(disposed)return;value=normalize(next);toggle.checked=value.enabled;onChange(value);}
  const changed=(changes,area)=>{if(area==='local'&&changes[storageKey]){revision++;apply(changes[storageKey].newValue);}};
  browser.storage.onChanged.addListener(changed);toggle.disabled=true;
  const initial=revision;
  const ready=browser.storage.local.get(storageKey).then(saved=>{if(initial===revision)apply(saved[storageKey]);}).catch(()=>{toggle.title='Could not load keyword settings. Open Settings → Other.';}).finally(()=>{if(!disposed)toggle.disabled=false;});
  toggle.addEventListener('change',()=>{toggle.disabled=true;const enabled=toggle.checked;void browser.storage.local.get(storageKey).then(saved=>browser.storage.local.set({[storageKey]:{...normalize(saved[storageKey]),enabled}})).catch(()=>{toggle.checked=value.enabled;toggle.title='Could not save keyword settings. Try again.';}).finally(()=>{if(!disposed)toggle.disabled=false;});});
  events.addEventListener('pagehide',()=>{disposed=true;browser.storage.onChanged.removeListener(changed);},{once:true});
  return {ready};
}
