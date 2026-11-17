# SpeedyApply submission integration

The reference is the supplied **SpeedyApply 2.28.2** package. The original content script uses platform-specific submission observers and metadata extractors. Its Yf helper sends saveApplication; background dh writes appliedList and lh checks duplicates by title, URL, company URL, calendar day and profile.

The current failure had two causes: most original platform-specific success observers had been removed, and profile-only Autofill intentionally never wrote Applications. The remaining path covered generic receipts and a Workday success proof. A supported employer page also had no submission observer until a queue job was bound. Those gaps differed from the original platform observers.

## Restored source rules

All entries below are sourced from Baseline/SpeedyApply/content-scripts/content.js. Original function names are retained as source identifiers in speedy-submission-rules.js.

| Platform | Original functions | Submission signal |
| --- | --- | --- |
| workday | wI / xI | Review-page controls; existing successful-finalize proof |
| greenhouse | oN / iN / JM / Uj | Submit then navigation within 5 seconds |
| lever | IN / UN | div.thanks |
| successfactors | fF / dF | #applyConfirmMsg |
| icims | SN / CN | .iCIMS_SuccessMessage with original text match |
| workable | HF / qF | [data-ui="successful-submit"] |
| rippling | MP / OP / AP / Uj | Submit then navigation within 5 seconds |
| breezy | Kj / Qj / Uj | Submit then navigation within 5 seconds |
| jazzhr | wN / kN / Uj | Submit then navigation within 5 seconds |
| ashby | Ej / Oj | h2 with original text match |
| smartrecruiters | QP / $P | oc-success-page-content |
| paylocity | eP / tP | #appSubmitResponseDiv |
| freshteam | NM / RM | #applicant-success:not(.hide) |
| dover | _M / yM | div with original text match |
| pinpoint | hP / yP | p with original text match |
| comeet | $j / nM | p with original text match |
| gusto | sN / lN | li:nth-child(3) span with original text match |
| polymer | bP / SP | h2 with original text match |
| adp | yj / Tj | #vdlContainerFluid .success-message-container |
| jobvite | AN / PN | .jv-page-applyconfirm |
| ultipro | jF / MF | #ApplicationSubmitted |
| tesla | pF / _F | div[class*="Confirmation_"] |
| tiktok | xF / kF | Original confirmation route |
| eightfold | MM / jM / TM | [data-test-id="success-form"],h2#form-submission-success-message |
| seek | NP / BP | #applicationSent |
| bamboohr | Lj / zj | a with original text match |
| dayforce | hM / gM | div[test-id="success-dayforce-jobs"] |
| indeed | KI | Original confirmation route |
| linkedin | eL / nL / rL | div[aria-labelledby="post-apply-modal"] |
| naukri | iL / Uj | Submit then navigation within 5 seconds |
| phenom | aP / mP / Uj | Submit then navigation within 30 seconds |

The Naukri sendMsg path retains the original eight-second navigation window. LinkedIn supports the original regular and interop shadow-root success modal. Comeet retains the original nested POSITION_DATA parsing.

## Integration and conflict handling

The maintained observer ports the original selectors, metadata normalization, route detection and submit/departure fallback. It starts independently of the dock and does not fill or click employer controls. Existing Autofill remains manual.

Both observer paths use the same serialized Applications service. A matching queued job is converted once, retaining its saved documents. A supported submission without a queue becomes an application directly, using the single saved profile. No placeholder queue job is created. Original local appliedList fields are preserved, with createdAt and current tracker metadata added. Canonical ATS identities prevent embedded/regular URLs and duplicate observer events from incrementing the count twice.

Original remote account synchronization is outside the local tracking path. The single profile, current records store, recording preference and existing UI remain authoritative. Turning recording off prevents the original observers from adding applications.

The original Workday xI function saved on the Review-page button click. This conflicts with the existing successful-finalize check. Review detection and progress are restored, while the existing proof or confirmation receipt determines when the count increases. This prevents a rejected Workday request from being counted as an application.

SpeedyApply's Uj fallback for the listed platforms still uses a recent submit followed by page departure. Its original five/30-second windows are preserved. Native invalid-field events cancel the attempt. This is the supplied version's navigation fallback, rather than a new universal success heuristic.

Progress persists per browser tab and reports the current original platform stage, submission in progress, validation problems and the recorded outcome. The dock refreshes on submission changes. Dashboard and Applications continue reading appliedList, so the local save immediately updates their counts.

## Verification

speedy-submission.test.mjs covers the original success markers, all source adapter references, embedded Greenhouse metadata, Comeet parsing, departure timing, validation, Workday success proof, recording preferences, queue conversion and duplicate observer events. Apply workspace tests cover visible progress without an Autofill run and switching browser tabs. Isolated Chrome tests use local synthetic employer pages; they do not submit real applications.
