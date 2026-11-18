# Current extension runtime

Settings consumers and dock restoration are documented in [Settings and dock restoration](settings-action-audit.md).

Original SpeedyApply submission observers, source references, and duplicate-recording conflict handling are documented in [Submission integration](speedy-submission-integration.md).

The extension uses one service worker, one web application, and Chrome's native side panel. Existing profile, application, queue, and document storage identities are preserved.

| Entry | Responsibility |
| --- | --- |
| `extension/service-worker.js` | Authorized requests, profile and document services, local application records, application tracking, and AI generation |
| `src/web-app.jsx` → `extension/web-app.js` | Dashboard, Applications, Meetings, and Settings |
| `extension/sidepanel.js` | Native dock and its current Apply to Job workspace |
| `src/dock-apply-content.js` | Manual form filling and passive Apply/Next/Submit observation |
| `src/apply-network-content.js` | Workday submission receipt observation |
| `extension/preview.js`, `workspace.js`, and `offscreen.js` | Resume Studio editing, PDF rendering, preview, and export |
| `extension/ai-apply/src/generation-service.mjs` | ChatGPT/DeepSeek conversation ownership, prompt submission, and result retrieval |
| `extension/studio/meeting-workflow-service.js` | Real application progression, scheduling, transcripts, and manually recorded follow-up emails |

Applications save locally through `dock-records-service.js`. Submission observation records confirmed applications once. Autofill requires a user action. Employer Apply, Next, and Submit controls are observed rather than clicked by the extension.

Applications and Job Queue expose Import and Export through Manage in the web app and native dock. Basic exports contain only company, role, application link, salary, and JD as CSV. Applications additionally offer **Export the application data**, unchecked by default: this writes versioned JSON with saved resume CV/snapshot, cover letter, status, `created_at`, update date, notes, conversation link, and record history. Application import accepts both formats; CSV creates Applied records using the current creation time, while full JSON preserves the saved dates, documents, and status. Existing application/queue URLs and repeated rows are skipped. Imports report imported, skipped, and failed counts without overwriting existing records; full imports do not replace the single profile. Full JSON supports up to 1,000 records and 50 MB per import.

Resume imports and address lookup use their existing endpoints through small, dedicated clients. They do not initialize an account SDK, remote application sync, subscriptions, referral tracking, or background authentication refresh.

The original SpeedyApply background application, generic injected application, popup, obsolete web bundles, in-page dock, local resume extraction rules, and unused profile/queue controls have been removed. Mock generators live in `tests/fixtures` and are excluded from the extension package.

The retired manual-copy preferences no longer change Autofill buttons or poll the clipboard. Explicit Copy and Manual retrieval remain available. Unfinished runs using those old modes retain their saved conversation and pause for Resume.

React is built from declared package dependencies into `extension/vendor/react.js`. The current web app has no dependency on the removed vendor application chunks. `scripts/check.mjs` rejects retired runtime files if they are reintroduced into the package.

Reference designs in `Baseline` remain outside the shipped extension. The build uses the current dashboard and queue design sources; it no longer enforces parity with the original extension.
