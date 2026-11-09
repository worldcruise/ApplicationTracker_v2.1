# Resume Studio integration

Application Tracker 2.1 retains SpeedyApply's web forms and application tracker,
the `application-tracker-dock.html` reference Dashboard, and ResumeStudio 0.5.37's
editor, document customization and renderer. Baseline and sibling projects are
unchanged.

## Entry points

- `dashboard.html` is the default Chrome side panel, generated from
  `Baseline/application-tracker-dock.html` with local Lucide icons. Its Apply to Job
  shortcut opens the prepared-queue Details / Autofill / Review flow in the dock.
- `options.html#/dashboard` uses its own original web Dashboard, chart, goal,
  recent applications and capture workflow, isolated from the dock's code and CSS.
- `options.html#/` retains SpeedyApply's search, list and Manage actions.
- `#/settings/profile` is the first/default Settings section; `#/settings/prompts`
  imports the 2.0 prompt workflow; Autofill and eligible Premium settings remain.
- `preview.html` is the Resume Studio web page. The shared header stays above
  the document header and customization controls. **Input**, beside **Customize**,
  starts collapsed. Expanding it places the preview on the left 9/12 and the
  embedded `workspace.html` editor on the right 3/12. Narrow layouts stack the
  columns. The editor stays mounted while hidden to preserve drafts, preview
  ownership and export coordination.
- `settings.html` retains advanced Studio settings outside primary navigation.
- `offscreen.html` performs clipboard and PDF rendering operations.

The reference dock's Quick Actions connect to existing pages. The web Dashboard
has separate components and styles. Resume Studio opens
or reuses its web page without opening a side panel. Job capture reads the source
tab before opening the editor page. The editor's preview button focuses the
adjacent preview; it cannot close its parent tab. Closing the independent native
Dashboard does not close Resume Studio.

Internal web navigation uses the current browser tab. The worker validates the
requesting options tab before opening Resume Studio there. Moving an existing
preview or leaving Studio saves its draft and pending customization through a
scoped runtime message; failure preserves the current page and shows an error.

Candidate and prompt selectors share one row above Job description. Candidate
changes flush pending edits and restore that candidate's draft; prompt changes
save the selected template assignment for Copy Prompt + JD. New, Upload JSON, Save JSON, Edit
candidate and PDF export buttons are absent from the right-hand editor, along
with the redundant Resume Studio heading and idle Ready row. Export PDF and
folder controls are restored in the preview top bar. Profile management stays
in Settings. Error and progress messages remain visible. Capture shortcuts are
ignored on the Resume Studio web page and remain available on job pages.

## Ownership and messaging

`service-worker.js` imports the SpeedyApply background worker and coordinates
Studio requests. `studio/editor-access.js` validates that each privileged editor
request comes from a current extension iframe inside the owning `preview.html`
tab, in the matching browser window. It verifies Chrome's document context,
parent tab URL, preview route and current workspace instance. A standalone
workspace page, unrelated iframe or content script cannot claim the editor.

One Resume Studio page belongs to each normal browser window. The worker opens
that page before the iframe attaches. The editor maintains its instance through
its owner port; preview generation, settings, snapshots and export tickets retain
the imported revision checks. Parent and iframe retain separate messaging
contexts so preview export can call the editor and the editor can flush pending
preview customization before export. The SpeedyApply listener yields these
messages to the Studio listeners.

General top-frame options pages receive capture and Studio navigation operations.
Only the native Dashboard receives its scoped profile-list, profile-selection
and `DOCK_RECORDS_*` operations. The dock queue can load a job into Studio and
freeze a validated result, backing up the previous session draft before changing
jobs. Captured input changes invalidate a ready queue resume; saved application
snapshots remain historical. The web Dashboard reads its own saved-data model. The exact
`#/settings/prompts` sender receives
scoped current-profile and prompt operations; stale saves retain local edits.

## Data and themes

`studio/profile-repository.js` makes the current SpeedyApply profile authoritative.
Private catalog entries retain that schema; `profile-model.js` derives transient
Studio documents for prompt and render code. Legacy Studio candidates migrate
with backups. See [profile alignment](profile-alignment.md).

`studio/storage.js` implements Studio's asynchronous repository interface using
the extension-origin IndexedDB database `autofill-resume-studio-v1`, with local
notifications and BroadcastChannel updates. Shared Chrome local storage access
is never restricted, preserving SpeedyApply content-script access to profiles.
Chrome session storage keeps drafts, capture notices, preview ownership and
export tickets. Folder handles and file-write receipts keep the original store.

The Dashboard preserves the HTML reference's exact dark palette and supplies a
matching light variant. Other extension pages retain their existing light/dark
palettes. `studio/theme.js` stores the
shared `ui-theme:v1` preference in Chrome local storage and propagates changes
across open pages. `studio/theme.css` maps existing web controls to the original
palette tokens. Text colors, selected controls and inspector inputs now follow
the active theme. Muted light-theme text is strengthened for filled cards.
The header's icon-only sun/moon button toggles the saved appearance and exposes
its action through an accessible label and tooltip. Editor fields, placeholders, disabled controls and document
template choices use the same palette. PDF paper remains a document surface.

`studio/resume-customize.css` owns inspector colors, including template dropdown
options and selected thumbnails. Disabled fieldsets retain full opacity while
unavailable controls use the shared disabled colors.

`studio/resume-layout.js` composes justified body paragraphs with hanging bullets:
wrapped and explicit continuation lines start under the first word, including
across page breaks. Final paragraph lines keep natural spacing. Kakuna, RenderCV
Classic, ModernCV, Harvard and Ember place Skills immediately below the document
header, followed by Summary, Experience and Education. The Education before
Skills switch is unavailable for those five templates. The other three retain
their existing section-order behavior. Existing version-1 template metadata
remains compatible with stored snapshots.

Certification issue/expiration controls in advanced Candidate Setup use month
inputs. Full dates from existing records display their year/month without being
rewritten until the user edits the value. Date of birth remains a full date.

## Validation

`npm.cmd test` covers profile persistence and migration, revision conflicts,
prompt settings, editor sender/owner validation, cross-frame settings flush,
theme synchronization and persistence recovery, compiled web-route mounting,
light/dark text contrast, scoped hotkeys, top-bar PDF export,
the embedded editor layout, hanging-indent coordinates and page breaks,
Skills-first layouts, certification month inputs, and the imported renderer producing a real PDF with
page count and SHA-256 verification. Chrome APIs and IndexedDB are simulated;
the PDF renderer uses packaged fonts. These checks do not install the extension
or submit applications.

`npm.cmd run check` validates packaged references and JavaScript syntax.
`npm.cmd run build` produces `dist/autofill`; that path stays stable to preserve
the existing unpacked extension identity. Reload the extension and refresh its
open pages after rebuilding. Visual verification requires a connected Chrome
session. Asset provenance remains in the packaged font manifest and
`fonts/FONT-SOURCES.md`.
