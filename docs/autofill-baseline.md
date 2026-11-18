# Current autofill workflow

The dock's Apply to Job workspace has one Autofill button. It starts filling directly; there is no form popup, question editor, AI draft action, profile shortcut, or manual submission-confirmation control in this section. The saved job, document previews and AI chat elsewhere in the workspace remain available.

## Button behavior

- Autofill uses the current employer tab and selected queued job. With an empty queue, it uses the existing single profile.
- Clicking the button invokes the existing engine without restricting it to fields selected in a sidebar editor. The engine fills known profile facts and saved reusable answers, and attaches available documents.
- While filling, the button is disabled and reads Filling. An interrupted run can be resumed with the same button; another employer tab can take over an old run.
- The button reads Submitting while the existing submission observers await confirmation, then Submitted after confirmation. Submission disables filling for that application. Changing to another employer page re-enables Autofill.
- Errors and status details are available in the button's tooltip instead of separate helper messages. Idle UI updates read the run status without scanning or rendering a second copy of the employer's form.

## Engine and submission ownership

Document rendering, uploaded-profile-resume fallback, reusable answer storage, platform submission observers and recording preferences remain in place. The interface waits for an initial passive binding to finish before starting a fill, avoiding competing Start and Track requests.

Dropdowns open their actual control, search when necessary, activate the matching option, and wait for its committed value. Existing search text is not treated as a selected answer. University fields also wait for institution suggestions; change/blur validation runs after selection so entering a search query does not prematurely invalidate the institution. Native selects, custom button menus and multi-selects keep their own acceptance checks. User edits made while options are loading are preserved, and an ambiguous or unaccepted match remains pending.

Employer Next and Submit actions remain manual. An empty or missing form alone never records an application. The existing confirmation observers record a submission once and update Applications. On supported platforms, submission tracking works independently of the dock or an Autofill run when recording is enabled. Profile-only filling retains its existing recording policy.

Manual recording remains available from a queued job's Details through Mark as applied. Submitted documents remain frozen in Applications; documents are editable in Job Queue before submission.

## Maintained files

| File | Responsibility |
| --- | --- |
| extension/ai-apply/src/autofill-workspace.mjs | Single button, request sequencing, run status, and native workspace connection |
| extension/ai-apply/src/tracker.css | Apply workspace and button styling |
| extension/studio/dock-apply-service.js | Shared profile, documents, run lifecycle and recording |
| extension/studio/dock-apply-form.js | Employer form scan, values, choices and uploads |
| extension/studio/apply-navigation.js | Apply, Next, Submit and confirmation signals |
| extension/studio/speedy-submission-tracker.js | Dock-independent platform submission observation |

See [submission integration](speedy-submission-integration.md) and [runtime architecture](runtime-architecture.md).
