# SpeedyApply baseline integration

The working copy originates from the user-supplied `Baseline/SpeedyApply/`,
version 2.28.2. Its author, homepage, assets, and shipped bundles are retained.
No additional license or redistribution rights are asserted by this setup.

## Changes in the working copy

- The extension name, short name, toolbar title, page titles and shared brand
  use Application Tracker 2.1, with the Resume Studio document/check icon.
- Icon paths use the supplied `icon/icon-*.png` files. The missing 96px icon
  entry is removed; 16px, 32px, 48px, and 128px entries remain.
- The upstream extension key and store update URL are omitted so the unpacked
  development copy has a separate identity.
- SpeedyApply's application search/list/Manage and Settings forms are retained.
  Profile is the first section of Settings. The application chart is moved to
  the polished Overview at `#/dashboard`. Earlier
  subscription/docs/contact/feedback removals and the removed footer remain.
- ResumeStudio 0.5.37 is imported into the same extension. The web Resume Studio
  entry opens document preview; the editor remains in the dock.
- The toolbar opens the Tracker dock with compact Dashboard and Resume Studio
  tabs, plus shortcuts for web pages. Candidate and export controls remain in Studio.
- The resume preview retains shared navigation above its document header.
- Application Tracker 2.0's prompt editor, live preview, candidate prompt form
  and application instructions are imported into Settings.
- The dashboard, dock, candidate editor, and preview use light appearance. Dark
  palette controls are removed and older dark preferences are ignored.
- Both workers share one module entry point.
- Studio uses SpeedyApply profile data through a projection for its renderer.
  Canonical profile JSON exports use SpeedyApply's fields; old Studio records
  migrate with backups. See [profile alignment](profile-alignment.md).

No baseline files were changed. Autofill authentication, feature gates, and host
access are retained. Resume Studio adds capture/export permissions and private
candidate storage. Upstream domains, author attribution, and internal identifiers
retain their original names. See [the integration notes](resume-studio-integration.md).

## Architecture

All entry points are Chrome Manifest V3 extension pages or content scripts.

| Component | Responsibility |
| --- | --- |
| `service-worker.js` | Resume Studio coordinator and module entry point importing the Autofill worker |
| `background.js` | Autofill message routing, local/cloud data synchronization, selected profiles per tab, application capture, premium scoring, streamed generation |
| `content-scripts/content.js` | Platform adapters, field filling, job extraction, page overlays, cross-frame profile requests |
| `chunks/globals-BIOuRv6A.js` | Shared UI/runtime, validation, authentication, and storage helpers |
| `chunks/application-profile-field-DNaeSVYA.js` | Profile forms and shared field components |
| `chunks/options-DnVa9wE8.js` | SpeedyApply web pages, Overview route, and Studio preview navigation |
| `chunks/popup-iP45s0Yr.js` | Toolbar popup |
| `chunks/sidepanel-B9n05Ylx.js` | Retained original job-context and profile-selection panel |
| `studio/` | Editable dashboard components, private Studio storage, and navigation integration |

The content script contains 28 autofill adapter entries. Examples include
Workday, Greenhouse, Lever, SAP SuccessFactors, iCIMS, Workable, Rippling, Ashby,
SmartRecruiters, BambooHR, and Dayforce. These are shipped implementations;
current compatibility has not been established by loading them.

Local storage holds the profile, applied applications, reusable responses,
settings/configurations, daily goal, subscription cache, and sync metadata.
Background messages connect pages to those records. Child-frame requests are
relayed through the worker to the top-frame UI.

Cloud synchronization and premium requests go to `www.speedyapply.com/api/ext/`.
Authentication uses the supplied Supabase integration. The original server code
is absent. Broad page access and cookie access remain in the manifest because
the retained baseline uses them.

## Source migration boundaries

The baseline contains compiled output without source maps or a package manifest.
When adding maintainable source, migrate one working boundary at a time:

1. Manifest, extension-page shells, messaging, and local storage contracts.
2. Profiles, settings, reusable responses, and application records.
3. Platform detection and individual autofill adapters.
4. Tracking screens and analytics.
5. Server integration behind an explicitly configured provider.

The build currently copies `extension/` into `dist/autofill/`. It deliberately
does not pretend to compile the unavailable original source. A source bundler
can replace that step when the first source modules are introduced.
