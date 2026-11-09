import { useEffect, useRef, useState } from "react";
import { CandidateError, sameJson, validateCandidate, type CandidateDocument, type JsonValue, type StoredCandidate } from "./candidate-contract";
import { candidateRequest, type CandidateResult } from "./candidate-client";
import { editedField, type Path } from "./candidate-fields";
import type { StatusEntry } from "./status-bar";
export { editedField } from "./candidate-fields";

// One copy serves every setup step and the candidate's Application Prompts.
// Storage notifications never silently rebase dirty edits.
export function useCandidateEditor(candidate: StoredCandidate | null) {
  const [base, setBase] = useState(candidate), [document, setDocument] = useState<CandidateDocument | null>(() => candidate ? structuredClone(candidate.document) : null);
  const [error, setError] = useState<CandidateError | null>(null), [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<StatusEntry | null>(null);
  const dirty = useRef(false), saving = useRef(false);
  const attempt = useRef(0);
  const operation = useRef<{ mutationId: string } | null>(null);
  function accept(next: StoredCandidate) { setBase(next); setDocument(structuredClone(next.document)); dirty.current = false; operation.current = null; setError(null); }
  useEffect(() => { if (candidate && !dirty.current && !saving.current) accept(candidate); }, [candidate?.document.candidate.id, candidate?.revision]);
  function change(path: Path, value: JsonValue | undefined) {
    dirty.current = true; operation.current = null; setSaved(null);
    setDocument(previous => {
      if (!previous) return previous;
      const next = editedField(previous, path, value);
      return path.at(-1) === "current" && value === true ? editedField(next, [...path.slice(0, -1), "endDate"], null) : next;
    });
  }
  useEffect(() => { if (document && error?.fieldPath) { try { validateCandidate(document); setError(null); } catch { /* Keep the validation issue until resolved. */ } } }, [document]);
  async function save(): Promise<CandidateResult | null> {
    if (!base || !document || saving.current) return null;
    attempt.current++;
    saving.current = true; setBusy(true); setSaved(null); setError(null);
    try {
      validateCandidate(document);
      operation.current ??= { mutationId: crypto.randomUUID() };
      const result = await candidateRequest("CANDIDATE_SAVE", { candidateId: base.document.candidate.id, expectedRevision: base.revision, document, ...operation.current });
      if (result.candidate) accept(result.candidate);
      setSaved({ key: "candidate-save", token: crypto.randomUUID(), level: "success", message: "Saved in browser." });
      return result;
    } catch (caught) { setError(caught instanceof CandidateError ? caught : new CandidateError("SAVE_FAILED", "The candidate could not be saved. Your edits are retained.")); return null; }
    finally { saving.current = false; setBusy(false); }
  }
  async function reload() {
    if (!base || saving.current) return;
    setBusy(true); saving.current = true;
    try { const result = await candidateRequest("CANDIDATE_GET", { candidateId: base.document.candidate.id }); if (!result.candidate) throw new CandidateError("NOT_FOUND", "The saved candidate is unavailable. Your edits are retained."); accept(result.candidate); setSaved(null); }
    catch (caught) { setError(caught instanceof CandidateError ? caught : new CandidateError("LOAD_FAILED", "Could not reload. Your edits are retained.")); }
    finally { saving.current = false; setBusy(false); }
  }
  const messages: StatusEntry[] = [];
  if (error) messages.push({ key: "candidate-editor", token: `${base?.document.candidate.id}:${attempt.current}:${error.message}`, context: base?.document.candidate.id ?? "candidate-setup", level: "error", sticky: true, message: error.message + (error.fieldPath ? " Field: " + error.fieldPath : ""), actions: error.code === "CONFLICT" ? <button type="button" className="button button-secondary" disabled={busy} onClick={() => void reload()}>Reload saved version (discard edits)</button> : <button type="button" className="button button-secondary" disabled={busy} onClick={() => void save()}>Retry candidate save</button> });
  if (busy) messages.push({ key: "candidate-saving", token: "saving", level: "info", busy: true, message: "Saving candidate in browser…" });
  if (saved) messages.push(saved);
  return { base, document, error, busy, change, save, reload, messages, dirty: Boolean(base && document && !sameJson(base.document, document)),
    validateStep(applies: (path: string | undefined) => boolean) {
      if (!document) return false;
      attempt.current++;
      try { validateCandidate(document); return true; } catch (caught) {
        if (caught instanceof CandidateError && applies(caught.fieldPath)) { setError(caught); return false; }
        return caught instanceof CandidateError;
      }
    },
    adoptPromptSelection(next: StoredCandidate, expectedRevision: number) {
      if (base?.revision !== expectedRevision || base.document.candidate.id !== next.document.candidate.id) return;
      if (!dirty.current) { accept(next); return; }
      setBase(next); operation.current = null;
      setDocument(previous => previous ? editedField(previous, ["applicationPreferences", "assignedPromptTemplateId"], (next.document.applicationPreferences as Record<string, JsonValue>).assignedPromptTemplateId) : previous);
    } };
}
