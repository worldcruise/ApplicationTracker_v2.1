import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';

function fixture(t,html){const win=new Window({url:'https://employer.test/apply'});win.document.body.innerHTML=html;t.after(()=>win.happyDOM.abort());return {win,doc:win.document,form:createApplyForm(win.document)};}
const bind=(form)=>form.request({action:'bind',runId:'dropdown'});
const fill=(form,profile)=>form.request({action:'fill',runId:'dropdown',profile});
const answer=(form,value)=>{const field=form.scan().fields[0];return form.request({action:'answer',runId:'dropdown',fieldId:field.id,label:field.label,answer:value});};

test('university autocomplete without a combobox role selects the returned institution instead of leaving a text query',async t=>{
  const {win,doc,form}=fixture(t,'<label for="school">University name</label><input id="school" name="school"><input type="hidden" name="school_id">');const input=doc.querySelector('#school'),hidden=doc.querySelector('[name=school_id]');let timer,selected=0;
  input.addEventListener('input',()=>{win.clearTimeout(timer);timer=win.setTimeout(()=>{if(hidden.value)return;doc.querySelector('#suggestions')?.remove();const menu=doc.createElement('ul');menu.id='suggestions';menu.setAttribute('role','listbox');const option=doc.createElement('li');option.setAttribute('role','option');option.textContent='University of North Florida (Jacksonville, FL)';option.onmousedown=()=>{selected++;hidden.value='unf';menu.remove();};menu.append(option);doc.body.append(menu);},60);});
  input.onchange=input.onblur=()=>{if(!hidden.value)input.value='';};await bind(form);
  const result=await fill(form,{educationData:[{school:'University of North Florida'}]});assert.equal(selected,1);assert.equal(hidden.value,'unf');assert.equal(input.value,'University of North Florida');assert.equal(result.fields[0].filled,true);
});

test('a dropdown with a separate searchable popup opens and commits via mouse events',async t=>{
  const {doc,form}=fixture(t,'<label for="state">State</label><button id="state" type="button" aria-haspopup="true" aria-controls="states">Select an option</button><div id="states" role="listbox" hidden><input type="search"><div role="option" data-value="TX">Texas</div></div>');
  const button=doc.querySelector('button'),menu=doc.querySelector('#states'),search=menu.querySelector('input');button.onmousedown=()=>{menu.hidden=false;button.setAttribute('aria-expanded','true');};let selected=0;
  menu.querySelector('[role=option]').onmousedown=()=>{selected++;button.textContent='Texas';button.setAttribute('aria-valuetext','Texas');button.setAttribute('aria-expanded','false');menu.hidden=true;};
  await bind(form);const result=await fill(form,{addressData:{state:'TX'}});assert.equal(selected,1);assert.equal(search.value,'TX');assert.equal(result.fields[0].answer,'Texas');assert.equal(result.fields[0].filled,true);
});

test('option acceptance waits for an asynchronous selected value instead of finishing after typing',async t=>{
  const {win,doc,form}=fixture(t,'<div class="select-shell"><label for="country">Country</label><span class="select__single-value" hidden></span><input id="country" role="combobox" aria-controls="menu" aria-expanded="true"></div><ul role="listbox" id="menu"><li role="option" data-value="US">United States</li></ul>');
  doc.querySelector('li').onclick=()=>win.setTimeout(()=>{const selected=doc.querySelector('span');selected.hidden=false;selected.textContent='United States';doc.querySelector('#country').value='';doc.querySelector('#country').setAttribute('aria-expanded','false');doc.querySelector('ul').hidden=true;},100);
  await bind(form);const result=await fill(form,{addressData:{country:'US'}});assert.equal(result.fields[0].filled,true);assert.equal(result.fields[0].answer,'United States');
});

test('an old selected value is not accepted as proof that a newly requested option was selected',async t=>{
  const {doc,form}=fixture(t,'<div class="select-shell"><label for="country">Country</label><span class="select__single-value">Canada</span><input id="country" role="combobox" aria-controls="menu" aria-expanded="true"></div><ul role="listbox" id="menu"><li role="option">United States</li></ul>');
  await bind(form);await assert.rejects(()=>answer(form,'United States'),/did not accept/);assert.equal(doc.querySelector('span').textContent,'Canada');
});

test('native select placeholders with nonempty values do not prevent selecting the saved answer',async t=>{
  const {doc,form}=fixture(t,'<label for="country">Country</label><select id="country"><option value="placeholder">Please select a country</option><option value="US">United States</option></select>');await bind(form);assert.equal(form.scan().fields[0].filled,false);
  const result=await fill(form,{addressData:{country:'US'}});assert.equal(doc.querySelector('select').value,'US');assert.equal(result.fields[0].filled,true);
});

test('multi-select activates the actual options and waits for delayed selections',async t=>{
  const {win,doc,form}=fixture(t,'<button id="work" type="button" role="combobox" aria-label="Work arrangements" aria-controls="menu">Select</button><ul id="menu" role="listbox" aria-multiselectable="true" hidden><li role="option" data-value="remote" aria-selected="false">Remote</li><li role="option" data-value="hybrid" aria-selected="false">Hybrid</li></ul>');
  const menu=doc.querySelector('ul');doc.querySelector('button').onmousedown=()=>{menu.hidden=false;};for(const option of menu.children)option.onmousedown=()=>win.setTimeout(()=>option.setAttribute('aria-selected','true'),80);
  await bind(form);const result=await answer(form,'["Remote","Hybrid"]');assert.deepEqual(result.fields[0].answerValues,['remote','hybrid']);assert.equal(result.fields[0].filled,true);
});

test('an ordinary university text field remains fillable when it has no suggestion widget',async t=>{
  const {win,doc,form}=fixture(t,'<label for="school">University</label><input id="school">');const native=win.setTimeout.bind(win);win.setTimeout=(callback,time)=>native(callback,Math.min(time,2));
  await bind(form);const result=await fill(form,{educationData:[{school:'Example University'}]});assert.equal(doc.querySelector('input').value,'Example University');assert.equal(result.fields[0].filled,true);
});
