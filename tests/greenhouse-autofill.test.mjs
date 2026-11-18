import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createApplyForm} from '../extension/studio/dock-apply-form.js';
import {emptyProfile} from '../extension/studio/profile-model.js';

function greenhouse(t) {
  const page=new Window({url:'https://job-boards.greenhouse.io/employer/jobs/123'});t.after(()=>page.happyDOM.abort());
  page.document.body.innerHTML=`<form id="application-form">
    <label for="first_name">First Name<span aria-hidden="true">*</span></label><input id="first_name" autocomplete="given-name" aria-required="true">
    <label for="last_name">Last Name</label><input id="last_name" autocomplete="family-name" aria-required="true">
    <label for="email">Email</label><input id="email" autocomplete="email" value="keep@example.test">
    <div class="select"><label for="country">Country</label><div class="select-shell"><div class="select__single-value" hidden></div><input id="country" role="combobox" aria-controls="country-options" aria-required="true" required aria-expanded="false"></div></div>
    <div class="file-upload" role="group" aria-labelledby="upload-label-resume" aria-required="true"><div id="upload-label-resume">Resume/CV</div><div><label for="resume">Attach</label><input id="resume" type="file" style="display:none"></div></div>
    <div class="file-upload" role="group" aria-labelledby="upload-label-cover_letter"><div id="upload-label-cover_letter">Cover Letter</div><div><label for="cover_letter">Attach</label><input id="cover_letter" type="file" style="display:none"></div></div>
    <div style="display:none"><label>Hidden question<input id="hidden-question" required></label></div>
    <label>Consent<input type="checkbox" required></label><button type="submit">Submit application</button>
  </form><div id="country-options" role="listbox" hidden></div>`;
  const doc=page.document,input=doc.querySelector('#country'),menu=doc.querySelector('#country-options'),selected=doc.querySelector('.select__single-value');
  let country='',uploads=0,submits=0;
  const render=()=>{
    menu.hidden=false;input.setAttribute('aria-expanded','true');menu.replaceChildren();
    for(const [value,label] of [['GB','United Kingdom +44'],['US','United States +1'],['CA','Canada +1']]){
      if(input.value&&!label.toLowerCase().includes(input.value.toLowerCase()))continue;
      const option=doc.createElement('div');option.setAttribute('role','option');option.textContent=label;
      option.addEventListener('mousedown',event=>event.preventDefault());option.addEventListener('click',()=>{country=value;selected.textContent=label;selected.hidden=false;input.value='';input.setAttribute('aria-expanded','false');menu.hidden=true;});menu.append(option);
    }
  };
  input.addEventListener('focus',render);input.addEventListener('input',render);input.addEventListener('keydown',event=>{if(event.key==='ArrowDown')render();if(event.key==='Escape'){menu.hidden=true;input.setAttribute('aria-expanded','false');}});
  doc.querySelector('form').addEventListener('submit',event=>{event.preventDefault();submits++;});
  const profile=emptyProfile();profile.nameData.firstName='Jordan';profile.nameData.lastName='Taylor';profile.contactData.email='new@example.test';profile.addressData.country='United States of America';
  const form=createApplyForm(doc,{uploadResume(node,resume){const transfer=new page.DataTransfer();transfer.items.add(new page.File(['%PDF test'],resume.fileName,{type:'application/pdf'}));node.files=transfer.files;node.dispatchEvent(new page.Event('change',{bubbles:true}));uploads++;}});
  return {page,doc,form,profile,input,selected,get country(){return country;},get uploads(){return uploads;},get submits(){return submits;}};
}

test('Greenhouse fills identity, commits its country dropdown and attaches the prepared resume behind Attach',async t=>{
  const f=greenhouse(t);assert.equal(f.doc.querySelector('#first_name').value,'');assert.equal(f.uploads,0);
  await f.form.request({action:'bind',runId:'greenhouse'});
  const state=await f.form.request({action:'fill',runId:'greenhouse',profile:f.profile,resume:{fileName:'Tailored.pdf',resumeBase64:btoa('%PDF test')}});
  assert.equal(f.doc.querySelector('#first_name').value,'Jordan');assert.equal(f.doc.querySelector('#last_name').value,'Taylor');assert.equal(f.doc.querySelector('#email').value,'keep@example.test');
  assert.equal(f.country,'US');assert.equal(f.input.value,'','The dropdown search is cleared after an actual selection');
  assert.equal(state.fields.find(field=>field.label==='Country').answer,'United States +1');assert.equal(state.fields.find(field=>field.label==='Country').filled,true);
  const resume=state.fields.find(field=>field.label==='Resume/CV');assert.equal(resume.filled,true);assert.equal(resume.required,true);assert.equal(resume.answer,'Tailored.pdf');assert.equal(f.uploads,1);
  assert.equal(f.doc.querySelector('#cover_letter').files.length,0);assert.equal(f.doc.querySelector('[type=checkbox]').checked,false);assert.equal(f.submits,0);
  assert.ok(!state.fields.some(field=>field.label==='Hidden question'));
});

test('Greenhouse dropdown search text is pending until a real option is selected, and accepted answers survive rescans',async t=>{
  const f=greenhouse(t);await f.form.request({action:'bind',runId:'greenhouse'});
  f.input.value='United';let state=await f.form.request({action:'scan',runId:'greenhouse'}),country=state.fields.find(field=>field.label==='Country');
  assert.equal(country.filled,false);assert.equal(country.answer,'');
  await f.form.request({action:'fill',runId:'greenhouse',profile:f.profile});assert.equal(f.country,'US','Autofill commits a matching option instead of leaving search text behind');
  state=await f.form.request({action:'answer',runId:'greenhouse',fieldId:country.id,label:country.label,answer:'Canada'});
  assert.equal(f.country,'CA');assert.equal(state.fields.find(field=>field.label==='Country').filled,true);
  state=await f.form.request({action:'fill',runId:'greenhouse',profile:f.profile});assert.equal(f.country,'CA','Existing selections are preserved');
  f.selected.hidden=true;f.selected.textContent='';state=await f.form.request({action:'scan',runId:'greenhouse'});assert.equal(state.fields.find(field=>field.label==='Country').filled,false,'Clearing a selection returns it to pending');
});

test('Greenhouse does not mark an unavailable option or a stale paused selection as filled',async t=>{
  const f=greenhouse(t);await f.form.request({action:'bind',runId:'greenhouse'});
  const country=f.form.scan().fields.find(field=>field.label==='Country');
  await assert.rejects(f.form.request({action:'answer',runId:'greenhouse',fieldId:country.id,label:country.label,answer:'Unavailable country'}),/employer dropdown/);
  assert.equal(f.form.scan().fields.find(field=>field.label==='Country').filled,false);
  const pending=f.form.request({action:'answer',runId:'greenhouse',fieldId:country.id,label:country.label,answer:'Unavailable country'});
  await new Promise(resolve=>setTimeout(resolve,15));await f.form.request({action:'pause',runId:'greenhouse'});
  await assert.rejects(pending,/paused run/);assert.equal(f.country,'');
});

test('classic Greenhouse keeps hidden native selects connected to their Select2 widgets and labels its upload correctly',async t=>{
  const page=new Window({url:'https://boards.greenhouse.io/employer/jobs/123'});t.after(()=>page.happyDOM.abort());
  page.document.body.innerHTML=`<form id="application_form"><div class="field"><label for="country">Country</label><div id="s2id_country" class="select2-container"><span class="select2-chosen">Select...</span></div><select id="country" style="display:none"><option value="">Select...</option><option value="US">United States</option></select></div><div id="s3_upload_for_resume"><label>Attach</label><input id="resume" type="file" style="display:none"></div></form>`;
  const profile=emptyProfile();profile.addressData.country='United States of America';
  let changes=0;page.document.querySelector('#country').addEventListener('change',()=>changes++);
  const form=createApplyForm(page.document);await form.request({action:'bind',runId:'classic'});
  const state=await form.request({action:'fill',runId:'classic',profile});
  assert.equal(page.document.querySelector('select').value,'US');assert.equal(changes,1);
  assert.equal(state.fields.find(field=>field.label==='Country').filled,true);assert.ok(state.fields.some(field=>field.label==='Resume/CV'));
});

test('a user edit while Greenhouse options load is preserved',async t=>{
  const f=greenhouse(t);await f.form.request({action:'bind',runId:'greenhouse'});
  const country=f.form.scan().fields.find(field=>field.label==='Country');
  const pending=f.form.request({action:'answer',runId:'greenhouse',fieldId:country.id,label:country.label,answer:'Unavailable country'});
  await new Promise(resolve=>setTimeout(resolve,15));f.input.value='My own search';
  await assert.rejects(pending,/dropdown changed/);assert.equal(f.input.value,'My own search');assert.equal(f.country,'');
});

test('both documents attach through hidden native wrappers when the employer replaces the letter input after receiving the resume',async t=>{
 const page=new Window({url:'https://job-boards.greenhouse.io/employer/jobs/123'});t.after(()=>page.happyDOM.abort());
 page.document.body.innerHTML='<form><section class="file-upload" aria-labelledby="resume-heading"><h3 id="resume-heading">Résumé / CV</h3><label for="resume">Attach resume</label><div hidden><input id="resume" type="file" accept=".pdf"></div></section><section class="file-upload" aria-labelledby="letter-heading"><h3 id="letter-heading">Cover letter</h3><label for="letter">Attach</label><div hidden><input id="letter" type="file" accept=".pdf"></div></section></form>';
 const received=[],events=[];page.document.addEventListener('input',event=>{if(event.target.type==='file')events.push(event.target.id);});
 page.document.addEventListener('change',event=>{if(event.target.type!=='file')return;received.push(event.target.files[0].name);if(event.target.id==='resume'){const letter=page.document.querySelector('#letter');letter.replaceWith(letter.cloneNode(true));}});
 const form=createApplyForm(page.document);await form.request({action:'bind',runId:'uploads'});
 assert.equal(form.scan().fields.filter(field=>field.type==='file').length,2);
 const state=await form.request({action:'fill',runId:'uploads',selectedIds:[],resume:{resumeBase64:btoa('%PDF-1.7 tailored resume'),fileName:'Tailored.pdf'},coverLetter:{resumeBase64:btoa('%PDF-1.7 saved letter'),fileName:'Letter.pdf',text:'My letter'}});
 assert.deepEqual(received,['Tailored.pdf','Letter.pdf']);assert.deepEqual(events,['resume','letter']);assert.ok(state.fields.filter(field=>field.type==='file').every(field=>field.filled));
});

test('a rejected document upload reports the reason while other documents and fields still fill',async t=>{
 const page=new Window({url:'https://employer.test/apply'});t.after(()=>page.happyDOM.abort());page.document.body.innerHTML='<form><label>Resume<input id="resume" type="file" accept=".docx"></label><label>Cover letter<input id="cover" type="file" accept=".pdf"></label><label>Email<input id="email"></label></form>';
 const profile=emptyProfile();profile.contactData.email='candidate@example.test';const form=createApplyForm(page.document);await form.request({action:'bind',runId:'file-types'});
 const state=await form.request({action:'fill',runId:'file-types',profile,resume:{fileName:'Resume.pdf',resumeBase64:btoa('%PDF resume')},coverLetter:{fileName:'Letter.pdf',resumeBase64:btoa('%PDF letter')}});
 assert.equal(page.document.querySelector('#resume').files.length,0);assert.equal(page.document.querySelector('#cover').files[0].name,'Letter.pdf');assert.equal(page.document.querySelector('#email').value,profile.contactData.email);assert.match(state.fields.find(field=>field.label==='Resume/CV').uploadError,/accept|\.docx/i);
});
