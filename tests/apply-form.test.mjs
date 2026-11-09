import assert from 'node:assert/strict';
import test from 'node:test';
import {Window} from 'happy-dom';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';
import {emptyProfile} from '../extension/studio/profile-model.js';

test('form bridge fills explicit facts, preserves existing values and leaves consent and custom answers for review',async t=>{
  const page=new Window({url:'https://example.test/apply'});t.after(()=>page.happyDOM.abort());
  page.document.body.innerHTML='<form><label>First name<input autocomplete="given-name" required></label><label>Email<input type="email" value="keep@example.test" required></label><label>Country<select required><option value="">Choose</option><option value="US">United States of America</option></select></label><label>Confirm consent<input type="checkbox" required></label><fieldset><legend>Work schedule</legend><label>Remote<input name="schedule" value="remote" type="radio" required></label><label>Office<input name="schedule" value="office" type="radio"></label></fieldset><label>When can you start?<input id="start" required></label><input type="hidden" name="secret" value="keep"><input type="password" value="keep"></form>';
  const profile=emptyProfile();profile.nameData.firstName='Jordan';profile.contactData.email='profile@example.test';profile.addressData.country='United States of America';
  const form=createApplyForm(page.document);await form.request({action:'bind',runId:'one'});let state=await form.request({action:'fill',runId:'one',profile});
  assert.equal(page.document.querySelector('[autocomplete]').value,'Jordan');assert.equal(page.document.querySelector('[type="email"]').value,'keep@example.test');assert.equal(page.document.querySelector('select').value,'US');assert.equal(page.document.querySelector('[type="checkbox"]').checked,false);assert.equal(state.fields.length,6);
  const consent=state.fields.find(field=>field.type==='checkbox'),schedule=state.fields.find(field=>field.type==='radio'),start=state.fields.find(field=>field.label==='When can you start?');
  await form.request({action:'answer',runId:'one',fieldId:consent.id,label:consent.label,answer:'Yes'});await form.request({action:'answer',runId:'one',fieldId:schedule.id,label:schedule.label,answer:'office'});assert.equal(page.document.querySelector('[value="office"]').checked,true);
  page.document.querySelector('#start').setAttribute('aria-label','A different question');await assert.rejects(form.request({action:'answer',runId:'one',fieldId:start.id,label:start.label,answer:'Tomorrow'}),/question changed/);
  await form.request({action:'cancel',runId:'one'});await assert.rejects(form.request({action:'fill',runId:'one',profile}),/another autofill run/);
  assert.equal(page.document.querySelector('[type="hidden"]').value,'keep');assert.equal(page.document.querySelector('[type="password"]').value,'keep');
});
