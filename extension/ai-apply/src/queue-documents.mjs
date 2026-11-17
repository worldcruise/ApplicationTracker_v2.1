import {parseManualResume} from './manual-documents.mjs';

export function createQueueDocuments({ queue, getRequest, openDialog, onSaved }) {
  const q = selector => document.querySelector(selector), dialog = q('#documents-dialog');
  const input=q('#documents-resume'),letter=q('#documents-cover-letter'),enabled=q('#documents-cover-enabled');
  const status = q('#documents-status'), save = q('#documents-save');
  let current, epoch = 0, busy = false;
  function validate() {
    save.disabled = true;letter.disabled=!enabled.checked||busy;
    if (!current || busy) return;
    if(!input.value.trim()&&!enabled.checked){status.textContent='Paste resume JSON to update this job.';status.dataset.state='';return;}
    try {
      if(input.value.trim())parseManualResume(input.value,current);
      if(enabled.checked&&!letter.value.trim())throw Error('Add a cover letter or turn its switch off.');
      if(letter.value.length>50000)throw Error('Keep the cover letter under 50,000 characters.');
      status.textContent='Documents are ready to save.';
      status.dataset.state = 'valid'; save.disabled = false;
    } catch (error) { status.textContent = error.message; status.dataset.state = 'invalid'; }
  }
  for(const node of [input,letter,enabled])node.addEventListener('input',validate);
  q('#documents-import').addEventListener('click', () => q('#documents-file').click());
  q('#documents-file').addEventListener('change', async event => {
    const file = event.target.files?.[0], ticket = epoch;
    event.target.value = '';
    if (!file || busy) return;
    const previous = input.value;
    try {
      if (file.size > 500000) throw new Error('Use a JSON file under 500 KB.');
      const text = await file.text();
      if (ticket !== epoch || !dialog.open || previous !== input.value) return;
      input.value = text; validate();
    } catch (error) { if (ticket === epoch) { status.textContent = error.message; status.dataset.state = 'invalid'; } }
  });
  dialog.addEventListener('close', () => { epoch++; current = null; });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  q('#documents-form').addEventListener('submit', async event => {
    event.preventDefault(); validate();
    if (!current || busy || save.disabled) return;
    const request = current, ticket = epoch;
    let failure;
    busy = true;
    for (const control of dialog.querySelectorAll('button,input,textarea')) control.disabled = true;
    try {
      await queue.saveDocuments(request.id, {resume:input.value,coverLetter:letter.value,coverLetterEnabled:enabled.checked,expectedUpdatedAt:request.updatedAt,expectedRevision:request.canonicalRevision});
      if (ticket === epoch) { dialog.close(); onSaved(request.id); }
    } catch (error) {
      failure=error.message;
    } finally {
      busy = false;
      for (const control of dialog.querySelectorAll('button,input,textarea')) control.disabled = false;
      validate();
      if(failure&&ticket===epoch){status.textContent=failure;status.dataset.state='invalid';}
    }
  });
  return { open(id) {
    if (busy) return;
    const request = getRequest(id);
    if (!request) return;
    current = structuredClone(request); epoch++;
    q('#documents-context').textContent = `${request.input.job.company || 'Base resume'} · ${request.input.profile.name}`;
    input.value=request.resume?JSON.stringify(request.resume,null,2):'';
    letter.value=request.coverLetter||'';enabled.checked=request.coverLetterEnabled===true;
    validate(); openDialog('documents-dialog');
    input.focus();
  } };
}
