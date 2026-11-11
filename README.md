# Application Tracker 2.1

Application Tracker 2.1 keeps SpeedyApply 2.28.2's web pages, uses the original
web Dashboard, imports the extension dock from `Baseline/application-tracker-dock.html`,
and embeds ResumeStudio 0.5.37 beside its web preview. The original projects
remain in `Baseline/`; edit the working application in `extension/`.

This first setup preserves the shipped JavaScript bundles and existing screens.
The original React/TypeScript source and build configuration are not included in
the baseline, so this is a packaging and development workflow for the supplied
build. The toolbar dock and web Dashboard have separate entry points, components
and styles so each can be developed independently.
Resume Studio opens a web page with document preview below the shared
Application Tracker 2.1 header. Its **Input** panel starts collapsed; the top-bar
toggle opens the editor on the right (3/12) beside the preview (9/12).
Applications
retains SpeedyApply's search, list and Manage actions. Profile is the first section
of Settings. New dashboard and integration modules are editable in `extension/studio/`;
the imported 2.0 prompt workflow is editable in `src/prompts/`.
See [the baseline notes](docs/autofill-baseline.md) and
[Resume Studio integration](docs/resume-studio-integration.md) for the architecture.

## Requirements

- Node.js 22 or newer; setup was checked with Node.js 24.22.0.
- Google Chrome 116 or newer with Developer mode enabled for unpacked extensions.

The extension has no runtime npm dependencies. Install development dependencies
with `npm.cmd ci`: esbuild compiles prompt settings, Lucide 0.468.0 supplies the
reference's local icons, fake-indexeddb supports storage tests, and happy-dom
loads the packaged web bundle for runtime and text-contrast checks.

## Build and load

From this directory:

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd test
npm.cmd run check
```

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select this repository's `dist/autofill` folder.
4. Click **Application Tracker 2.1** in the extensions menu to open the dock's Dashboard.
   On regular websites, this mounts the dock directly inside the page's Shadow DOM:
   384px wide, full height, flush right, with no outer margin or corner radius.
   Click **›** beside Settings to collapse it and restore page space.
   Click the edge icon to reopen it; drag its grip to move it vertically.
   Visibility belongs to that tab and is retained when that tab navigates.
   The header shows the active candidate's initial without a dropdown. Settings
   opens the extension web page. When a page cannot host the dock, the toolbar
   button opens the web Dashboard, reusing an existing extension tab in that window.
   Queue **Update** and **Cover letter** open the existing CV editor in
   an extension tab so saved folder permissions stay on the extension's origin.
   Select **Resume Studio** to open its preview and editor web page.
   The Application Tracker Overview opens on first installation.
5. The **web Dashboard** shows application counts, the 7/30/90-day activity chart,
   daily goal, recent applications and job capture. The **dock Dashboard** keeps
   the HTML reference's Today cards, Quick Actions and Recent Activity.
   **Applications** contains search, status/date filters, the list and
   Manage. **Settings** starts with Profile, followed by Prompt settings, Autofill, Other
   and any available Premium settings. **Resume Studio** opens the preview; use
   **Input** beside **Customize** to expand its editor. The dock and all extension pages share
   the original light/dark palette and a saved theme preference.
6. **Meetings** opens the filtered application board for Screening, Interview,
   Offer, Rejected and Archived. It uses the existing application
   records and status updates. Its toolbar includes search, status and dates.

After updating an already loaded copy, reload it in `chrome://extensions` and
refresh the dashboard. The manifest adds the permissions needed for local job
capture, clipboard copying, preview, and document downloads.
The unpacked output remains `dist/autofill` so renaming the app does not change
the existing loaded extension's path or storage identity.

If an older development copy was loaded from `dist/speedyapply`, load
`dist/autofill` as the new unpacked location and remove the old development
entry. Chrome can assign a different extension ID when the unpacked path
changes; existing local profiles are not migrated automatically.

The development manifest fixes the missing icon paths and omits the original
extension key and Chrome Web Store update URL. Chrome assigns this unpacked copy
its own identity; its storage is separate from the original extensions.

## Development

Release versions follow `2.1.x`; `package.json` records the current release. To increment
the patch and update the package, lockfile and Chrome manifest together, run:

```powershell
npm.cmd run version:patch
npm.cmd run build
```

The build rejects mismatched versions. Keep the product name Application Tracker
2.1; increment the patch for subsequent releases. Versions mentioned for baseline
projects and third-party dependencies describe those original sources.

```powershell
npm.cmd run dev
```

This builds once and watches `extension/` and `src/prompts/` for changes. Reload the extension in
`chrome://extensions` after each rebuild, then refresh any page running its
content script. The watcher rebuilds files; it does not automatically reload
Chrome.

| Path | Purpose |
| --- | --- |
| `extension/manifest.json` | Development identity, permissions, and entry points |
| `extension/service-worker.js` | Combined worker entry point and Resume Studio coordinator |
| `extension/background.js` | Autofill message routing, data synchronization, and response streaming |
| `extension/content-scripts/` | Application-platform detection, autofill, and injected UI |
| `extension/chunks/` | Packaged popup, options, side-panel UI, and shared libraries |
| `extension/studio/` | Overview, SpeedyApply profile adapter, preview navigation, private storage |
| `src/prompts/` | Imported 2.0 prompt templates, candidate prompt form, live preview and instructions |
| `extension/workspace.html` | Resume Studio's embedded right-hand editor |
| `extension/options.html` | SpeedyApply web pages and Application Tracker Overview |
| `extension/settings.html` | Retained advanced Studio prompt/settings implementation |
| `extension/preview.html` | Resume preview and document customization |
| `extension/studio/reference-dashboard.js` | Native dock controller and navigation |
| `extension/studio/web-dashboard.js` | Independent web Dashboard component |
| `extension/studio/meetings-board-page.js` | Five-stage application board on the Meetings page |
| `extension/studio/application-progress.js` | Dashboard's period-filtered branched progress chart |
| `extension/studio/application-filters.js` | Application search, status and date filters |
| `extension/web-dashboard.css` | Web Dashboard styles, never loaded by the dock |
| `extension/assets/web-pages.css` | Shared web header, settings and preview styling |
| `extension/assets/resume-prompt.css` | Imported 2.0 resume prompt layout |
| `extension/studio/resume-workspace.css` | Embedded Resume Studio editor and candidate controls |
| `extension/dashboard.*` | HTML reference Dashboard entry point and generated CSS |
| `extension/studio/theme.*` | Shared original light/dark palettes and preference |
| `scripts/` | Prompt compilation, validation, build and watch commands |
| `tests/` | Storage, coordinator, dashboard, dock, and PDF integration tests |
| `dist/autofill/` | Generated unpacked extension; replaced on each build |
| `Baseline/` | Original reference projects |

`npm.cmd run check` parses JavaScript and JSON and checks manifest, HTML, CSS,
and literal local module references. The build validates before replacing its
output. Runtime behavior, bare package resolution, and references assembled
dynamically require browser checks.

`npm.cmd run build:prompts` compiles `src/prompts/` into
`extension/studio/prompt-settings.js`; the normal build also runs this step. Each
host provides its existing React runtime, so the prompt editor bundles no second
React runtime. See [the web page notes](docs/web-page-layout.md).

## Resume Studio

Create or edit your profile in **Settings → Profile**. Upload a PDF or DOCX resume
to create it; **Replace resume** updates the same profile and its parsed details.
Manual profile editing remains available. The workflow exposes one active profile,
without profile switching, cloning, or extra-profile creation. Earlier records stay
in private storage for history, and resume replacements keep revision backups.
Resume Studio shows that profile's name and its saved prompt above Job Description.
Open **Input** beside **Customize** to show the editor. It starts collapsed and
keeps your draft when hidden.
Selecting a prompt saves its assignment for **Copy Prompt + JD**. Capture the active job page with
**Ctrl + Shift + F** (**Command + Shift + F** on Mac), or paste its URL and
description. Copy the prompt, paste generated six-field CV JSON, and customize
the document preview. **Export PDF** and folder selection are in the preview top
bar. The right-hand JD/CV editor has no PDF export or profile-management buttons.
The redundant editor heading/idle Ready row stays removed. The capture hotkey
is ignored while Resume Studio is the active tab and remains available on job
pages. The preview and editor share the Resume Studio
web page. Web navigation opens the existing SpeedyApply pages. The dock and all
extension pages share the original light and dark palettes and a saved preference.

Resume paragraphs use justified text with hanging bullets, so continuation lines
align with the first word. Kakuna, RenderCV Classic, ModernCV, Harvard and Ember
place Technical Skills directly below Summary. Certification issue/expiration inputs in
advanced Candidate Setup accept month and year.

The active profile uses SpeedyApply's `chrome.storage.local.profile` structure.
Studio reads that profile through an adapter, so web-page edits update its
professional facts. The private IndexedDB catalog stores profiles in the same
structure, plus Studio-only preferences and prompt metadata. Existing Studio
candidates migrate with backups and do not overwrite an existing active Autofill
profile. See [the profile alignment notes](docs/profile-alignment.md).

The dock Dashboard is generated from `Baseline/application-tracker-dock.html`.
Its dark layout and icons match the
reference, with a matching light variant. Candidate selection uses canonical
profiles; activity and counts use saved records. Browse Jobs opens job search,
Apply to Job opens the dock's prepared-job workflow, Applications opens the dock's
Applications / Job Queues workspace,
Meetings opens the Meetings board, and Profile settings opens Settings.
Meetings show as unavailable while a calendar is not connected. Dock development
does not change the web Dashboard's component, data helpers or stylesheet.

In Application Workspace, **Add manually** opens the queue-item form on Job Queues.
On Applications it opens **Add application record manually**, requiring Company and
Role (marked with an asterisk) and saving an application record directly.
**Open in Resume Studio**
loads that job into the existing editor, preserving the previous draft in a private
backup. After preparing CV JSON there, **Save Studio result** validates and retains
its resume snapshot. **Mark as applied** records one SpeedyApply application.
This release uses manual Resume Studio preparation; background GPT generation is
not connected. Saved GPT conversation links can be opened from a record.
Failed jobs support retry. Every queue card supports Delete and Undo, including
Queued and Ready jobs. Dock form drafts survive tab switches
and dock reopening. The web Applications page retains its existing UI.
Job Queue cards use compact spacing with labelled **Go to apply** and **View resume**
actions. Apply to Job lists only Ready jobs with a current saved resume.
View resume opens the extension's Resume Studio
preview with that job's saved CV JSON, template and formatting; the previous editor
draft is backed up first. Every card also offers **Update resume**, opening **CV input**.
This modal reuses Resume Studio's CV and cover-letter controls without a JD section.
Paste or import six-field CV JSON; a status bar validates it before **Save & Export**.
This saves the queue resume, copies differing company/title labels, and exports
the CV plus any enabled cover letter through the existing PDF pipeline, without
a JD file. Failed exports can be retried without saving another resume version.
Cover-letter import accepts `.txt`, `.md`, and text-based `.pdf` files and follows
its toggle. Cancel leaves the saved resume unchanged.
Settings → Other includes **Default export root directory**, showing
the selected folder name. Choose a folder once to use it by default for Studio
and queue exports; explicit profile and export folder selections take priority.
Record details open on **Job description**, the first tab, with the complete saved
description and a link to the original listing. Queue details keep **Go to apply**
and **Delete** above the tabs. **Update record** sits on the far right of the tabs
and enables the form. Details forms use Resume (CV JSON) and Cover letter instead
of Notes; Candidate and Updated appear at the top right.
The CV input popup includes **Copy prompt** with instructions for converting a
resume into six-field JSON. It copies the exact **Resume to structured JSON**
template also available in Application prompts.

**Apply to Job** opens Details → Autofill → Review inside the dock, using
`Baseline/apply-to-job-ready-queue-code.html`. Select a Ready job and its employer
tab, then start. A queue card's **Go to apply** opens the same flow.
Tailor resume to this job starts on, with the resume input expanded. An explicit
off choice is remembered. The standard dock header remains visible on this page.
The Apply to Job title sits beside Dashboard. From Job Queues shows one card at
a time with first/previous/next/last controls, its position, Go to URL and View
details. View details selects that job in **Application Workspace**. Tailoring
offers **Import from Queue** on the left and manual PDF/DOCX upload on the right.
Queue import reads the saved exported resume PDF and uses the same file parser
as manual uploads. Older resumes without an exported file use a PDF rendered
from their saved snapshot.
Five labelled sample jobs are added once per candidate when opening the dock queue
or Apply view; samples can be removed and cannot submit or update the real profile.
Candidate labels across the dock, Studio and web pages use complete names;
stored profile aliases remain available to the original sync and history logic.
The selected queue snapshot supplies the actual PDF, independent of later Studio
edits. Standard employer inputs, native selects and resume uploads use canonical
SpeedyApply profile facts; unknown questions and custom widgets stay manual.
Progress reports detected fields. Pause/cancel stop further writes, and rescan
reconnects after a page change. Resume imports show parsed work, education and
skills for review before updating the current profile. Parsing and AI drafts use
the existing SpeedyApply services; AI requires the matching synced account profile.
Submitted applications are recorded only after explicit confirmation in the dock.
Auto-submit is off by default. The dock workflow adds no tabs or controls to the
extension web pages.
Apply to Job retains both authored reference style blocks, including the
prepared-job grid, spacing and rounded window. Colors inherit Application
Tracker's shared dock theme; Apply has no independent palettes or theme control.
Dock navigation sits above the card; application-tab selection lives inside
Autofill options. The dock build includes `apply-dock.css` in its HTML entry point.

The Applications provider retains SpeedyApply's date/chart dependencies even
when its page renders only the search, list and Manage controls. Removing those
helpers caused a `PL is not defined` runtime error; they are restored. The DOM
smoke test mounts the actual compiled Dashboard, Applications and retained
Settings routes with representative local data to catch this class of regression.

Dashboard shows the branched Application progress chart directly below
Application activity. Today, This week, This month and Total select the
submission period. Total applied is on the left, branching to Screening,
Interview, Offer, Rejected and Archived; pending applications remain
included in the total. The stages describe current status, not historical
transition events. The draggable application board is on Meetings only.
Card moves use the existing application update/sync path.
Applications search combines with the selected status and date range, with a
single Clear filters action. The search field keeps an accessible name without
the former “Search applications” text or placeholder.

The former standalone meeting-planning UI and API are retired. Its previously
saved local records are not deleted. Meetings now displays the five application
stages and filters, with no progress chart or scheduling form.

All primary web headers put the theme and database icons together on the far
right. Connect to DB is a disabled placeholder; it does not start authentication
or open a connection. Database connectivity will be implemented later.

Primary page headers use the shared Resume Studio icon; the dock preserves
the HTML reference's briefcase logo. Both keep the **Application Tracker 2.1** name.
Existing storage keys and database names are retained.

## Inherited integrations

The copied application retains its SpeedyApply and Supabase integrations,
including sign-in, profile/application synchronization, subscriptions, and
premium generation. Those services have not been configured for this project or
verified with the development extension identity. This setup does not provide
their server implementation or enable paid features.

## Browser smoke check

After loading, inspect the extension's **Errors** and service-worker console.
Check the Overview and the SpeedyApply Applications, Profile and Settings pages.
Verify the toolbar opens the HTML reference Dashboard, and the web Resume Studio
link opens its preview and right-hand editor. Edit the profile in Settings, check
Studio updates, capture a test job, paste CV JSON, and inspect the preview. Exercise Autofill
against a test application form. These live checks are separate from the Node
tests and packaging validation.
