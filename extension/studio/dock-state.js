export const DOCK_STATE_PREFIX='application-tracker:ui-state:v1:';

// Keep navigation separate from form data and running operations. A restored
// view never submits a form, generates documents, or replays a previous click.
export function createDockState({browser=globalThis.chrome,scope,windowId}={}){
  if(!['dock','apply','meetings'].includes(scope))throw Error('Unknown workspace state.');
  let current={},tail=Promise.resolve(),revision=0;
  const localKey=DOCK_STATE_PREFIX+scope;
  const owner=Promise.resolve(Number.isSafeInteger(windowId)?windowId:browser.windows.getCurrent().then(value=>value.id));
  const valid=value=>value?.version===1&&value.data&&typeof value.data==='object'&&!Array.isArray(value.data)?value.data:{};
  const ready=(async()=>{
    const initial=revision,id=await owner,sessionKey=`${localKey}:${id}`;
    const session=await browser.storage.session?.get(sessionKey),saved=session?.[sessionKey]??(await browser.storage.local.get(localKey))[localKey];
    if(initial===revision)current=structuredClone(valid(saved));return structuredClone(current);
  })().catch(()=>structuredClone(current));
  function patch(value){
    const next={...current,...structuredClone(value)};if(JSON.stringify(next)===JSON.stringify(current))return tail;
    revision++;current=next;
    const snapshot={version:1,data:structuredClone(current)};
    tail=tail.catch(()=>{}).then(async()=>{const id=await owner;await Promise.all([browser.storage.local.set({[localKey]:snapshot}),browser.storage.session?.set({[`${localKey}:${id}`]:snapshot})]);});
    return tail;
  }
  return {ready,patch,snapshot:()=>structuredClone(current),flush:()=>tail};
}
