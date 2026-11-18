# Current autofill workflow

The native dock's Apply to Job workspace has equally sized Autofill and Draft answers with AI buttons, followed by an inline Application form accordion. The saved job, document previews and AI chat elsewhere in the workspace remain available. This section has no separate status messages or employer-page notifications.

## Button behavior

- Autofill uses the current employer tab and selected queued job. With an empty queue, it uses the existing single profile.
- Clicking Autofill invokes the existing engine for all available fields, including explicit edits made in the form review. The engine fills known profile facts and saved reusable answers, and attaches available documents. The AI-selection checkboxes do not restrict Autofill.
- While filling, the button is disabled and reads Filling. An interrupted run can be resumed with the same button; another employer tab can take over an old run.
- The button reads Submitting while the existing submission observers await confirmation, then Submitted after confirmation. Submission disables filling for that application. Changing to another employer page re-enables Autofill.
- Errors and status details are available in button tooltips instead of separate helper messages. While the form review is expanded, passive inspection keeps answers and filled checks synchronized with the employer page. Closing the form bar stops idle inspection. Confirmed submission hides the form review and stops inspection for that application.
- Autofill does not inject progress or status notifications onto employer pages.

## Form review and AI drafts

Each question occupies one collapsed row. Its answer editor opens when the row is clicked. The right-hand check turns white in a green circle only after the employer field accepts its answer; accepted rows collapse automatically. Drafts remain editable until Autofill applies them. Existing employer answers stay unchanged unless the user explicitly edits that answer in the review and clicks Autofill.

Hovering over a question number reveals its AI-selection checkbox; keyboard focus and touch also expose the selector. Required unanswered questions are selected by default. Optional questions can be selected manually. File uploads, individual consent checkboxes and already-filled fields are excluded from AI drafting.

Draft answers with AI uses the selected saved job's conversation and retained ChatGPT/DeepSeek adapters. It sends one batch of selected questions, collects separate `{question, answer}` JSON objects, and puts the results into the answer editors. Resume and candidate source data are not appended. Profile-only Autofill still works without a queued job; AI drafting requires a saved job.

The request retains its question selection and form context. Switching jobs never routes old answers into the new job. Employer answers and manual edits made while waiting take precedence over returned AI drafts. Reconnecting to a waiting batch requires the same selected questions. No AI answer is written onto the employer page until Autofill is clicked.

## Engine and submission ownership

Document rendering, uploaded-profile-resume fallback, reusable answer storage, platform submission observers and recording preferences remain in place. The interface waits for an initial passive binding to finish before starting a fill, avoiding competing Start and Track requests.

Dropdowns open their actual control, search when necessary, activate the matching option, and wait for its committed value. Existing search text is not treated as a selected answer. University fields also wait for institution suggestions; change/blur validation runs after selection so entering a search query does not prematurely invalidate the institution. Native selects, custom button menus and multi-selects keep their own acceptance checks. User edits made while options are loading are preserved, and an ambiguous or unaccepted match remains pending.

Employer Next and Submit actions remain manual. An empty or missing form alone never records an application. The existing confirmation observers record a submission once and update Applications. On supported platforms, submission tracking works independently of the dock or an Autofill run when recording is enabled. Profile-only filling retains its existing recording policy.

Manual recording remains available from a queued job's Details through Mark as applied. Submitted documents remain frozen in Applications; documents are editable in Job Queue before submission.

## Maintained files

| File | Responsibility |
| --- | --- |
| extension/ai-apply/src/autofill-workspace.mjs | Autofill and AI actions, inspection, answer retrieval, and native workspace connection |
| extension/ai-apply/src/autofill-form-review.mjs | Question accordions, selection, answer drafts, and verified filled checks |
| extension/ai-apply/src/tracker.css | Apply workspace and button styling |
| extension/studio/dock-apply-service.js | Shared profile, documents, run lifecycle and recording |
| extension/studio/dock-apply-form.js | Employer form scan, values, choices and uploads |
| extension/studio/question-answer-chat.js | Selected-question prompts, provider adapters, and answer validation |
| extension/studio/apply-navigation.js | Apply, Next, Submit and confirmation signals |
| extension/studio/speedy-submission-tracker.js | Dock-independent platform submission observation |

See [submission integration](speedy-submission-integration.md) and [runtime architecture](runtime-architecture.md).
