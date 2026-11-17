import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {connectAddressFields,createAddressLookup,addressCountryCode} from '../extension/ai-apply/src/profile-address.mjs';
const flush=()=>new Promise(resolve=>setTimeout(resolve,15));
function fixture(t,lookup){const win=new Window();t.after(()=>win.happyDOM.abort());const address={line1:'',line2:'Apartment 2',city:'',state:'',postalCode:'',country:'United States of America'},inputs={};for(const key of Object.keys(address)){const label=win.document.createElement('label'),input=win.document.createElement('input');input.value=address[key];label.append(input);win.document.body.append(label);inputs[key]=input;}const controller=connectAddressFields({inputs,address,lookup,delay:0});t.after(()=>controller.dispose());return{win,address,inputs,type(field,value){inputs[field].value=value;inputs[field].dispatchEvent(new win.Event('input'));}};}

test('selecting a street suggestion fills the linked fields and retains apartment details',async t=>{
 const app=fixture(t,{search:async()=>[{id:'place',label:'10 Main Street',description:'Boston, MA'}],resolve:async()=>({line1:'10 Main Street',city:'Boston',state:'Massachusetts',postalCode:'02110',country:'United States of America'})});app.type('line1','10 Main');await flush();app.win.document.querySelector('[role=option]').click();await flush();assert.equal(app.inputs.city.value,'Boston');assert.equal(app.address.postalCode,'02110');assert.equal(app.address.state,'Massachusetts');assert.equal(app.address.line2,'Apartment 2');assert.equal(app.inputs.line1.getAttribute('aria-expanded'),'false');
});

test('a unique postal lookup updates city and state without inventing a street address',async t=>{
 const app=fixture(t,{search:async()=>[{address:{city:'New York City',state:'New York',postalCode:'10001',country:'United States of America'}}]});app.address.line1=app.inputs.line1.value='My manually entered street';app.type('postalCode','10001');await flush();assert.equal(app.address.city,'New York City');assert.equal(app.address.state,'New York');assert.equal(app.address.line1,'My manually entered street');
});

test('ambiguous postal results require selection and city lookup never overwrites a street',async t=>{
 const app=fixture(t,{search:async()=>[{id:'one',label:'Springfield',address:{city:'Springfield',state:'Illinois',postalCode:'62701'}},{id:'two',label:'Other place',address:{city:'Other place',state:'Illinois',postalCode:'62701'}}],resolve:async({item})=>({...item.address,line1:'Do not use this street'})});app.type('postalCode','62701');await flush();assert.equal(app.address.city,'');assert.equal(app.win.document.querySelectorAll('[role=option]').length,2);app.inputs.postalCode.dispatchEvent(new app.win.KeyboardEvent('keydown',{key:'ArrowDown'}));app.inputs.postalCode.dispatchEvent(new app.win.KeyboardEvent('keydown',{key:'Enter'}));await flush();assert.equal(app.address.city,'Springfield');assert.equal(app.address.line1,'');
});

test('late lookup responses preserve newer manual edits, and network errors leave the address editable',async t=>{
 let finish;const app=fixture(t,{search:()=>new Promise(resolve=>finish=resolve)});app.type('postalCode','10001');await flush();app.type('city','My correction');finish([{address:{city:'Old result',state:'New York'}}]);await flush();assert.equal(app.address.city,'My correction');
 const failed=fixture(t,{search:async()=>{throw Error('Lookup unavailable');}});failed.type('line1','Unknown street');await flush();assert.equal(failed.address.line1,'Unknown street');assert.match(failed.win.document.querySelector('.af-address-status').textContent,/unavailable/);
});

test('lookup adapters use the original address API and map postal results into the canonical country schema',async()=>{
 const requests=[],lookup=createAddressLookup(async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>url.includes('zippopotam')?{places:[{'place name':'New York City',state:'New York'}]}:{suggestions:[{placeId:'one',mainText:'Main Street',secondaryText:'Boston'}]}};});
 assert.equal(addressCountryCode('United States of America'),'US');assert.equal(addressCountryCode('Canada'),'CA');const street=await lookup.search({field:'line1',value:'Main',address:{country:'Canada'},session:'one'});assert.equal(street[0].id,'one');assert.match(requests[0].url,/speedyapply.com\/api\/places\/autocomplete/);const postal=await lookup.search({field:'postalCode',value:'10001',address:{country:'United States of America'}});assert.equal(postal[0].address.country,'United States of America');assert.match(requests[1].url,/\/us\/10001$/);await assert.rejects(lookup.search({field:'postalCode',value:'10001',address:{country:''}}),/Choose a country/);
});
