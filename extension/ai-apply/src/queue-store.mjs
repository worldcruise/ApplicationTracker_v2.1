// All profiles and jobs belong to Application Tracker's canonical store.
let backend;
export function setQueueBackend(value) { backend=value; }
export const defaultControl=()=>({selectedCandidateId:null});
export function createQueueStore() {
  async function call(action,payload={}) {
    try {
      if(backend)return await backend(action,payload);
      const reply=await chrome.runtime.sendMessage({type:'ai-apply.store',action,payload,access:new URL(location.href).searchParams.get('access')});
      if(!reply?.ok)throw Object.assign(Error(reply?.error||'The shared Job Queue could not connect.'),{code:reply?.code,duplicate:reply?.duplicate});
      return reply.value;
    } catch(error) {
      if(error.code==='DUPLICATE_JOB')Object.assign(error,{code:'already-applied',duplicate:{matchedBy:['url'],location:'applications or queue'}});
      throw error;
    }
  }
  async function read(){return call('read');}
  let tail=Promise.resolve();
  function change(edit){
    const task=tail.then(async()=>{
      const state=await read(),previous=structuredClone(state),value=edit(state);
      if(value?.then)throw Error('Storage edits must be synchronous.');
      if(JSON.stringify(previous.profiles)!==JSON.stringify(state.profiles))throw Error('Update your single profile from Application Tracker Settings.');
      const before=new Map(previous.requests.map(item=>[item.id,item])),after=new Map(state.requests.map(item=>[item.id,item]));
      const changes=state.requests.filter(item=>JSON.stringify(item)!==JSON.stringify(before.get(item.id))).map(record=>({record,expectedRevision:before.get(record.id)?.canonicalRevision??null}));
      const deleted=previous.requests.filter(item=>!after.has(item.id)).map(item=>({id:item.id,expectedRevision:item.canonicalRevision}));
      const saved=changes.length||deleted.length?await call('commit',{changes,deleted}):state;
      // Generation stores the returned job snapshot for its later auto-save.
      // Use the canonical revision/time assigned by the tracker transaction.
      const committed=value&&typeof value==='object'&&value.id?saved.requests.find(item=>item.id===value.id)||value:value;
      return {state:saved,value:committed};
    });tail=task.catch(()=>{});return task;
  }
  return {read,change,async getJob(id){return (await read()).requests.find(item=>item.id===id);}};
}
