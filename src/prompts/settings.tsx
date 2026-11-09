// Prompt workflow adapted from ApplicationTracker_v2/apps/extension/src/settings.tsx.
import { useEffect, useRef, useState } from 'react';
import { candidateRequest } from './candidate-client';
import { object } from './candidate-contract';
import { DEFAULT_PROMPT, PROMPT_LIBRARY_KEY, validatePrompt } from './prompt-templates';
import { editableTemplate, templateIssue } from './prompt-composer';
import { ResumePrompt } from './resume-prompt';
import { StatusBar } from './status-bar';
import { useCandidateEditor } from './candidate-editor';
import { candidateFields } from './candidate-fields';
import { studioStorage } from '../../extension/studio/storage.js';

export function PromptSettings() {
  const [state, setState] = useState(null), [editing, setEditing] = useState(null);
  const [editRevision, setEditRevision] = useState(0), [busy, setBusy] = useState(false), [message, setMessage] = useState(null);
  const [promptView, setPromptView] = useState('resume'), [resumeFeedback, setResumeFeedback] = useState(null);
  const [selectionScope, setSelectionScope] = useState('profile');
  const saving = useRef(false), epoch = useRef(0), alive = useRef(true);
  const editor = useCandidateEditor(state?.candidate ?? null);
  useEffect(() => { if (state && !state.candidate) setSelectionScope('default'); }, [state?.candidate?.document.candidate.id]);
  const fail = error => { if (alive.current) setMessage({ key: 'settings', token: crypto.randomUUID(), level: 'error', sticky: true,
    message: error instanceof Error ? error.message : 'Prompt settings could not be saved. Your edits are retained.' }); };
  async function refresh() {
    const sequence = ++epoch.current;
    const next = await candidateRequest('PROMPT_SETTINGS', {});
    if (alive.current && sequence === epoch.current) setState(next);
    return next;
  }
  useEffect(() => {
    alive.current = true; refresh().catch(fail);
    const changed = (changes, area) => {
      if (area === 'local' && Object.keys(changes).some(key => key === PROMPT_LIBRARY_KEY || key === 'active-candidate:v1' || key.startsWith('autofill-profile:'))) refresh().catch(fail);
    };
    studioStorage.onChanged.addListener(changed);
    return () => { alive.current = false; epoch.current++; studioStorage.onChanged.removeListener(changed); };
  }, []);
  const assigned = object(state?.candidate?.document.applicationPreferences).assignedPromptTemplateId;
  const selectedId = selectionScope === 'profile' && typeof assigned === 'string' && assigned ? assigned : state?.library.selectedId;
  const unavailable = Boolean(state && !state.library.templates.some(item => item.id === selectedId));
  const selected = state?.library.templates.find(item => item.id === selectedId) ?? state?.library.templates.find(item => item.id === state.library.selectedId) ?? DEFAULT_PROMPT;
  function edit(patch) {
    if (!state || saving.current) return;
    if (!editing) setEditRevision(state.library.revision);
    setEditing(previous => ({ ...(previous ?? { ...selected, text: editableTemplate(selected.text) }), ...patch })); setMessage(null);
  }
  async function select(templateId) {
    if (!state || saving.current) return;
    saving.current = true; setBusy(true); setMessage(null);
    try {
      const expectedRevision = editor.base?.revision;
      const result = await candidateRequest('PROMPT_SELECT', { templateId,
        candidateId: selectionScope === 'profile' ? state.candidate?.document.candidate.id ?? null : null,
        expectedCandidateRevision: expectedRevision, expectedLibraryRevision: state.library.revision, mutationId: crypto.randomUUID() });
      if (result.candidate && expectedRevision !== undefined) editor.adoptPromptSelection(result.candidate, expectedRevision);
      await refresh(); if (alive.current) setMessage({ key: 'settings', token: crypto.randomUUID(), level: 'success', message: 'Prompt selection saved.' });
    } catch (error) { fail(error); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  async function save() {
    if (!state || !editing || saving.current) return;
    try { validatePrompt(editing); const issue = templateIssue(editing.text); if (issue) throw Error(issue); } catch (error) { fail(error); return; }
    saving.current = true; setBusy(true); setMessage(null);
    try {
      await candidateRequest('PROMPT_SAVE', { template: editing, expectedRevision: editRevision });
      await refresh(); if (alive.current) { setEditing(null); setMessage({ key: 'settings', token: crypto.randomUUID(), level: 'success', message: 'Template saved. Choose it below to use it.' }); }
    } catch (error) { fail(error); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  }
  const messages = message ? [{ ...message, actions: message.level === 'error' ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => {
    refresh().then(next => { if (alive.current) { setEditRevision(next.library.revision); setMessage(null); } }).catch(fail);
  }}>Reload saved prompts</button> : undefined }] : !state ? [{ key: 'loading', token: 'loading', level: 'info', message: 'Loading prompt settings…' }]
    : unavailable ? [{ key: 'unavailable', token: String(selectedId), level: 'warning', message: 'The assigned template is unavailable. Choose a saved prompt.' }] : [];
  const application = editor.document ? candidateFields({ ...editor, document: editor.document }) : null;
  return <section className="prompt-settings" aria-labelledby="prompt-settings-title">
    <header className="settings-pane-heading"><div><span className="web-eyebrow">Writing preferences</span><h2 id="prompt-settings-title">Prompt settings</h2><p>Choose how Resume Studio uses your profile and job descriptions.</p></div>
      {state?.candidate && <span className="web-profile-badge">{state.candidate.document.candidate.name}</span>}</header>
    <div className="prompt-views" role="group" aria-label="Prompt types">{[['resume', 'Resume Prompt Template'], ['application', 'Application Prompts']].map(([id, label]) => <button type="button" key={id} className="button button-secondary" aria-pressed={promptView === id} onClick={() => setPromptView(id)}>{label}</button>)}</div>
    <StatusBar messages={[...editor.messages, ...messages, ...(resumeFeedback ? [resumeFeedback] : [])]} />
    <div hidden={promptView !== 'resume'}><ResumePrompt editor={editor} selected={selected} editing={editing} busy={busy} onEdit={edit} onSave={() => void save()} onCancel={() => { setEditing(null); setMessage(null); }} onFeedback={setResumeFeedback}
      toolbar={<div className="prompt-picker-row"><label>Apply selection to<select value={selectionScope} disabled={busy || Boolean(editing)} onChange={event => setSelectionScope(event.target.value)}>
        <option value="profile" disabled={!state?.candidate}>This profile</option><option value="default">Default for all profiles</option></select></label>
        <label>Saved template<select value={unavailable ? selectedId : selected.id} disabled={!state || busy || Boolean(editing)} onChange={event => void select(event.target.value)}>
          {unavailable && <option value={selectedId} disabled>Unavailable template</option>}{(state?.library.templates ?? [DEFAULT_PROMPT]).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
        </select></label><button type="button" className="button button-secondary" disabled={!state || busy || Boolean(editing)} onClick={() => { setEditing({ id: crypto.randomUUID(), title: 'New prompt', text: editableTemplate(selected.text) }); setEditRevision(state.library.revision); setMessage(null); }}>New prompt</button></div>} />
    </div>
    <div hidden={promptView !== 'application'}>{application ? <><div className="settings-pane-heading"><div><h3>Application instructions</h3><p>Keep reusable instructions and answers with this profile.</p></div><button type="button" className="button button-primary" disabled={editor.busy || busy} onClick={() => void editor.save()}>Save Prompts</button></div>
      <fieldset disabled={editor.busy}>{application.collection('Prompt instructions', ['customPromptInstructions'], [{ key: 'title', label: 'Name' }, { key: 'text', label: 'Instructions', kind: 'multiline' }], { add: 'Add Prompt' })}
      <section className="setup-group"><h3>Reusable answers</h3>{application.collection('Reusable answers', ['customAnswers'], [{ key: 'question', label: 'Question', kind: 'multiline' }, { key: 'answer', label: 'Answer', kind: 'multiline' }], { add: 'Add Answer' })}</section></fieldset>
    </> : <p>Create a profile in Settings to edit application prompts and reusable answers.</p>}</div>
  </section>;
}
