import test from 'node:test';
import assert from 'node:assert/strict';
import {Window} from 'happy-dom';
import {createAutofillFormReview} from '../extension/ai-apply/src/autofill-form-review.mjs';

function fixture(t){
  const win=new Window(),host=win.document.createElement('section'),previous=globalThis.document;
  globalThis.document=win.document;win.document.body.append(host);
  const review=createAutofillFormReview(host);
  t.after(()=>{globalThis.document=previous;return win.happyDOM.abort();});
  return {win,host,review,update:fields=>review.update(fields,{key:'job:tab:page'}),edit(key,value){const input=host.querySelector(`[data-answer-key="${key}"]`);input.value=value;input.dispatchEvent(new win.Event('input',{bubbles:true}));return input;}};
}
const field={key:'why',label:'Why this role?',type:'textarea',kind:'ai',filled:false,required:true,answer:''};

test('each question has its number and AI checkbox on the left, verified status on the right, and a collapsed answer',t=>{
  const f=fixture(t);f.update([field,{...field,key:'optional',label:'Anything else?',required:false},{...field,key:'name',label:'Name',filled:true,answer:'Jordan'}]);
  const rows=[...f.host.querySelectorAll('.tracker-form-row')];assert.equal(rows.length,3);
  assert.equal(rows[0].open,false);assert.equal(rows[0].querySelector('summary').firstChild.className,'tracker-question-number');
  assert.equal(rows[0].querySelector('summary').lastChild.className,'tracker-question-check');
  assert.equal(rows[0].querySelector('.tracker-question-index').textContent,'1');
  assert.equal(rows[0].querySelector('.tracker-question-pick').checked,true);
  assert.equal(rows[1].querySelector('.tracker-question-pick').checked,false);
  assert.equal(rows[2].querySelector('.tracker-question-check').dataset.filled,'true');
  assert.equal(rows[2].querySelector('.tracker-question-pick').disabled,true);
  rows[0].querySelector('.tracker-question-pick').click();assert.equal(rows[0].open,false);assert.deepEqual(f.review.selected(),[]);
  rows[0].querySelector('summary').click();assert.equal(rows[0].open,true);
});

test('manual drafts survive polling and collapse only after the employer accepts the matching value',t=>{
  const f=fixture(t);f.update([field]);const row=f.host.querySelector('details');row.open=true;
  const input=f.edit('why','My reviewed answer');input.focus();input.setSelectionRange(3,3);
  f.update([{...field}]);assert.equal(f.host.querySelector('textarea'),input);assert.equal(input.selectionStart,3);
  assert.equal(row.open,true);assert.equal(row.dataset.filled,'false');assert.deepEqual(f.review.edits(),{why:'My reviewed answer'});
  f.update([{...field,filled:true,answer:'My reviewed answer'}]);assert.equal(row.dataset.filled,'true');assert.equal(row.open,false);assert.deepEqual(f.review.edits(),{});
  row.open=true;f.edit('why','An explicit correction');assert.equal(row.dataset.filled,'false');
  f.update([{...field,filled:true,answer:'My reviewed answer'}]);assert.equal(input.value,'An explicit correction');assert.equal(row.open,true);
  f.update([{...field,filled:true,answer:'An explicit correction'}]);assert.equal(row.open,false);assert.equal(row.dataset.filled,'true');
});

test('AI replies cannot overwrite a later manual draft, an employer answer, a changed question or another job',t=>{
  const f=fixture(t);const fields=['same','manual','page','changed'].map(key=>({...field,key}));f.update(fields);const targets=f.review.targets(f.review.selected());
  f.edit('manual','I typed this while AI was working');
  f.update([fields[0],fields[1],{...fields[2],filled:true,answer:'Entered on the employer page'},{...fields[3],label:'A replacement question'}]);
  const answers=fields.map(item=>({id:item.key,answer:'AI draft'}));f.review.accept(answers,targets);f.update([fields[0],fields[1],{...fields[2],filled:true,answer:'Entered on the employer page'},{...fields[3],label:'A replacement question'}]);
  assert.deepEqual(f.review.edits(),{same:'AI draft',manual:'I typed this while AI was working'});
  f.review.update(fields,{key:'another-job'});f.review.accept(answers,targets);assert.deepEqual(f.review.edits(),{});
});

test('AI can revise a draft that has not changed since sending; multi-select answers remain one question',t=>{
  const f=fixture(t);const multi={...field,key:'arrangement',label:'Work arrangements',type:'select-multiple',multiple:true,options:[{value:'remote',label:'Remote'},{value:'hybrid',label:'Hybrid'}]};
  f.update([field,multi]);f.edit('why','Earlier draft');const targets=f.review.targets(f.review.selected());
  f.review.accept([{id:'why',answer:'Revised draft'},{id:'arrangement',answer:'["remote","hybrid"]'}],targets);f.update([field,multi]);
  assert.deepEqual(f.review.edits(),{why:'Revised draft',arrangement:'["remote","hybrid"]'});
  assert.equal(f.host.querySelectorAll('details').length,2);assert.equal(f.host.querySelector('select').selectedOptions.length,2);
  f.update([field,{...multi,filled:true,answerValues:['remote','hybrid']}]);assert.equal(f.host.querySelectorAll('details')[1].dataset.filled,'true');
});
