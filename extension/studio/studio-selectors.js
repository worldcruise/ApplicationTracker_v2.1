import { studioStorage } from './storage.js';

// Use the editor's React runtime and its authenticated request channel.
export function createStudioSelectors(React, storage = studioStorage) {
  const h = React.createElement;
  return function StudioSelectors({ candidate, candidates, disabled, request, flush, onCandidateChange, onSaved, onBusyChange }) {
    const id = candidate?.document.candidate.id ?? '';
    const [loaded, setLoaded] = React.useState(null);
    const [error, setError] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [defaultMessage,setDefaultMessage]=React.useState('');
    const [reload, setReload] = React.useState(0);
    const current = React.useRef(null);
    current.current = { id, candidate, flush, onSaved, onBusyChange };
    const pending = React.useRef(false);

    React.useEffect(() => {
      let live = true;
      setLoaded(null);
      setError('');
      if (id) request('PROMPT_SETTINGS', { candidateId: id }).then(result => {
        if (live) setLoaded({ id, library: result.library });
      }).catch(reason => { if (live) setError(reason.message || 'Prompts could not be loaded.'); });
      return () => { live = false; };
    }, [id, candidate?.revision, reload, request]);

    React.useEffect(() => {
      const changed = changes => { if (changes['prompt-templates:v1']) setReload(value => value + 1); };
      storage.onChanged.addListener(changed);
      return () => storage.onChanged.removeListener(changed);
    }, []);

    const library = loaded?.id === id ? loaded.library : null;
    const assigned = candidate?.document.applicationPreferences?.assignedPromptTemplateId;
    const selected = library?.templates.some(template => template.id === assigned) ? assigned : library?.selectedId ?? '';
    async function selectPrompt(templateId) {
      if (disabled || pending.current || !library || templateId === selected) return;
      const before = current.current;
      pending.current = true;
      setSaving(true);
      setError('');
      before.onBusyChange(true);
      try {
        await before.flush();
        if (current.current.id !== before.id) return;
        const result = await request('PROMPT_SELECT', {
          candidateId: before.id, templateId,
          expectedCandidateRevision: before.candidate.revision,
          mutationId: crypto.randomUUID(),
        });
        if (current.current.id === before.id) {
          before.onSaved(result);
          setLoaded({ id: before.id, library: result.library });
        }
      } catch (reason) {
        if (current.current.id === before.id) setError(reason.message || 'Prompt could not be saved. Your previous selection is retained.');
      } finally {
        pending.current = false;
        setSaving(false);
        before.onBusyChange(false);
      }
    }

    async function selectWebsite(key,checked){
      if(disabled||pending.current||!candidate)return;
      const before=current.current;pending.current=true;setSaving(true);setError('');before.onBusyChange(true);
      try{
        await before.flush();if(current.current.id!==before.id)return;
        const document=structuredClone(before.candidate.document);
        document.applicationPreferences={...document.applicationPreferences,resumeWebsiteVisibility:{...document.applicationPreferences?.resumeWebsiteVisibility,[key]:checked}};
        const result=await request('CANDIDATE_SAVE',{candidateId:before.id,expectedRevision:before.candidate.revision,document,mutationId:crypto.randomUUID()});
        if(current.current.id===before.id)before.onSaved(result);
      }catch(reason){setError(reason.message||'Resume website settings could not be saved.');}
      finally{pending.current=false;setSaving(false);before.onBusyChange(false);}
    }

    async function setStyleDefault(){
      if(disabled||pending.current||!candidate)return;
      const before=current.current;pending.current=true;setSaving(true);setError('');setDefaultMessage('');before.onBusyChange(true);
      try{
        await before.flush();if(current.current.id!==before.id)return;
        const saved=await request('STUDIO_BOOTSTRAP',{candidateId:before.id}),draft=saved.record?.draft;
        if(!draft||draft.candidateId!==before.id)throw Error('Reload Resume Studio before saving its default style.');
        const document=structuredClone(before.candidate.document);
        document.applicationPreferences={...document.applicationPreferences,preferredDocumentTemplateId:draft.documentTemplate.id,defaultDocumentStyle:{documentTemplate:structuredClone(draft.documentTemplate),formattingOverrides:structuredClone(draft.formattingOverrides)}};
        const result=await request('CANDIDATE_SAVE',{candidateId:before.id,expectedRevision:before.candidate.revision,document,mutationId:crypto.randomUUID()});
        if(current.current.id===before.id){before.onSaved(result);setDefaultMessage('Default document style saved.');}
      }catch(reason){setError(reason.message||'The default style could not be saved.');}
      finally{pending.current=false;setSaving(false);before.onBusyChange(false);}
    }

    return h('div', { className: 'studio-selector-bar', 'aria-busy': saving },
      h('div', { className: 'studio-selector-row' },
        h('div', { className:'studio-active-profile' },h('span',null,'Profile'),h('strong',null,candidate?.document.candidate.name||'Create your profile in Settings')),
        h('label', { htmlFor: 'studio-prompt' }, 'Prompt',
          h('select', { id: 'studio-prompt', value: selected, disabled: disabled || saving || !library,
            'aria-describedby': error ? 'studio-selector-error' : undefined,
            onChange: event => { void selectPrompt(event.target.value); } },
          !library && h('option', { value: '' }, error ? 'Unavailable' : id ? 'Loading…' : 'Select candidate'),
          library?.templates.map(template => h('option', { key: template.id, value: template.id }, template.title))))),
      candidate&&h('fieldset',{className:'studio-website-options',disabled:disabled||saving},
        h('legend',null,'Websites on resume'),
        ...[['linkedin','LinkedIn'],['github','GitHub'],['website','Other website']].map(([key,label])=>h('label',{key},h('input',{type:'checkbox',checked:candidate.document.applicationPreferences?.resumeWebsiteVisibility?.[key]!==false,onChange:event=>{void selectWebsite(key,event.target.checked);}}),label))),
      candidate&&h('div',{className:'studio-default-style'},h('button',{id:'studio-set-default',type:'button',className:'button',disabled:disabled||saving,onClick:()=>{void setStyleDefault();}},'Set as default'),defaultMessage&&h('span',{role:'status'},defaultMessage)),
      error && h('div', { id: 'studio-selector-error', className: 'studio-selector-error', role: 'alert' },
        error, ' ', h('button', { type: 'button', disabled: saving, onClick: () => setReload(value => value + 1) }, 'Reload prompts')));
  };
}
