import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';
import {emptyProfile} from '../extension/studio/profile-model.js';
import {applyFixture} from './helpers/apply-dock-fixture.mjs';

function profile(){const value=emptyProfile();Object.assign(value.addressData,{line1:'12 Example Street',line2:'Suite 4',city:'Austin',state:'Texas',postalCode:'78701',country:'United States of America'});return value;}

test('the form scanner finds and fills street address inside a custom element shadow root',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form><address-input label="Street address" id="street-host"></address-input></form>';
 const host=page.document.querySelector('address-input'),shadow=host.attachShadow({mode:'open'});shadow.innerHTML='<input id="input" required>';
 const form=createApplyForm(page.document),value=profile(),before=await form.request({action:'inspect',profile:value});
 assert.equal(before.fields.length,1);assert.equal(before.fields[0].label,'Street address');assert.equal(before.fields[0].canAutofill,true);
 await form.request({action:'bind',runId:'shadow',profile:value});const after=await form.request({action:'fill',runId:'shadow',profile:value});assert.equal(shadow.querySelector('input').value,value.addressData.line1);assert.equal(after.fields[0].filled,true);
});

test('street-address autocomplete and address suggestions preserve the saved street and commit its matching option',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form><label for="street">Street address</label><input id="street" role="combobox" autocomplete="address-line1" aria-controls="addresses" aria-expanded="false"><ul id="addresses" role="listbox" hidden><li role="option">12 Example Street, Austin, Texas 78701</li><li role="option">120 Example Street, Austin, Texas 78701</li></ul></form>';
 const input=page.document.querySelector('input'),menu=page.document.querySelector('ul');page.document.querySelector('form').insertAdjacentHTML('beforeend','<input type="hidden" name="job_id" value="456"><span class="select__single-value">Texas</span>');input.addEventListener('input',()=>{menu.hidden=false;input.setAttribute('aria-expanded','true');});for(const option of menu.children)option.addEventListener('click',()=>{input.value=option.textContent.split(',')[0];input.setAttribute('aria-expanded','false');menu.hidden=true;});
 const form=createApplyForm(page.document),value=profile();await form.request({action:'bind',runId:'address'});const result=await form.request({action:'fill',runId:'address',profile:value});assert.equal(input.value,value.addressData.line1);assert.equal(result.fields[0].filled,true);assert.match(result.fields[0].answer,/12 Example Street/);
});

test('standard street-address textareas use both saved address lines and emit framework-compatible input events',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form><textarea id="street" autocomplete="street-address"></textarea></form>';
 const input=page.document.querySelector('textarea'),events=[];for(const name of ['input','change'])input.addEventListener(name,event=>events.push({name,composed:event.composed}));
 const form=createApplyForm(page.document),value=profile();await form.request({action:'bind',runId:'native'});await form.request({action:'fill',runId:'native',profile:value});assert.equal(input.value,'12 Example Street\nSuite 4');assert.deepEqual(events,[{name:'input',composed:true},{name:'change',composed:true}]);
});

test('an inherited about:blank application frame is inspected instead of being discarded as an empty page',async t=>{
 const app=await applyFixture(t),url='https://example.test/application';app.employer('<main>Application</main>',url);
 const frame=new Window({url:'about:blank'});t.after(()=>frame.happyDOM.abort());Object.defineProperty(frame,'origin',{value:'https://example.test'});frame.document.body.innerHTML='<form><label>Street address<input name="streetAddress" required></label></form>';
 const nested=createApplyForm(frame.document),original=app.browser.tabs.sendMessage;
 app.browser.scripting.executeScript=async()=>[{frameId:0,documentId:'document-7'},{frameId:2,documentId:'embedded'}];
 app.browser.tabs.sendMessage=async(id,message,options)=>options.documentId==='embedded'?{ok:true,result:await nested.request(message)}:original(id,message,options);
 const result=await app.request('DOCK_APPLY_INSPECT');assert.equal(result.fields.length,1);assert.equal(result.fields[0].label,'Street address');assert.equal(result.fields[0].frameId,2);
 app.profiles.values().next().value.profile.addressData=profile().addressData;
 await app.request('DOCK_APPLY_START',{profileOnly:true,tabId:7,fieldKeys:[result.fields[0].key]});const run=await app.settled();assert.equal(run.fields[0].filled,true);assert.equal(frame.document.querySelector('input').value,'12 Example Street');
});

test('shadow controls respect hidden hosts, root-local labels, and employer history',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<label id="caption">Unrelated outer label</label><address-input id="visible"></address-input><address-input id="hidden" hidden></address-input><fieldset id="workExperience-1"><legend>Work experience</legend><address-input id="work" label="Street address"></address-input></fieldset>';
 for(const id of ['visible','hidden','work'])page.document.getElementById(id).attachShadow({mode:'open'}).innerHTML='<label id="caption">Street address</label><input aria-labelledby="caption">';
 const form=createApplyForm(page.document),value=profile();await form.request({action:'bind',runId:'visibility',profile:value});const result=await form.request({action:'fill',runId:'visibility',profile:value});
 assert.equal(result.fields.length,2);assert.ok(result.fields.every(field=>field.label==='Street address'));assert.equal(page.document.querySelector('#visible').shadowRoot.querySelector('input').value,value.addressData.line1);assert.equal(page.document.querySelector('#hidden').shadowRoot.querySelector('input').value,'');assert.equal(page.document.querySelector('#work').shadowRoot.querySelector('input').value,'');
});

test('address autocomplete never chooses a different house number or overwrites an unfinished user query',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<label for="street">Street address</label><input id="street" role="combobox" autocomplete="address-line1" aria-controls="addresses" aria-expanded="false"><ul id="addresses" role="listbox"><li role="option">120 Example Street, Austin, Texas 78701</li></ul>';
 const input=page.document.querySelector('input');input.addEventListener('input',()=>input.setAttribute('aria-expanded','true'));let selected=0;page.document.querySelector('li').addEventListener('click',()=>selected++);
 const form=createApplyForm(page.document),value=profile();await form.request({action:'bind',runId:'unmatched'});const pending=form.request({action:'fill',runId:'unmatched',profile:value});await new Promise(resolve=>setTimeout(resolve,20));input.value='My own address search';
 const result=await pending;assert.equal(selected,0);assert.equal(input.value,'My own address search');assert.equal(result.fields[0].filled,false);
});

test('Google-style street suggestions commit their street option and trigger the employer address handler',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<label>Street address<input class="pac-target-input" autocomplete="address-line1"></label><div class="pac-container" hidden><div class="pac-item"><span class="pac-item-query">12 Example Street</span><span>Austin, Texas 78701</span></div></div>';
 const input=page.document.querySelector('input'),menu=page.document.querySelector('.pac-container');input.addEventListener('input',()=>{menu.hidden=false;input.setAttribute('aria-expanded','true');});let accepted=false;page.document.querySelector('.pac-item').addEventListener('click',()=>{accepted=true;menu.hidden=true;input.setAttribute('aria-expanded','false');});
 const form=createApplyForm(page.document);await form.request({action:'bind',runId:'google'});const result=await form.request({action:'fill',runId:'google',profile:profile()});assert.equal(accepted,true);assert.equal(result.fields[0].filled,true);assert.equal(result.fields[0].answer,'12 Example Street');
});

test('opaque sandboxed blank frames are excluded from inspection',async t=>{
 const app=await applyFixture(t);app.employer('<main>Application</main>');const original=app.browser.tabs.sendMessage;app.browser.scripting.executeScript=async()=>[{frameId:0,documentId:'document-7'},{frameId:2,documentId:'opaque'}];app.browser.tabs.sendMessage=async(id,message,options)=>options.documentId==='opaque'?{ok:true,result:{url:'about:srcdoc',origin:'null',fields:[{id:'f',label:'Street address'}]}}:original(id,message,options);
 assert.deepEqual((await app.request('DOCK_APPLY_INSPECT')).fields,[]);
});
