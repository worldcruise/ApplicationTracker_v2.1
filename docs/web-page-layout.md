# Web page layout and 2.0 prompt settings

The product is named **Application Tracker 2.1**. SpeedyApply's application data, table management
dialogs and profile forms remain in use, with these routes:

| Route | Content |
| --- | --- |
| `options.html#/dashboard` | Web Dashboard: counts, activity chart, branched progress, daily goal and recent applications |
| `options.html#/` | Application search, status/date filters, list/pagination, per-row editing/status and Manage |
| `options.html#/meetings` | Filtered application board: Screening, Interview, Offer, Rejected and Archived |
| `options.html#/settings/profile` | SpeedyApply profile, first in Settings and its default section |
| `options.html#/settings/profile/new` | SpeedyApply profile creation |
| `options.html#/settings/prompts` | Imported 2.0 prompt settings |
| `options.html#/settings/autofill` | Existing Autofill settings |
| `preview.html` | Resume Studio preview with a collapsed Input panel; expanded: preview left 9/12, editor right 3/12 |

Old `/profile` and `/profile/new` links redirect to the Settings equivalents,
preserving the query string. The dock Profile shortcut and editor actions use
the new destinations directly. The editor lives in the Resume Studio web page.

Web header tabs and Dashboard shortcuts navigate in the current browser tab.
Resume Studio opens its owned preview in that same tab; leaving it flushes the
editor and pending document customization first. A failed flush keeps the page
open and displays the error. Native dock launch behavior stays separate.

`studio/branding.js` defines the app name and shared Resume Studio icon.
`studio/web-header.js` shares the navigation markup between the options page and
resume preview, accepting each host's existing React runtime. Preview keeps its
Customize, Input, folder selection and PDF export in the preview top bar. Input
starts collapsed and toggles independently of Customize. The right-hand
editor's PDF export, New, Upload JSON, Save JSON, Edit candidate, title and idle
Ready row remain removed. Candidate and saved prompt selectors share one row
above Job Description. Candidate changes preserve pending edits and switch the
active SpeedyApply profile. The icon-only theme toggle and placeholder Connect to DB
button share a far-right action group in every primary web header. Styling lives in
`assets/web-pages.css` and responds to narrow page widths.

The web Dashboard is isolated in `studio/web-dashboard.js`,
`studio/web-dashboard-data.js` and `web-dashboard.css`. It uses the retained
SpeedyApply chart component with 7/30/90 local-day series. Applications retains
search, list and Manage, along with the original provider's internal chart/date
helpers. Those helpers are required even when the chart is hidden; deleting them
caused the reported `PL is not defined` runtime error.

`studio/application-progress.js` renders Dashboard's chart directly below
Application activity. Today, This week (Monday onward), This month and Total
filter by submission timestamp. Total applied stays on the left, branching into
the five current-status counts. Applications still in Applied remain in the
total and appear as awaiting response. There is no application board on Dashboard.
The native dock does not import these web-only components.

`studio/application-filters.js` provides search, status, start date and end date.
Searching preserves the other filters, date bounds remain consistent, and Clear
filters resets the combination. The search field has an accessible name and no
visible “Search applications” label or placeholder.

## Meetings

`studio/meetings-board-page.js` displays Screening, Interview, Offer, Rejected
and Archived using SpeedyApply's `WL` provider and `TL` board. Applied
is excluded from this page. Search, stage and date filters work together, and
column counts follow the filtered cards. Status moves preserve the existing
application storage and synchronization path. This page has no progress chart.

The earlier standalone scheduling UI, repository and worker API are removed.
Previously stored `application-tracker:meetings:v1` records are left untouched.

## Prompt source and behavior

The prompt workflow in `src/prompts/` comes from
`../ApplicationTracker_v2/apps/extension/src/`: `settings.tsx`, `resume-prompt.tsx`,
`candidate-editor.tsx`, `candidate-fields.tsx`, prompt composition/building and
validation modules. `resume-dates.ts` comes from its `packages/resume-engine/src/`.
The sibling project and baseline are unchanged.

The imported workflow includes saved templates, exact-once candidate/job
placeholders, new/edit/save template controls, per-profile/default selection,
candidate prompt preferences (seniority, experience, bio, work and education
overrides), sample-job live preview, copy, application instructions and reusable
answers. It uses the existing private prompt library and aligned SpeedyApply
profile repository. Studio-only instructions remain metadata, preserving
Autofill's employment answers, uploaded resume and other canonical profile fields.

The options page is not a dock owner. Only its exact top-frame
`#/settings/prompts` sender receives the extra prompt/current-profile operations.
The coordinator checks identities and revisions; stale saves retain local edits.
Tests compare the imported live prompt with the dock's actual prompt builder.

`scripts/build-prompts.mjs` compiles the source into `studio/prompt-settings.js`
using esbuild and a host React adapter. Edit the source, then run
`npm.cmd run build` before testing the packaged extension. The adapter avoids a
second React dispatcher in SpeedyApply's options page. No new runtime or remote
service is required.

## Application Tracker dock

`dashboard.html` is the native side panel. Its markup and controller are generated
from `Baseline/application-tracker-dock.html`; web pages do not import them.
The dark CSS is copied verbatim, the icons use the reference's Lucide 0.468.0,
and a matching light palette follows the original rules. The product title stays
Application Tracker 2.1. Remote scripts and inline event handlers are replaced
with packaged SVGs and an extension module.

`scripts/build-reference-dashboard.mjs` creates only dock markup and styles.
`studio/reference-dashboard.js` attaches live data and navigation. Candidate
selection reads and changes the canonical profile through scoped worker
operations. Saved applications supply Recent Activity and today's submission
count; completed CV exports supply prepared-resume counts for the current
session. Calendar meetings show unavailable while no calendar is connected.
Sample candidate names and sample activity are not shipped.

Browse Jobs opens LinkedIn Jobs, Apply to Job opens its dock workflow using a
prepared queue item, Applications opens the dock workspace, Meetings
opens the Meetings board, and Profile settings opens the
existing profile page. Opening these shortcuts does not submit an application.

The dock's Applications workspace imports the authored card/detail/preview layout
from `Baseline/applications-job-queues-code.html`, without its visualization host
or remote scripts. `build-job-records.mjs` generates packaged markup, local icons
and `job-records.css`; only `dashboard.html` loads that stylesheet.
Application Workspace offers Add manually and Refresh records in its toolbar.
It inherits the shared theme without a local theme toggle.
Queue cards use compact spacing and labelled Go to apply and View resume actions,
plus a details icon for record management. Go to apply selects any queued job in
the internal Apply flow; starting still requires a current Ready resume. View resume
loads its saved CV JSON, template, formatting and profile bindings into the existing
Resume Studio preview page. Current editor text is flushed and backed up before
replacement. Draft text and document settings use their separate revision-checked
repositories. Every queue card offers Update resume and Delete, including Queued
jobs; deleting retains the existing Undo action.
`studio/queue-resume-input.js` owns the CV input modal. Its CV/letter control styles
are scoped imports from `workspace.css`; it omits JD and has a queue-specific status
bar, optional letter toggle, folder selector, Update, Cancel and Download controls.
The worker validates with the real Studio schema and builds an isolated snapshot,
without replacing the active Studio draft or candidate. Updating a resume copies
differing company/title labels from CV JSON, retains matching labels and previous
resume versions, and marks the current job Ready. A cover-letter card action appears
only when letter text has been saved.
`studio/queue-export-folder.js` shares Studio's local directory-handle store.
The modal remembers its folder binding separately from Studio's folder assignment.
`studio/queue-resume-export.js` checks the selected handle's candidate and permission,
then uses the existing frozen PDF tickets, file-writing receipts and per-file retry.
Queue downloads request CV plus an enabled imported letter and omit the JD file;
regular Resume Studio exports retain their existing files. Download does not commit
modal edits. Closing/cancelling the modal leaves the queued resume unchanged.
Record detail cards open Job description before Details. This view shows the full
saved description and a safe original-listing link, while Details retains status,
record fields and management actions. Prepared jobs show a Ready badge at the top
right of the detail heading, with Updated to the left of the job title. Saved setups with the former Preview mode
restore to Job description.
`studio/job-records-view.js` handles dock navigation, editable forms, keyboard tabs
and session-kept draft text. `studio/dock-records-service.js` runs only for scoped
native-dashboard requests. Queues, snapshots, history and application metadata live
in private IndexedDB; submitted applications use SpeedyApply's existing store and
sync functions. Application status uses the existing Archived stage.

Preparation is manual through the existing Resume Studio page. Saving a result
checks its job inputs and the actual Studio CV validator/render snapshot builder.
Editing job inputs invalidates the ready resume. The fixed application submission
time and persistent queue receipt allow interrupted Mark as applied operations to
recover without duplicate submissions. No queue tabs or new controls are added to
the extension web pages.

`studio/dock-dashboard-view.js` owns the dock's Dashboard, job records and Apply
view visibility. Dashboard Apply to Job and queue actions mount
`studio/apply-dock-view.js` inside the same `dashboard.html`. The build extracts
only the authored block in `Baseline/apply-to-job-ready-queue-code.html`, creates
local icons and `apply-dock.css`, and bundles the isolated form bridge. Visualization
host scripts, CDN dependencies and the reference's demo runtime are excluded.
Both authored style blocks are included, with the second block supplying the
prepared-job card. Their selectors are scoped beneath the native dock
to preserve the reference's fonts and spacing. All color tokens inherit the
existing Dashboard and shared application theme; Apply defines no independent
light/dark palettes. Apply keeps its rounded 430px window beneath the standard
dock header. Candidate selectors and record labels use full names, while stored
profile aliases remain unchanged for history and synchronization.
Dashboard navigation and the Apply to Job title sit above the reference window, and the
application-tab selector is grouped inside Autofill options. Its local theme
button is removed. `build-reference-dashboard.mjs` includes `apply-dock.css`
in the actual dock HTML, so rebuilding retains the imported styling.
Tailoring starts enabled, expanding the resume input. Saved setups from before
this default adopt it once; an explicit off choice is then preserved on reopening.
The From Job Queues card browses every active queue item with first/previous/next/last
controls and a position counter. Each card opens its job URL or selects its detail
in Application Workspace. Only a current Ready resume can start autofill.

Opening the dock's queue or Apply view adds five labelled sample jobs once per
candidate. Removing a sample keeps it removed. Samples have preview snapshots and
placeholder URLs; they cannot start autofill, overwrite a candidate, or become
application records. Existing user jobs and Studio drafts are preserved.

Tailoring shows Import JSON from job queue on the left and Manual upload on the
right. Queue JSON uses the saved CV directly, maps work descriptions through its
stable profile bindings, preserves factual profile fields, and attaches its rendered
PDF after review. Manual upload keeps the existing PDF/DOCX parser. Both real-job
imports require an explicit reviewed update and reject changed profiles or job inputs.

`studio/dock-apply-service.js` accepts only native-dashboard operations through
the existing worker gate. Private IndexedDB stores run context, approved answers,
import reviews and unsaved UI text. Runs freeze the canonical profile, job inputs
and resume version, and bind writes to one browser window, employer tab and frame
document. The queued snapshot renders in a separate offscreen workspace namespace
so dock previews cannot invalidate the Studio preview. Each pause/resume increments
the form-session token; delayed fills or AI replies cannot overwrite a newer run.
Window closure clears the run, while browser startup cancels obsolete tab bindings.

The injected `content-scripts/dock-apply.js` handles standard form controls and
reports real field values and validation. Existing values are preserved; consent
and missing personal facts require an answer. Custom widgets are completed on the
employer page. The existing multipart resume parser and synced-profile answer API
remain behind `studio/dock-apply-api.js`; parsing reviews preserve contact details
and keep the job's queued PDF selected. DOCX parsing does not replace the canonical
PDF attachment with DOCX bytes.

Submit uses an unambiguous employer submit button and persists its pending state
before clicking. Application recording requires explicit user confirmation and
reuses the existing queue receipt/duplicate checks. Interrupted recording retries
reuse the same request. Auto-submit starts disabled. Neither this stylesheet nor
its view controller is loaded by the extension web pages.

The editor runs in `workspace.html` inside the Resume Studio page and stays
mounted while its Input panel is hidden. The expanded desktop grid uses 9fr/3fr
columns; narrow pages stack the preview and editor. Capture
finishes on the job tab before opening Resume Studio. Closing the Dashboard
side panel does not close Resume Studio or discard its draft.

`studio/capture-hotkey.js` ignores the capture command when the Resume Studio
web page is active, including its JD/CV iframe. The global command remains
registered and captures normal job pages. Manual capture actions still work.

`studio/theme.js` shares the original `ui-theme:v1` preference through Chrome
local storage. Theme changes update the dock, web pages and editor together.
`studio/theme.css` uses the original light and dark tokens and maps the retained
SpeedyApply controls to those palettes.

The existing unpacked output path, profile keys and private database stay stable.
Runtime tests mount the compiled web bundle with simulated Chrome APIs. Contrast
checks cover text and controls in both themes, including the formerly mixed
light-background/dark-inspector styles.
