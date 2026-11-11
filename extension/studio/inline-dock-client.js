import {withRequestDeadline} from './request-deadline.js';
export async function createInlineDockClient(browser=globalThis.chrome,scope=globalThis){
  async function call(action,payload={}){
    const reply=await withRequestDeadline(browser.runtime.sendMessage({type:'inline-dock:request',token:scope.__applicationTrackerInlineConfig?.token,action,payload}));
    if(!reply?.ok)throw Error(reply?.error?.message||'The dock could not connect. Click the toolbar icon to reconnect.');return reply.result;
  }
  const context=await call('context'),listeners=new Set();
  const scoped=key=>`${key}:${context.tabId}`;
  const read=async(action,key)=>{const values=await call(action,{key:typeof key==='string'?scoped(key):key});return typeof key==='string'?{[key]:values[scoped(key)]}:values;};
  const write=async(action,values)=>{for(const [key,value]of Object.entries(values))await call(action,{key:scoped(key),value});};
  const changed=(message,sender)=>{if(sender.id===browser.runtime.id&&message?.type==='inline-dock:changed'){const changes=Object.fromEntries(message.keys.map(key=>[key,{}]));for(const listener of listeners)listener(changes,'local');}};
  browser.runtime.onMessage.addListener(changed);
  return {call,context,
    browser:{runtime:{getURL:path=>browser.runtime.getURL(path),sendMessage:envelope=>call('request',envelope)},
      windows:{getCurrent:async()=>({id:context.windowId})},
      tabs:{query:()=>call('tabs-query'),create:payload=>call('tabs-create',payload),update:(id,payload)=>call('tabs-update',{id,...payload})},
      storage:{local:{get:()=>call('local-read')},session:{get:key=>read('session-read',key),set:values=>write('session-write',values)},onChanged:browser.storage.onChanged}},
    privateStorage:{get:key=>read('private-read',key),set:values=>write('private-write',values),onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}},
    close(){browser.runtime.onMessage.removeListener(changed);listeners.clear();}
  };
}
