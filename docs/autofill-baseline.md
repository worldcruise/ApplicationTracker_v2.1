# Current autofill workflow

The original injected SpeedyApply application runtime was removed during runtime cleanup. Active autofill lives in the maintained form bridge and uses the single local profile. Its platform submission observers have been restored separately from the supplied SpeedyApply source; see [submission integration](speedy-submission-integration.md) for the original functions and conflict handling.

## What the Autofill button does

1. Find the current employer tab. With a selected queued job, use its linked application tab; an empty queue uses the saved profile directly.
2. Inspect its form without entering values. Required questions and optional fields with known profile answers are selected by default; the user can deselect them.
3. Fill selected profile facts, reviewed answers, and saved reusable answers immediately. Existing values and dropdown searches are preserved.
4. Attach the current prepared resume when requested by the form. If no current tailored resume exists, use the original uploaded resume when available. Render documents only when needed; renderer failures leave those uploads manual and do not block the other fields.
5. Report remaining fields for manual entry or Draft answers with AI. The employer's Next and Submit buttons remain manual.

The AI needs-input alert tracks the specific unanswered questions from its batch. Entering an answer in the dock immediately updates its count; completing those questions on the employer page also clears it, including while the popup is closed. Empty multiple-choice selections remain unanswered. The alert is scoped to its job and employer tab.

Submission progress takes priority over empty-form help. While awaiting confirmation, the popup shows the submission status. Once the existing observers confirm submission, both the header and popup show **Application submitted**, fill controls are hidden, and completed forms are no longer inspected. This state follows the same application's confirmation redirect and clears when the tab moves to another job. An empty or missing form alone never marks an application submitted.

Autofill works with an empty queue and before document generation. Its controls stay visible independently of the selected job card. Filling a form does not move the job to Applications. For a selected queued job, the confirmation observer or explicit Confirm submitted action records a submission once; an outdated generated resume is excluded from the submitted record. Profile-only filling does not create records. On supported platforms, the restored original submission observer records a subsequent submission directly in Applications, independently of the dock and queue, when recording is enabled.

To record an application manually, open a queued job's **Details** and choose **Mark as applied** below **Edit**. The dashboard's queue detail offers the same action below **Update record**. Both use the existing revision-checked transfer: the job leaves the active queue, its current documents and saved job details are frozen into an Applied application, and repeated requests do not create duplicates. A resume is optional for manual recording; an independently saved cover letter is retained. The action records locally and does not submit the employer's form. Unsaved dashboard edits must be saved or discarded first.

Switching applications keeps Autofill available. Clicking it validates the new target, stops the previous fill, and starts the selected form with one request. Delayed work from the old run cannot write more fields or replace the new run's state. Previous pending submissions keep their document-bound observers and persist separately until a receipt arrives, including across worker restarts.

## Supported facts and controls

Contact details, phone country code, address, websites, saved employment preferences and explicit eligibility answers, existing education and work-history fields, and skills use deterministic profile mapping. Repeated history sections use their corresponding profile records; missing records are not replaced with the first record. Dates split into month and year when the form requests separate fields.

Native inputs, selects, radio groups, Greenhouse React Select/Select2 controls, ATS button-based listboxes, and resume/cover-letter upload fields are supported. Consents and unknown or ambiguous questions remain manual. New education or work-history sections are not created automatically.

Choice widgets are scanned as logical questions. A native Select2 control owns its proxy search box; a custom combobox owns its nested search controls and explicitly linked popup; listbox option checkboxes are not separate application questions. Native multiple selects, ARIA multi-selects, and checkbox sets with an explicit shared question expose one multi-choice editor. All selected values travel together as a JSON array encoded in the answer string, while the popup displays their readable labels. Existing choices remain untouched during bulk fill; manual replacement validates the available choices before changing the control. Separate questions with identical labels remain independent, and consent fields stay separate.

Form inspection includes open shadow roots and HTTP-origin `about:blank`/`about:srcdoc` application frames. Labels resolve within the field's own root; hidden hosts and opaque sandboxed frames are excluded. Single-field web components can supply their outer label. Native input/change events cross shadow boundaries so employer listeners receive the changes.

Address mapping supports `address-line1`, `address-line2`, and the full multiline `street-address` autocomplete token. Street suggestions can append city/state/postal information, including Google-style address menus; the saved street must match the suggestion's street portion. Autofill clicks that matching option so the employer's own address handler can synchronize related fields. Different house numbers and active user searches are preserved, and unrelated hidden job IDs never count as the street's answer.

Document uploads include hidden native file inputs inside a visible upload control. Both input and change events are dispatched, and replacement controls are discovered after employer re-renders. Resume and cover letter are attached independently; rejected file types and upload errors remain visible in the autofill popup instead of being silently skipped.

## Active code

| Module | Responsibility |
| --- | --- |
| extension/studio/autofill-profile.js | Saved profile facts, education and work-history mapping |
| extension/studio/dock-apply-form.js | Form scan, selection, native value events and uploads |
| extension/studio/apply-form-dom.js | Open-shadow discovery, composed ancestry and root-local labels |
| extension/studio/apply-choice-fields.js | Choice ownership, grouped questions and multi-value selection |
| extension/studio/apply-form-widgets.js | Dropdown selection and committed-value verification |
| extension/studio/dock-apply-service.js | Tab ownership, manual runs, document preparation and submission tracking |
| extension/ai-apply/src/autofill-workspace.mjs | Dock popup, field selectors, reviewed drafts and manual actions |
| src/dock-apply-content.js | Isolated content-script entry |
| extension/studio/speedy-submission-rules.js | Original platform selectors, routes and navigation windows |
| extension/studio/speedy-submission-adapters.js | Original metadata extraction and progress stages |
| extension/studio/speedy-submission-tracker.js | Passive, dock-independent platform observers |
| extension/studio/speedy-submission-service.js | Progress persistence and shared submission-recording bridge |

See [runtime architecture](runtime-architecture.md) for the rest of the extension.
