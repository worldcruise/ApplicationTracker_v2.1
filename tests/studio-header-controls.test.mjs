import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import {createStudioHeaderPreferences} from '../extension/studio/studio-header-preferences.js';
import {createStudioHeaderControls} from '../extension/studio/studio-header-controls.js';

function preferencesFixture(){
  const normalizeStyle=style=>({documentTemplate:structuredClone(style.documentTemplate),formattingOverrides:{headerAlignment:'center',bodyFontSize:10,...style.formattingOverrides}});
  const candidate={id:'one',revision:1,document:{candidate:{id:'one',name:'Jordan Taylor'},personalDetails:{onlinePresence:{linkedin:'https://linkedin.com/in/example',github:'https://github.com/example',website:'https://example.test'}},applicationPreferences:{defaultDocumentStyle:{documentTemplate:{id:'harvard',version:1},formattingOverrides:{}}}}};
  const record={userEdited:true,draft:{candidateId:'one',documentTemplate:{id:'harvard',version:1},formattingOverrides:{headerAlignment:'center',bodyFontSize:10}}},saves=[];
  const service=createStudioHeaderPreferences({normalizeStyle,profiles:{get:async()=>structuredClone(candidate),save:async input=>{assert.equal(input.expectedRevision,candidate.revision);saves.push(input);candidate.document=structuredClone(input.document);candidate.revision++;}},drafts:{read:async()=>structuredClone(record)}});
  return {service,candidate,record,saves};
}

test('default style compares effective formatting, saves customization, and becomes dirty again after a change',async()=>{
  const f=preferencesFixture();assert.equal((await f.service.handle('one')).isDefault,true);
  f.record.draft.formattingOverrides.headerAlignment='right';assert.equal((await f.service.handle('one')).isDefault,false);
  const original=structuredClone(f.record);assert.equal((await f.service.handle('one',{action:'default'})).isDefault,true);
  assert.deepEqual(f.candidate.document.applicationPreferences.defaultDocumentStyle,{documentTemplate:{id:'harvard',version:1},formattingOverrides:{headerAlignment:'right',bodyFontSize:10},resumeWebsiteVisibility:{linkedin:true,github:true,website:true}});assert.deepEqual(f.record,original);
  f.record.draft.documentTemplate.id='ember';assert.equal((await f.service.handle('one')).isDefault,false);
  f.record.draft.documentTemplate.id='harvard';assert.equal((await f.service.handle('one')).isDefault,true);
});

test('header website master and individual options preserve the saved profile URLs',async()=>{
  const f=preferencesFixture(),before=structuredClone(f.candidate.document.personalDetails);
  const hidden=await f.service.handle('one',{action:'websites',visible:false});assert.deepEqual(hidden.websites,{linkedin:false,github:false,website:false});assert.equal(hidden.isDefault,false);
  assert.equal((await f.service.handle('one',{action:'default'})).isDefault,true);
  assert.deepEqual((await f.service.handle('one',{action:'websites',key:'linkedin',visible:true})).websites,{linkedin:true,github:false,website:false});
  assert.deepEqual((await f.service.handle('one',{action:'websites',visible:true})).websites,{linkedin:true,github:true,website:true});
  assert.deepEqual(f.candidate.document.personalDetails,before);
  await assert.rejects(f.service.handle('one',{action:'websites',key:'invalid',visible:false}),/website option/);
  await assert.rejects(f.service.handle(null,{action:'default'}),/Create your profile/);
});

const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):!tree||typeof tree!=='object'?[]:[tree,...nodes(tree.props?.children)];
function harness(t){
  const slots=[],effects=[],listeners=new Set(),requests=[],operations=[];let cursor=0,dirty=false;
  const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useRef:initial=>slots[cursor++]??={current:initial},
    useState(initial){const index=cursor++;if(!(index in slots))slots[index]=initial;return[slots[index],value=>{const next=typeof value==='function'?value(slots[index]):value;if(!Object.is(next,slots[index])){slots[index]=next;dirty=true;}}];},
    useEffect(effect,deps){const index=cursor++,previous=slots[index];if(!previous||deps.some((value,i)=>!Object.is(value,previous.deps[i]))){slots[index]={deps,cleanup:previous?.cleanup};effects.push(()=>{previous?.cleanup?.();slots[index].cleanup=effect();});}}};
  const server={candidateId:'one',websites:{linkedin:true,github:true,website:true},isDefault:true};
  const app={server,requests,operations,props:{controls:{draft:{candidateId:'one',documentTemplate:{id:'harvard',version:1},formattingOverrides:{}}},onChanged:async()=>{operations.push('changed');}},flush:async()=>{operations.push('flush');},request:async payload=>{
    requests.push(payload);operations.push(payload?.action||'read');if(payload?.action==='default')server.isDefault=true;
    if(payload?.action==='websites')server.websites=payload.key?{...server.websites,[payload.key]:payload.visible}:Object.fromEntries(Object.keys(server.websites).map(key=>[key,payload.visible]));return structuredClone(server);
  }};
  const Component=createStudioHeaderControls(React,{request:payload=>app.request(payload),flush:()=>app.flush(),storage:{onChanged:{addListener:fn=>listeners.add(fn),removeListener:fn=>listeners.delete(fn)}}});
  app.render=()=>{for(let i=0;i<20;i++){cursor=0;dirty=false;const tree=Component(app.props);while(effects.length)effects.shift()();if(!dirty)return tree;}throw Error('Header did not settle');};
  app.find=id=>nodes(app.render()).find(node=>node.props.id===id);
  app.settle=async()=>{for(let i=0;i<4;i++){app.render();await setImmediate();}return app.render();};
  t.after(()=>{for(const slot of slots)slot?.cleanup?.();assert.equal(listeners.size,0);});return app;
}

test('header enables Set as default for changed settings and disables it after flushing and saving once',async t=>{
  const app=harness(t);await app.settle();assert.equal(app.find('studio-set-default').props.disabled,true);
  app.server.isDefault=false;app.props.controls.draft.formattingOverrides={headerAlignment:'right'};await app.settle();assert.equal(app.find('studio-set-default').props.disabled,false);
  let release;app.flush=()=>{app.operations.push('flush');return new Promise(resolve=>release=resolve);};
  const click=app.find('studio-set-default').props.onClick;click();click();assert.equal(app.find('studio-set-default').props.disabled,true);assert.equal(app.requests.filter(item=>item?.action==='default').length,0);
  release();await app.settle();assert.equal(app.requests.filter(item=>item?.action==='default').length,1);assert.ok(app.operations.indexOf('flush')<app.operations.indexOf('default'));assert.equal(app.find('studio-set-default').props.disabled,true);assert.equal(nodes(app.render()).some(node=>node.props.role==='status'),false);
  app.server.isDefault=false;app.props.controls.draft.documentTemplate={id:'ember',version:1};await app.settle();assert.equal(app.find('studio-set-default').props.disabled,false);
});

test('customization websites are separate from the toolbar and failed default saves remain active',async t=>{
  const app=harness(t);await app.settle();assert.equal(nodes(app.render()).filter(node=>node.type==='input').length,0);app.props.section='websites';await app.settle();assert.equal(app.find('studio-set-default'),undefined);const inputs=nodes(app.render()).filter(node=>node.type==='input');assert.equal(inputs.length,4);
  inputs[0].props.onChange({target:{checked:false}});await app.settle();assert.deepEqual(app.requests.find(item=>item?.action==='websites'),{action:'websites',visible:false});assert.ok(nodes(app.render()).filter(node=>node.type==='input').every(node=>!node.props.checked));
  app.props.section='default';app.server.isDefault=false;app.props.controls.draft.formattingOverrides={bodyFontSize:11};await app.settle();const request=app.request;app.request=payload=>payload?.action==='default'?Promise.reject(Error('Could not save default.')):request(payload);
  app.find('studio-set-default').props.onClick();await app.settle();assert.equal(app.find('studio-set-default').props.disabled,false);assert.ok(nodes(app.render()).some(node=>node.props.role==='alert'));
});
