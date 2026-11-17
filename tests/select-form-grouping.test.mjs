import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';

function fixture(t,html){const win=new Window({url:'https://employer.test/apply'});t.after(()=>win.happyDOM.abort());win.document.body.innerHTML=html;return {win,doc:win.document,form:createApplyForm(win.document)};}

test('a native Select2 field owns its search input and portalled option checkboxes',t=>{
 const {form}=fixture(t,'<form><label for="country">Country</label><select id="country" style="display:none"><option value="">Select</option><option value="US">United States</option></select><div class="select2-container" id="s2id_country"><input class="select2-search__field" aria-controls="country-menu" placeholder="Search"></div></form><div id="country-menu" role="listbox"><input placeholder="Filter options"><div role="option"><label><input type="checkbox" value="US">United States</label></div></div>');
 const fields=form.scan().fields;assert.equal(fields.length,1);assert.equal(fields[0].label,'Country');assert.equal(fields[0].type,'select-one');assert.deepEqual(fields[0].options.map(item=>item.value),['','US']);
});

test('an ARIA single-select exposes one question with its options instead of its nested search box',async t=>{
 const {form,doc}=fixture(t,'<form><div role="combobox" aria-labelledby="state-label" aria-controls="states"><label id="state-label">State</label><input placeholder="Search" role="combobox" aria-controls="states" aria-expanded="false"></div><input aria-label="Other answer"></form><ul id="states" role="listbox"><li role="option">Texas</li><li role="option">Oregon</li></ul>');
 const input=doc.querySelector('[role="combobox"] input');input.addEventListener('input',()=>input.setAttribute('aria-expanded','true'));for(const item of doc.querySelectorAll('[role="option"]'))item.addEventListener('click',()=>{input.value='';input.setAttribute('aria-valuetext',item.textContent);input.setAttribute('aria-expanded','false');});
 const fields=form.scan().fields;assert.equal(fields.length,2);assert.equal(fields[0].label,'State');assert.equal(fields[0].type,'select-one');assert.deepEqual(fields[0].options.map(item=>item.label),['Texas','Oregon']);
 await form.request({action:'bind',runId:'one'});await form.request({action:'answer',runId:'one',fieldId:fields[0].id,label:fields[0].label,answer:'Texas'});assert.equal(form.scan().fields[0].answer,'Texas');
});

test('one multi-select owns its portalled search and option controls and synchronizes all selections',async t=>{
 const {form,doc}=fixture(t,'<form><label id="work-label">Work arrangements</label><button type="button" role="combobox" aria-labelledby="work-label" aria-controls="work-menu" aria-expanded="true">Choose options</button><label>Email<input type="email"></label></form><div id="work-menu" role="listbox" aria-multiselectable="true"><input placeholder="Search options"><div role="option" aria-selected="false" data-value="remote"><label><input type="checkbox" value="remote">Remote</label></div><div role="option" aria-selected="false" data-value="hybrid"><label><input type="checkbox" value="hybrid">Hybrid</label></div></div>');
 for(const option of doc.querySelectorAll('[role="option"]'))option.addEventListener('click',event=>{if(event.target.tagName!=='INPUT')option.querySelector('input').checked=!option.querySelector('input').checked;option.setAttribute('aria-selected',String(option.querySelector('input').checked));});
 let fields=form.scan().fields;assert.equal(fields.length,2);assert.equal(fields[0].label,'Work arrangements');assert.equal(fields[0].multiple,true);assert.equal(fields[0].type,'select-multiple');assert.equal(fields[0].filled,false);
 await form.request({action:'bind',runId:'many'});await form.request({action:'answer',runId:'many',fieldId:fields[0].id,label:fields[0].label,answer:JSON.stringify(['remote','hybrid'])});fields=form.scan().fields;assert.deepEqual(fields[0].answerValues,['remote','hybrid']);assert.equal(fields[0].filled,true);assert.ok([...doc.querySelectorAll('[type="checkbox"]')].every(item=>item.checked));
 doc.querySelector('[value="remote"]').click();assert.deepEqual(form.scan().fields[0].answerValues,['hybrid']);
});

test('a checkbox question is one multiple-choice field and consent remains separate',async t=>{
 const {form,doc}=fixture(t,'<form><fieldset><legend>Work arrangements *</legend><label><input type="checkbox" name="arrangements" value="remote">Remote</label><label><input type="checkbox" name="arrangements" value="hybrid">Hybrid</label></fieldset><label><input type="checkbox" required>I agree to the terms</label></form>');
 const fields=form.scan().fields;assert.equal(fields.length,2);assert.equal(fields[0].label,'Work arrangements *');assert.equal(fields[0].multiple,true);assert.equal(fields[0].required,true);assert.equal(fields[1].type,'checkbox');
 await form.request({action:'bind',runId:'checks'});await form.request({action:'answer',runId:'checks',fieldId:fields[0].id,label:fields[0].label,answer:'["remote","hybrid"]'});assert.equal(doc.querySelector('[value="remote"]').checked,true);assert.equal(doc.querySelector('[value="hybrid"]').checked,true);assert.equal(doc.querySelector('[required]').checked,false);
});

test('native multiple-select answers include every selected option and reject unavailable choices before changing the form',async t=>{
 const {form,doc}=fixture(t,'<label>Skills<select multiple><option value="js">JavaScript</option><option value="ts">TypeScript</option><option value="py" disabled>Python</option></select></label>');
 const field=form.scan().fields[0];assert.equal(field.multiple,true);assert.equal(field.type,'select-multiple');await form.request({action:'bind',runId:'native-multi'});await form.request({action:'answer',runId:'native-multi',fieldId:field.id,label:field.label,answer:'["js","ts"]'});assert.deepEqual(form.scan().fields[0].answerValues,['js','ts']);assert.equal(form.scan().fields[0].answer,'JavaScript, TypeScript');
 await assert.rejects(form.request({action:'answer',runId:'native-multi',fieldId:field.id,label:field.label,answer:'["py"]'}),/available|disabled|dropdown/i);assert.deepEqual([...doc.querySelector('select').selectedOptions].map(option=>option.value),['js','ts']);
});

test('separate questions are not merged because their labels or choices are identical',t=>{
 const {form}=fixture(t,'<form><fieldset><legend>First role</legend><label>Country<select><option>US</option></select></label></fieldset><fieldset><legend>Second role</legend><label>Country<select><option>US</option></select></label></fieldset></form>');assert.equal(form.scan().fields.length,2);assert.notEqual(form.scan().fields[0].id,form.scan().fields[1].id);
});

test('adjacent comboboxes only expose their own linked options, including a container-based trigger',async t=>{
 const {form,doc}=fixture(t,'<form><input role="combobox" aria-label="Country" aria-controls="country-menu"><div role="combobox" tabindex="0" aria-label="State" aria-controls="state-menu">Select</div></form><ul id="country-menu" role="listbox"><li role="option" aria-selected="false">United States</li></ul><ul id="state-menu" role="listbox"><li role="option" aria-selected="false">Texas</li></ul>');
 doc.querySelector('#state-menu li').addEventListener('click',event=>event.currentTarget.setAttribute('aria-selected','true'));const fields=form.scan().fields;assert.equal(fields.length,2);assert.deepEqual(fields[0].options.map(option=>option.label),['United States']);assert.deepEqual(fields[1].options.map(option=>option.label),['Texas']);
 await form.request({action:'bind',runId:'adjacent'});await form.request({action:'answer',runId:'adjacent',fieldId:fields[1].id,label:fields[1].label,answer:'Texas'});assert.equal(form.scan().fields[1].answer,'Texas');assert.equal(form.scan().fields[0].filled,false);
});

test('a React multi-select reports every selected chip and keeps its search and hidden values inside one question',t=>{
 const {form}=fixture(t,'<div class="select__container"><label for="skills">Skills</label><div class="select__multi-value"><span class="select__multi-value__label">JavaScript</span><button type="button">Remove</button></div><div class="select__multi-value"><span class="select__multi-value__label">TypeScript</span></div><input id="skills" role="combobox" aria-controls="skills-options"><input type="hidden" name="skills[]" value="js"><input type="hidden" name="skills[]" value="ts"></div><ul role="listbox" id="skills-options"><li role="option" data-value="js">JavaScript</li><li role="option" data-value="ts">TypeScript</li></ul>');
 const fields=form.scan().fields;assert.equal(fields.length,1);assert.equal(fields[0].multiple,true);assert.deepEqual(fields[0].answerValues,['js','ts']);assert.equal(fields[0].answer,'JavaScript, TypeScript');
});
