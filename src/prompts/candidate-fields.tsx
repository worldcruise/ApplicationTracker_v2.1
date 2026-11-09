import type { ReactNode } from "react";
import { object, type CandidateDocument, type JsonObject, type JsonValue, type CandidateError } from "./candidate-contract";
import { statusMessageId } from "./status-bar";
import { monthInputValue } from "../../extension/studio/month-input.js";
export type Path = Array<string | number>;
export const fieldPathFor = (path: Path) => "$" + path.map(part => typeof part === "number" ? `[${part}]` : "." + part).join("");
export type Field = { key: string; label: string; kind?: "multiline" | "strings" | "boolean"; type?: string; nullable?: boolean; omitEmpty?: boolean; wide?: boolean; options?: Array<[string, string]> };
export function editedField(document: CandidateDocument, path: Path, value: JsonValue | undefined): CandidateDocument {
  const next = structuredClone(document); let target: JsonObject | JsonValue[] = next;
  for (let index = 0; index < path.length - 1; index++) {
    const part = path[index]!, node = Object.hasOwn(target, part) ? (target as JsonObject)[part] : undefined;
    if (node === null || typeof node !== "object") Object.defineProperty(target, part, { value: typeof path[index + 1] === "number" ? [] : {}, enumerable: true, configurable: true, writable: true });
    target = (target as JsonObject)[part] as JsonObject;
  }
  const last = path[path.length - 1]!;
  if (value === undefined) delete (target as JsonObject)[last]; else Object.defineProperty(target, last, { value, enumerable: true, configurable: true, writable: true });
  return next;
}
export function fieldValue(document: CandidateDocument, path: Path): JsonValue | undefined {
  let value: JsonValue | undefined = document;
  for (const part of path) value = value !== null && typeof value === "object" && Object.hasOwn(value, part) ? (value as JsonObject)[part] : undefined;
  return value;
}
export type CandidateForm = { document: CandidateDocument; error: CandidateError | null; change: (path: Path, value: JsonValue | undefined) => void };
export function candidateFields({ document, change, error }: CandidateForm) {
  function field(spec: Field, parent: Path, prefix = "") {
    const path = [...parent, spec.key], value = fieldValue(document, path), id = "candidate-field-" + path.join("-");
    const label = prefix + spec.label, invalid = (target: Path) => error?.fieldPath === fieldPathFor(target);
    const described = invalid(path) ? statusMessageId("candidate-editor") : undefined;
    if (spec.kind === "boolean") return <label key={id} className="checkbox-field" htmlFor={id}><input id={id} type="checkbox" checked={value === true} onChange={event => change(path, event.target.checked)} />{label}</label>;
    if (spec.kind === "strings") {
      const list = Array.isArray(value) ? value : [];
      return <div className="string-list" key={id}><span className="field-label">{label}</span>{list.map((item, index) => <div className="list-row" key={index}>
        <textarea aria-label={`${label} ${index + 1}`} rows={2} value={typeof item === "string" ? item : ""} aria-invalid={invalid([...path, index])} aria-describedby={invalid([...path, index]) ? statusMessageId("candidate-editor") : undefined} onChange={event => change([...path, index], event.target.value)} />
        <button type="button" className="button button-danger" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => change(path, list.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
      </div>)}<button type="button" className="button button-secondary" onClick={() => change(path, [...list, ""])}>Add {spec.label.toLowerCase()}</button></div>;
    }
    const text = typeof value === "string" ? value : "";
    return <label key={id} className={`editor-field${spec.wide ? " wide-field" : ""}`} htmlFor={id}>{label}{spec.kind === "multiline" ? <textarea id={id} aria-label={label} rows={3} value={text} aria-invalid={invalid(path)} aria-describedby={described} onChange={event => change(path, event.target.value)} />
      : spec.options ? <select id={id} aria-label={label} value={text} aria-invalid={invalid(path)} aria-describedby={described} onChange={event => change(path, !event.target.value && spec.omitEmpty ? undefined : spec.nullable && !event.target.value ? null : event.target.value)}>
        {!spec.options.some(([value]) => value === text) && <option value={text}>{text || "Select an answer"}</option>}{spec.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      : <input id={id} aria-label={label} type={spec.type ?? "text"} value={spec.type === "month" ? monthInputValue(text) : text} aria-invalid={invalid(path)} aria-describedby={described} onChange={event => change(path, spec.nullable && !event.target.value ? null : event.target.value)} />}</label>;
  }
  function collection(title: string, path: Path, specs: Field[], options: { add?: string; extra?: (item: JsonObject, path: Path, index: number) => ReactNode } = {}) {
    const value = fieldValue(document, path), list = Array.isArray(value) ? value : [];
    return <div className="setup-collection">{list.map((entry, index) => {
      const item = object(entry), itemPath = [...path, index];
      return <fieldset className="setup-record" key={String(item.id)}><legend>{title} {index + 1}</legend><div className="setup-fields">{specs.map(spec => field(spec, itemPath, `${title} ${index + 1}: `))}{options.extra?.(item, itemPath, index)}</div>
        <button type="button" className="button button-danger remove-record" onClick={() => change(path, list.filter((_, itemIndex) => itemIndex !== index))}>Remove {title.toLowerCase()} {index + 1}</button></fieldset>;
    })}<button type="button" className="button button-primary" onClick={() => change(path, [...list, { id: crypto.randomUUID() }])}>{options.add ?? "Add " + title.toLowerCase()}</button></div>;
  }
  return { field, collection };
}
