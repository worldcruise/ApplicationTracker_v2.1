# SpeedyApply profile alignment

Autofill keeps the active profile at `chrome.storage.local.profile`, in the
structure used by SpeedyApply 2.28.2. Resume Studio no longer stores a second
candidate document as the source of autofill facts. Its existing renderer receives
a temporary projection from `studio/profile-model.js`.

| SpeedyApply field | Studio use |
| --- | --- |
| `profileName` | Stored profile alias for history and synchronization |
| `nameData` | Candidate display name and document heading; preferred names are respected |
| `contactData` | Email and phone |
| `addressData` | Contact address |
| `websiteData` | Resume links |
| `jobData` | Experience, dates, descriptions and stable row bindings |
| `educationData` | Education, degree/field of study and dates |
| `skillsData` | Professional skills |
| `resumeData`, `employmentData`, `languageData` | Preserved in canonical profiles and JSON exports; not inserted into Studio prompts |

Profiles in the private `autofill-resume-studio-v1` IndexedDB catalog use keys
`autofill-profile:<id>`. Each stores `profile` in SpeedyApply's shape, revision
metadata and a `studio` object for features absent from that schema: summaries,
certifications, projects, prompt instructions, document preferences and row
annotations. These are metadata, not another persisted candidate document.

Candidate selectors, headers, profile summaries and application cards display the
complete name derived from `nameData`, including middle names. Display labels do
not rename profile aliases, change profile IDs or rewrite historical applications.
`studio/profile-display.js` resolves legacy aliases to saved candidates only when
the match is unambiguous and refreshes visible labels when profile data changes.

The active catalog entry mirrors the existing local profile. Edits from
SpeedyApply refresh the catalog and Studio, advancing the revision so stale edits
cannot overwrite newer data. Choosing a saved profile activates its canonical
object for SpeedyApply as well. Existing remote services and premium profile
limits retain their original implementation; the adapter does not provision or
replace those services.

On first use, old `candidate:<id>` records migrate to canonical catalog entries.
Their original records remain under `candidate-backup:profile-alignment:<id>`.
An existing SpeedyApply profile takes precedence and is preserved. If no local
profile exists, the selected old candidate can initialize it. Deleted catalog
entries retain a private `profile-backup:deleted:<id>` backup.

Upload JSON accepts SpeedyApply profiles (including a `profile` wrapper) and old
Studio candidate JSON up to the inherited 2 MiB limit. Replacing different saved
content requires its current revision. Save JSON exports the canonical SpeedyApply
profile, while Studio-only metadata and migration backups stay in private storage.
No data is read from another installed extension.

`scripts/sync-profile-values.mjs` extracts the country, degree, language and
employment choice values from the unchanged SpeedyApply baseline. The tests cover
profile round-trips, preservation of resume and employment data, migration,
replacement conflicts, live web-page edits, and an actual PDF from SpeedyApply data.
