import { exclusiveDetails } from "./exclusive-details";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { PromptTemplate } from "./prompt-templates";
import type { useCandidateEditor } from "./candidate-editor";
import { buildPrompt } from "./prompt-builder";
import { editableTemplate, PROMPT_TOKENS, templateIssue } from "./prompt-composer";
import { RESUME_PROMPT_PATH, SHORT_DETAIL_PLACEHOLDER, resumePromptIssue, resumePromptPath, resumePromptProfile } from "./resume-prompt-profile";
import { statusMessageId, type StatusEntry } from "./status-bar";
import "./resume-prompt.css";

type Props = { editor: ReturnType<typeof useCandidateEditor>; selected: PromptTemplate; editing: PromptTemplate | null; busy: boolean; toolbar: ReactNode;
  onEdit: (patch: Partial<PromptTemplate>) => void; onSave: () => void; onCancel: () => void; onFeedback: (entry: StatusEntry | null) => void };
const displayNumber = (value: unknown) => typeof value === "number" || typeof value === "string" ? String(value) : "";
const parseNumber = (value: string, integer: boolean) => !value.trim() ? null : (integer ? /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) && Number(value) >= 1 : /^\d+(?:\.\d+)?$/.test(value) && Number.isFinite(Number(value)) && Number(value) >= 0) ? Number(value) : value;
export function ResumePrompt({ editor, selected, editing, busy, toolbar, onEdit, onSave, onCancel, onFeedback }: Props) {
  const [pane, setPane] = useState(1), [sampleJob, setSampleJob] = useState("");
  const tabs = useRef<Array<HTMLButtonElement | null>>([]), templateInput = useRef<HTMLTextAreaElement>(null), output = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (editing) setPane(0); }, [editing?.id]);
  const raw = editing?.text ?? editableTemplate(selected.text), displayed = editing ?? selected;
  const syntax = templateIssue(raw), candidateIssue = editor.document ? resumePromptIssue(editor.document) : null;
  const error = syntax ?? candidateIssue?.message ?? null;
  const description = candidateIssue && editor.error?.fieldPath === candidateIssue.path ? statusMessageId("candidate-editor") : statusMessageId("resume-prompt-validation");
  const profile = editor.document ? resumePromptProfile(editor.document) : null;
  const preview = !error && editor.document ? buildPrompt(editor.document, sampleJob, { ...displayed, text: raw }).text : "";
  const copyAttempt = useRef(0), latest = useRef({ preview, raw, candidateId: editor.document?.candidate.id, revision: editor.base?.revision });
  latest.current = { preview, raw, candidateId: editor.document?.candidate.id, revision: editor.base?.revision };
  useEffect(() => () => { copyAttempt.current++; }, []);
  useEffect(() => {
    onFeedback(error && !(candidateIssue && editor.error?.fieldPath === candidateIssue.path) ? { key: "resume-prompt-validation", token: `${editor.document?.candidate.id}:${candidateIssue?.path ?? "template"}:${error}`, context: editor.document?.candidate.id ?? "resume-template", level: "error", sticky: true, message: error } : null);
  }, [error, candidateIssue?.path, editor.error?.fieldPath, editor.document?.candidate.id, onFeedback]);
  function change(path: string[], value: string | number | null) { editor.change([...RESUME_PROMPT_PATH, ...path], value); }
  function field(label: string, value: string, path: string[], options: { multiline?: boolean; numeric?: "years" | "minimum"; placeholder?: string; wide?: boolean } = {}) {
    const invalid = candidateIssue?.path === resumePromptPath(...path);
    const props = { "aria-label": label, "aria-invalid": invalid, "aria-describedby": invalid ? description : undefined, value,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(path, options.numeric ? parseNumber(event.target.value, options.numeric === "minimum") : event.target.value) };
    return <label className={options.wide ? "rp-full" : undefined}>{label}{options.multiline ? <textarea {...props} rows={3} placeholder={options.placeholder} /> : <input {...props} inputMode={options.numeric ? "decimal" : "text"} />}</label>;
  }
  function token(value: string) {
    const element = templateInput.current; if (!element) return;
    const start = element.value.indexOf(value); element.focus();
    if (start >= 0) element.setSelectionRange(start, start + value.length);
    else { element.setRangeText(value, element.selectionStart, element.selectionEnd, "end"); onEdit({ text: element.value }); }
  }
  async function copy() {
    if (!preview) return;
    const attempt = ++copyAttempt.current, frozen = latest.current;
    const current = () => attempt === copyAttempt.current && Object.entries(frozen).every(([key, value]) => latest.current[key as keyof typeof frozen] === value);
    try { await navigator.clipboard.writeText(preview); if (current()) onFeedback({ key: "resume-preview-copy", token: crypto.randomUUID(), level: "success", message: "Preview copied." }); }
    catch { if (!current()) return; output.current?.focus(); output.current?.select(); onFeedback({ key: "resume-preview-copy", token: crypto.randomUUID(), level: "warning", message: "Preview selected. Press Ctrl+C or Command+C to copy." }); }
  }
  return <div className="resume-prompt"><div className="resume-prompt-grid">
    <section className="resume-prompt-left" aria-label="Prompt editor">{toolbar}
      <div className="rp-tabs" role="tablist" aria-label="Editor views">{["Template", "Candidate Form"].map((label, index) => <button key={label} type="button" role="tab" id={`rp-tab-${index}`} aria-controls={`rp-pane-${index}`} aria-selected={pane === index} tabIndex={pane === index ? 0 : -1} ref={element => { tabs.current[index] = element; }} className="button button-secondary" onClick={() => setPane(index)} onKeyDown={event => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return; event.preventDefault(); const next = event.key === "Home" ? 0 : event.key === "End" ? 1 : 1 - index; setPane(next); tabs.current[next]?.focus();
      }}>{label}</button>)}</div>
      <div id="rp-pane-0" role="tabpanel" aria-labelledby="rp-tab-0" hidden={pane !== 0}>
        <label>Name<input aria-label="Name" value={displayed.title} disabled={busy} maxLength={80} onChange={event => onEdit({ title: event.target.value })} /></label>
        <label>Template<textarea ref={templateInput} aria-label="Template" rows={17} spellCheck={false} value={raw} disabled={busy} aria-invalid={Boolean(syntax)} aria-describedby={syntax ? statusMessageId("resume-prompt-validation") : undefined} onChange={event => onEdit({ text: event.target.value })} /></label>
        <div className="rp-row" role="group" aria-label="Insert or find a placeholder">{Object.values(PROMPT_TOKENS).map(value => <button key={value} className="button button-secondary" type="button" disabled={busy} onClick={() => token(value)}><code>{value}</code></button>)}</div>
        <div className="rp-row">{editing && <button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button>}<button type="button" className="button button-primary" disabled={!editing || busy || Boolean(syntax)} onClick={onSave}>Save Template</button></div>
      </div>
      <div id="rp-pane-1" role="tabpanel" aria-labelledby="rp-tab-1" hidden={pane !== 1}>{profile ? <form className="resume-candidate-form" aria-label="Resume candidate form" noValidate onSubmit={event => { event.preventDefault(); void editor.save(); }}><fieldset disabled={editor.busy}>
        <div className="rp-fields">{field("Seniority", profile.seniority, ["seniority"])}{field("Years of experience", displayNumber(profile.yearsOfExperience), ["yearsOfExperience"], { numeric: "years" })}{field("Short Bio", profile.shortBio, ["shortBio"], { multiline: true, wide: true })}</div>
        <section className="rp-group" aria-label="Education"><h3>Education</h3>{profile.education.length ? profile.education.map((entry, index) => <div className="rp-fields rp-education" key={entry.id}>
          {field(`Education ${index + 1}`, entry.description, ["education", entry.id, "description"], { multiline: true, wide: true })}{field(`Education Dates ${index + 1}`, entry.dates, ["education", entry.id, "dates"], { wide: true })}
        </div>) : <p className="rp-note">No education records in this candidate.</p>}</section>
        <section className="rp-group" aria-label="Work history"><h3>Work history</h3>{profile.roles.length ? profile.roles.map((role, index) => <details onClick={exclusiveDetails} className="rp-role" key={role.id} open={index === 0}><summary>{role.company || role.title || "Unnamed role"}</summary><div className="rp-fields">
          {field(`Role ${index + 1}: Company`, role.company, ["roles", role.id, "company"])}{field(`Role ${index + 1}: Job title`, role.title, ["roles", role.id, "title"])}
          {field(`Role ${index + 1}: Dates`, role.dates, ["roles", role.id, "dates"])}{field(`Role ${index + 1}: Minimum Bullets`, displayNumber(role.minimumBullets), ["roles", role.id, "minimumBullets"], { numeric: "minimum" })}
          {field(`Role ${index + 1}: Short Detail`, role.shortDetail, ["roles", role.id, "shortDetail"], { multiline: true, wide: true, placeholder: SHORT_DETAIL_PLACEHOLDER })}
        </div></details>) : <p className="rp-note">No work records in this candidate.</p>}</section>
        <div className="rp-row"><button type="submit" className="button button-primary" disabled={editor.busy || Boolean(candidateIssue)}>Save Candidate Form</button></div>
      </fieldset></form> : <p className="rp-note">Load a saved candidate JSON to edit this form.</p>}</div>
    </section>
    <section className="resume-live-preview prompt-preview" aria-label="Live preview"><label htmlFor="resume-live-output">Live Preview</label><textarea ref={output} id="resume-live-output" aria-label="Live Preview" value={preview} readOnly spellCheck={false} placeholder={error ? "Fix the highlighted fields to update the preview." : "Load a saved candidate to preview the prompt."} />
      <label htmlFor="resume-sample-jd">Sample job description</label><textarea id="resume-sample-jd" aria-label="Sample job description" rows={3} value={sampleJob} onChange={event => setSampleJob(event.target.value)} />
      <div className="rp-row"><button type="button" className="button button-primary" disabled={!preview || Boolean(error)} onClick={() => void copy()}>Copy Preview</button></div>
    </section>
  </div></div>;
}
