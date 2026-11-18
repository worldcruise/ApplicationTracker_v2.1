import {icon} from './icons.mjs';

export const formAnswer=field=>field.multiple?field.answerValues?.length?JSON.stringify(field.answerValues):field.answer||'':String(field.answer??'');
const consent=field=>/consent|agree|certify|acknowledge|privacy|terms|signature/i.test(field.label||'');
export const canDraftField=field=>field.type!=='file'&&field.type!=='checkbox'&&!consent(field);

export function createAutofillFormReview(host,{onChange=()=>{}}={}){
  const doc=host.ownerDocument,make=(tag,cls,text)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
  const rows=new Map(),drafts=new Map(),selection=new Map();let context='',fields=[],disabled=false;
  const scope=field=>JSON.stringify([context,field.key,field.label,field.type,!!field.multiple]);
  function included(field){const id=scope(field);if(!selection.has(id))selection.set(id,!!field.required);return canDraftField(field)&&!field.filled&&selection.get(id);}
  function draftFor(field){return drafts.get(scope(field));}
  function setEditor(input,value){if(!input.multiple){if(input.value!==value)input.value=value;return;}let values;try{values=JSON.parse(value||'[]');}catch{values=[value];}for(const option of input.options)option.selected=Array.isArray(values)&&values.includes(option.value);}
  function updateStatus(row,field){
    const draft=draftFor(field),filled=!!field.filled&&!draft;
    if(filled&&!row.filled)row.details.open=false;
    row.filled=filled;row.details.dataset.filled=String(filled);row.status.dataset.filled=String(filled);
    row.status.title=filled?'Filled on the employer page':draft?'Draft ready to fill':'Needs an answer';row.status.setAttribute('aria-label',row.status.title);
    row.pick.checked=included(field);row.pick.disabled=disabled||field.filled||!canDraftField(field);
  }
  function updateEditor(row,field){
    const options=field.type==='checkbox'?[{value:'Yes',label:'Yes'},{value:'No',label:'No'}]:field.options||[],signature=JSON.stringify([field.type,!!field.multiple,options]);
    if(!row.editor||row.editorSignature!==signature&&doc.activeElement!==row.editor){
      const input=make(options.length?'select':'textarea','tracker-answer-editor');
      input.setAttribute('aria-label',field.label||'Application answer');input.dataset.answerKey=field.key;
      if(options.length){input.multiple=!!field.multiple;if(input.multiple)input.size=Math.min(5,Math.max(2,options.length));else{const blank=make('option',null,'Choose an answer');blank.value='';input.append(blank);}for(const option of options){const el=make('option',null,option.label);el.value=option.value;el.disabled=!!option.disabled;input.append(el);}}
      else{input.rows=field.kind==='ai'?3:2;input.placeholder=field.type==='file'?'':'Enter your answer';}
      input.addEventListener('input',edit);input.addEventListener('change',edit);function edit(){const current=row.field;if(!current||current.type==='file')return;const id=scope(current),value=input.multiple?JSON.stringify([...input.selectedOptions].map(option=>option.value)):input.value;
        if(value.trim()&&value!==formAnswer(current))drafts.set(id,{value,baseline:formAnswer(current),source:'manual'});else drafts.delete(id);
        updateStatus(row,current);onChange();
      }
      row.body.replaceChildren(input);row.editor=input;row.editorSignature=signature;
    }
    row.editor.disabled=disabled;if(field.type==='file'){row.editor.readOnly=true;row.editor.removeAttribute('placeholder');}
    setEditor(row.editor,draftFor(field)?.value??formAnswer(field));
  }
  return {
    update(nextFields,{key=context,busy=false}={}){
      if(key!==context){context=key;rows.clear();host.replaceChildren();}
      fields=nextFields||[];disabled=busy;const present=new Set();let index=0;
      for(const field of fields){const id=scope(field);present.add(id);const draft=drafts.get(id);if(draft&&field.filled&&formAnswer(field)===draft.value)drafts.delete(id);
        let row=rows.get(id);
        if(!row){const details=make('details','tracker-form-row'),summary=make('summary'),number=make('span','tracker-question-number'),order=make('span','tracker-question-index'),pick=make('input','tracker-question-pick'),caption=make('span','tracker-question-caption'),status=make('span','tracker-question-check'),body=make('div','tracker-question-answer');
          pick.type='checkbox';pick.setAttribute('aria-label',`Include ${field.label||'question'} in AI drafting`);pick.title='Include in AI drafting';pick.addEventListener('click',event=>event.stopPropagation());pick.addEventListener('change',()=>{selection.set(id,pick.checked);onChange();});
          number.append(order,pick);status.append(icon('check'));summary.append(number,caption,status);details.append(summary,body);row={details,order,pick,caption,status,body,filled:false};rows.set(id,row);
        }
        row.field=field;row.order.textContent=String(++index);row.caption.textContent=(field.label||'Application question')+(field.required&&!/\*\s*$/.test(field.label||'')?' *':'');row.caption.title=row.caption.textContent;
        updateStatus(row,field);updateEditor(row,field);if(host.children[index-1]!==row.details)host.insertBefore(row.details,host.children[index-1]||null);
      }
      for(const [id,row]of rows)if(!present.has(id)){row.details.remove();rows.delete(id);}
    },
    selected(){return fields.filter(field=>included(field)).map(field=>({...field,answer:draftFor(field)?.value??formAnswer(field)}));},
    edits(){return Object.fromEntries(fields.filter(field=>draftFor(field)).map(field=>[field.key,draftFor(field).value]));},
    targets(selected){return selected.map(selectedField=>{const field=fields.find(item=>item.key===selectedField.key);return {id:field.key,scope:scope(field),answer:formAnswer(field),draft:draftFor(field)?.value??null};});},
    accept(answers,targets){for(const answer of answers||[]){const target=targets.find(item=>item.id===answer.id),field=fields.find(item=>item.key===answer.id);if(!target||!field||field.filled||scope(field)!==target.scope||formAnswer(field)!==target.answer||answer.needsUser||!answer.answer)continue;
        if((draftFor(field)?.value??null)!==target.draft)continue;drafts.set(target.scope,{value:answer.answer,baseline:formAnswer(field),source:'ai'});
      }},
    clear(){rows.clear();drafts.clear();selection.clear();fields=[];host.replaceChildren();}
  };
}
