import type {ReactNode} from 'react';
import type {PromptTemplate} from './prompt-templates';
import {DEFAULT_PROMPT} from './prompt-templates';
import {RESUME_JSON_TEMPLATE} from '../../extension/studio/resume-json-prompt.js';
import type {useCandidateEditor} from './candidate-editor';
import {editableTemplate,templateIssue} from './prompt-composer';
import {resumePromptIssue} from './resume-prompt-profile';
import {PromptEditorForm} from './prompt-editor-form';
import type {StatusEntry} from './status-bar';

type Props={editor:ReturnType<typeof useCandidateEditor>;selected:PromptTemplate;editing:PromptTemplate|null;busy:boolean;toolbar:ReactNode;onEdit:(patch:Partial<PromptTemplate>)=>void;onSave:()=>void;onCancel:()=>void;onFeedback:(entry:StatusEntry|null)=>void};
export function ResumePrompt({editor,selected,editing,busy,toolbar,onEdit,onSave,onCancel}:Props){
 const raw=editing?.text??editableTemplate(selected.text),displayed=editing??selected;
 const issue=templateIssue(raw)||(editor.document?resumePromptIssue(editor.document)?.message:null);
 return <PromptEditorForm id="resume" title="Resume" value={raw} candidate={editor.document} disabled={busy} dirty={!!editing} issue={issue} onChange={text=>onEdit({text})} onSave={onSave} onCancel={onCancel} onReset={()=>onEdit({text:selected.id===RESUME_JSON_TEMPLATE.id?RESUME_JSON_TEMPLATE.text:DEFAULT_PROMPT.text})} tools={<>{toolbar}<label>Template name<input aria-label="Template name" value={displayed.title} disabled={busy} maxLength={80} onChange={event=>onEdit({title:event.target.value})} /></label></>} />;
}
