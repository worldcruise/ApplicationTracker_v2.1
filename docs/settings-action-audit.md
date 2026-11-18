# Settings and dock restoration

Audited on 2026-11-17 against the current native side panel and web app.

| Setting | Action using the saved value |
| --- | --- |
| Profile | Canonical profile service supplies Autofill facts, resume uploads, and Resume Studio identity and timeline data. |
| AI provider | `chatProvider` selects ChatGPT or DeepSeek for generation and the dock chat selector. Changes sync across open settings and workspace views. |
| Include cover letter | Updates the same `documentSettings.selectedModules` selection as the Prompt Generate row. |
| Automatic download / preview / formats | `document-downloads.mjs` uses current delivery preferences while preserving the request's selected document sections. Preview preference is checked again when a file completes. Saved Resume and Cover letter buttons always export the requested PDF, independently of automatic-download formats and the next Generate selection. |
| Reuse saved application answers | `dock-apply-service.js` uses both profile reusable answers and learned answers. Switching this off prevents both on the next fill. |
| Save answers for later applications | The retained review actions can learn supplied answers. The current button-only dock does not collect answers typed directly on the employer page. File uploads and consent checkboxes are excluded. |
| Record confirmed submissions | Checked again when submission is confirmed, including an existing Autofill run. Turning it off prevents creating an Application record. |
| Candidate Form | Prompt placeholder defaults and bullet counts are read from the saved candidate document when preparing a prompt. These defaults do not replace the canonical Autofill profile. |
| Instruction / JD / Resume / Cover letter / final JSON | The current generation builder combines selected templates and snapshots the selection and inputs with the request. |
| Autofill prompt / application instructions | Retained AI-answer backend actions include these instructions and selected questions. The button-only Autofill UI does not invoke AI drafting. |
| Keyword highlights | Page highlighting consumes enabled, case, whole-word, color, and keyword preferences. |
| Keyboard shortcut | The capture command uses Chrome's assigned command. The Change shortcut button opens Chrome's shortcut settings; workspace shortcuts retain their displayed bindings. |
| Daily application goal | Dashboard goal and progress read `dailyGoal`. |
| Meeting timezone | Meeting times, dates, day filters, and alarms use `meeting-timezone:v1`. |
| Default export root | Resume Studio and AI-generated document delivery use the selected directory handle. Generated PDFs go into a company folder as `Candidate Full Name.pdf` and `cover letter.pdf`; exporting again replaces those PDFs. Without a configured folder, generated documents use a company folder under Chrome downloads. |
| Theme | The shared theme preference applies to the web app, native dock, and Studio. |

Manual retrieval's **Save result** saves the documents and respects automatic download and preview preferences. Disabling automatic downloads keeps the saved result in the extension without exporting files. A request already in progress keeps its generation selection; later module-selection changes apply to the next request. Delivery preferences remain live. Autofill reads the latest global settings at its next fill or submission action. Explicit programmatic per-run overrides remain supported.

The full folder path is display metadata. File writes use the browser-selected directory handle. A configured folder that is missing or denied reports an error instead of silently exporting elsewhere.

Explicit document downloads can request renewed folder access in the visible UI. The document section shows progress, the saved location, or an actionable error. Automatic background exports never open a permission prompt. Saved document availability is independent of the job's generation status; stale or missing documents remain unavailable.

## Restoring the dock

`extension/studio/dock-state.js` stores navigation separately from running operations. Session storage holds each window's state, and local storage holds the most recent view as a restart fallback.

The dock restores its last top-level page. Apply restores its active tab, selected job, search, status filter, scroll positions, and chat-pane visibility. A saved job selection is restored only when it is compatible with the current application page. Applications retains its existing session-backed detail and draft state. Meetings restores its selected meeting, detail/history tab, and list position. Explicit navigation and the capture shortcut take precedence over remembered navigation.

Restoration never clicks Autofill, submits an employer form, or starts document generation. Operational progress remains in the existing run stores.

Regression coverage is in `settings-runtime.test.mjs`, `document-export-directory.test.mjs`, and `dock-meetings.test.mjs`, alongside existing settings and delivery tests. Isolated Chrome checks also cover actual side-panel close/reopen/unload and real directory-handle writes with synthetic data.
