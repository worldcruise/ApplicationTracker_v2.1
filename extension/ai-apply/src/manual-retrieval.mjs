import {manualRetrievalContext,validateManualRetrieval} from './manual-documents.mjs';
import {GENERATION_MODULES} from './generation-selection.mjs';

export function createManualRetrieval({getRequest,saveResult,openDialog,onSaved}){
  const q=selector=>document.querySelector(selector),dialog=q('#manual-retrieval-dialog'),input=q('#manual-retrieval-json'),save=q('#manual-retrieval-save'),status=q('#manual-retrieval-status');
  let request,generated,context,busy=false,epoch=0;
  function validate(){
    save.disabled=true;if(!request||busy)return;
    if(!input.value.trim()){status.textContent='Paste the complete JSON reply to review and edit it.';status.dataset.state='';return;}
    try{validateManualRetrieval(input.value,context);status.textContent='JSON is valid and ready to save.';status.dataset.state='valid';save.disabled=false;}
    catch(error){status.textContent=error.message;status.dataset.state='invalid';}
  }
  input.addEventListener('input',validate);
  q('#manual-retrieval-import').addEventListener('click',()=>q('#manual-retrieval-file').click());
  q('#manual-retrieval-file').addEventListener('change',async event=>{
    const file=event.target.files?.[0],ticket=epoch,previous=input.value;event.target.value='';if(!file||busy)return;
    try{if(file.size>500000)throw Error('Use a JSON file under 500 KB.');const text=await file.text();if(ticket!==epoch||!dialog.open||input.value!==previous)return;input.value=text;validate();}
    catch(error){if(ticket===epoch){status.textContent=error.message;status.dataset.state='invalid';}}
  });
  dialog.addEventListener('close',()=>{epoch++;request=null;});
  dialog.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
  q('#manual-retrieval-form').addEventListener('submit',async event=>{
    event.preventDefault();validate();if(!request||busy||save.disabled)return;
    const current=request,ticket=epoch;busy=true;for(const control of dialog.querySelectorAll('button,input,textarea'))control.disabled=true;
    let failure;
    try{await saveResult(current.id,{json:input.value,runId:generated?.id,selectedModules:[...context.settings.selectedModules],expectedUpdatedAt:current.updatedAt,expectedRevision:current.canonicalRevision});if(ticket===epoch){dialog.close();onSaved(current.id);}}
    catch(error){failure=error.message;}
    finally{busy=false;for(const control of dialog.querySelectorAll('button,input,textarea'))control.disabled=false;validate();if(failure&&ticket===epoch){status.textContent=failure;status.dataset.state='invalid';}}
  });
  return {open(id,{run=null,selectedModules}={}){
    if(busy)return;const current=getRequest(id);if(!current)return;
    request=structuredClone(current);generated=run?structuredClone(run):null;context=manualRetrievalContext(request,generated,selectedModules);epoch++;
    q('#manual-retrieval-context').textContent=request.input.job.company+' · '+request.input.job.role;
    q('#manual-retrieval-sections').textContent='Sections: '+GENERATION_MODULES.filter(([key])=>context.settings.selectedModules.includes(key)).map(([,label])=>label).join(' + ');
    input.value=generated?.raw||(generated?.result?.document?JSON.stringify(generated.result.document,null,2):'');
    validate();openDialog('manual-retrieval-dialog');input.focus();
  }};
}
