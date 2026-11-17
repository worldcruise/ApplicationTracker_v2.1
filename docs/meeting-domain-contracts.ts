// Proposed domain contracts. Design only: not imported by the extension.
export type ID = string;
export type Instant = string; // ISO 8601 UTC, ending in Z.
export type TimeZone = string; // Valid IANA zone, e.g. America/New_York.
export type Partition = 'live' | 'mock';
export type ApplicationStage = 'applied' | 'screen' | 'interview' | 'offer' | 'rejected' | 'archived'; // archived displays as Failed.
export type MeetingResult = 'pending' | 'passed' | 'failed';
export type MeetingStatusBadge = 'upcoming' | 'needs_action' | MeetingResult; // Upcoming/Needs action are derived, never saved results.
export type MeetingTopic = 'panel' | 'marathon' | 'final' | 'technical' | 'system_design' | 'live_coding' | 'behavioral' | 'cultural';
export type VisibleMeetingTag = 'phone' | 'video' | 'rescheduled' | MeetingTopic;

export interface Entity {
  id: ID;
  partition: Partition;
  revision: number;
  createdAt: Instant;
  updatedAt: Instant;
  deletedAt: Instant | null;
}

export interface Application extends Entity {
  profileId: ID; // One active profile; no profile-switching feature required.
  companyName: string;
  jobTitle: string;
  jobUrl: string | null;
  stage: ApplicationStage;
  stageChangedAt: Instant;
  appliedAt: Instant | null;
  salary: string | null;
  submittedDocumentsId: ID | null; // No edit/replace operation after submission.
  sourceRefs: Array<{ system: string; sourceId: string }>;
}

export interface SubmissionDocuments {
  readonly id: ID;
  readonly applicationId: ID;
  readonly partition: Partition;
  readonly createdAt: Instant;
  readonly submittedAt: Instant | null; // Unknown legacy submission dates stay unknown.
  readonly sourceQueueJobId: ID | null;
  readonly candidateSnapshot: Readonly<Record<string, unknown>>;
  readonly resume: {
    readonly cvJsonRaw: string;
    readonly snapshot: Readonly<Record<string, unknown>>;
    readonly documentTemplate: Readonly<Record<string, unknown>>;
  } | null;
  readonly coverLetterRaw: string | null;
}

export interface Participant {
  id: ID;
  name: string | null;
  address: string | null; // Email, phone, or provider handle; never inferred.
  role: 'candidate' | 'recruiter' | 'interviewer' | 'other' | 'unknown';
}

export type Schedule = {
  state: 'confirmed';
  startsAt: Instant;
  endsAt: Instant;
  enteredTimeZone: TimeZone;
} | {
  state: 'needs_review'; // Legacy timestamps or an unfinished draft.
  startsAt: Instant | null;
  endsAt: Instant | null;
  enteredTimeZone: TimeZone | null;
  missing: Array<'startsAt' | 'endsAt' | 'timeZone'>;
};

export interface MeetingBase extends Entity {
  applicationId: ID;
  sequence: number; // Stable progression order within this application.
  sessionIndex: number; // Multiple panel/marathon sessions may share a round.
  lifecycle: 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  result: MeetingResult; // Completed can remain Pending while awaiting feedback.
  resultRecordedAt: Instant | null;
  resultNote: string | null;
  reviewPolicy: 'required' | 'legacy_optional'; // Assigned on creation/migration; not a generic editable field.
  schedule: Schedule;
  scheduleVersion: number; // Starts at 1; increments on actual reschedule, not display/format changes.
  channel: 'phone' | 'video' | null;
  topics: MeetingTopic[];
  participants: Participant[];
  phoneNumber: string | null;
  joinUrl: string | null;
}

export type Meeting = MeetingBase & (
  { kind: 'screening'; round: null } |
  { kind: 'interview'; round: 1 | 2 | 3 | 4 | 5 | 6 }
);

export interface ScheduleChange extends Entity {
  applicationId: ID;
  meetingId: ID;
  type: 'rescheduled' | 'legacy_rescheduled_marker';
  previousSchedule: Schedule | null; // Null when the old schedule is unknown.
  nextSchedule: Schedule;
  previousScheduleVersion: number | null;
  nextScheduleVersion: number;
  reason: string | null;
  recordedAt: Instant; // Import time is not represented as the original event time.
  occurredAt: Instant | null;
}

export interface ApplicationStageChange extends Entity {
  applicationId: ID;
  from: ApplicationStage;
  to: ApplicationStage;
  occurredAt: Instant;
  reason: string | null;
  sourceMeetingId: ID | null;
}

export interface Transcript extends Entity {
  applicationId: ID;
  meetingId: ID;
  scheduleVersion: number;
  rawText: string;
  segments: Array<{ offsetMs: number | null; speaker: string | null; text: string }>;
  source: 'manual' | 'import' | 'mock';
  sourceFilename: string | null;
}

// One review per meeting/schedule version. No copied body or stored counter.
export interface PostMeetingReview extends Entity {
  applicationId: ID;
  meetingId: ID;
  scheduleVersion: number;
  completedAt: Instant | null;
  transcriptUnavailableReason: string | null;
  followUpMessageId: ID | null;
  followUpNotRequiredReason: string | null; // Mutually exclusive with followUpMessageId.
}

export type AttentionReason = 'transcript_missing' | 'follow_up_missing' | 'review_unconfirmed';
export interface PostMeetingProjection {
  eligible: boolean; // Confirmed ended schedule, required policy, not draft/cancelled/no-show/deleted.
  needsAction: boolean;
  reasons: AttentionReason[];
  transcript: { state: 'missing' } | { state: 'available'; transcriptId: ID; revision: number }
    | { state: 'unavailable'; reason: string };
  followUp: { state: 'missing' } | { state: 'recorded'; messageId: ID; revision: number }
    | { state: 'not_required'; reason: string };
  reviewRevision: number; // 0 if not created.
  completedAt: Instant | null;
}

// Previous transcript/message bodies are retained before overwrite or removal.
export interface ContentRevision {
  id: ID;
  partition: Partition;
  applicationId: ID;
  entityType: 'transcript' | 'message';
  entityId: ID;
  revision: number;
  savedAt: Instant;
  content: Transcript | ConversationMessage;
}

// The application is the conversation boundary. A meeting is an optional link.
export interface ConversationMessage extends Entity {
  applicationId: ID;
  meetingId: ID | null;
  meetingScheduleVersion: number | null; // Required for a qualifying follow-up; general chat may have no slot.
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  sourceProvider: string | null;
  importBatchId: ID | null;
  importEntryId: ID | null;
  channel: 'email' | 'chat' | 'note';
  direction: 'outgoing' | 'incoming' | 'unknown';
  subject: string | null; // Required for a new manually recorded follow-up email.
  purpose: 'general' | 'follow_up';
  evidence: 'user_confirmed' | 'imported' | 'mock' | null;
  sender: Participant;
  recipients: Participant[];
  sentAt: Instant;
  bodyText: string;
}

export interface LegacyFragment extends Entity {
  applicationId: ID | null;
  meetingId: ID | null;
  type: 'conversation' | 'unclassified_meeting_metadata';
  sourceKey: string;
  sourceRecordId: string;
  rawText: string;
  rawMetadata: Record<string, unknown> | null;
  reason: 'missing_timestamp' | 'missing_application_link' | 'unknown_meeting_kind';
}

export interface MeetingPreferences {
  schemaVersion: 1;
  timeZone: TimeZone | 'system';
  hourCycle: 'h23';
}

export type TemporalState = 'upcoming' | 'ongoing' | 'past' | 'unscheduled' | 'cancelled';
export interface MeetingCardProjection {
  entityType: 'meeting';
  applicationId: ID;
  meetingId: ID;
  column: 'screen' | 'interview';
  companyName: string;
  jobTitle: string;
  temporalState: TemporalState;
  statusBadge: MeetingStatusBadge | null; // Null for drafts/cancelled/no-show; shared labels and colors in every view.
  timeAnnotation: 'in_progress' | 'not_scheduled' | null; // Ongoing is not Pending yet.
  review: PostMeetingProjection; // Independent attention flag may accompany Passed/Failed.
  startsAt: Instant | null;
  endsAt: Instant | null;
  tags: VisibleMeetingTag[];
  round: number | null;
  hasChatHistory: true; // Capability; an empty conversation is still available.
  hasPreviousMeetingsTab: boolean; // Every screening and interview, even with empty history.
  previousTabLabel: 'Previous meetings';
  previousMeetingCount: number; // Display history includes rescheduled slots; not a completed-round count.
  canOpenPreviousMeetings: boolean; // True only when count > 0.
  transcriptAvailable: boolean;
  canEditTranscript: boolean; // Canonical meeting resolved, slot ended, not cancelled/draft.
  allowedActions: WorkflowAction[];
  joinAction: { kind: 'phone'; phoneNumber: string } | { kind: 'video'; url: string } | null;
  border: { visible: boolean; tone: 'accent' | 'light' };
}

export interface ApplicationCardProjection {
  entityType: 'application';
  applicationId: ID;
  column: 'offer' | 'rejected' | 'archived';
  companyName: string;
  jobTitle: string;
  stageChangedAt: Instant;
  updatedAt: Instant; // Display Last updated, not a fabricated appointment date.
  hasChatHistory: true;
  hasPreviousMeetingsTab: boolean; // Offer/Failed true; Rejected false.
  previousMeetingCount: number;
  allowedActions: WorkflowAction[];
  needsActionMeetingCount: number; // Historical meeting tasks; this card is still an application.
  // Intentionally no round, meeting time range, join action, or meeting tags.
}

export interface ApplicationQuery {
  partition: Partition;
  query: string; // Normalized literal tokens, each matches company OR role.
  stage: ApplicationStage | 'all';
  period: 'all' | 'month' | 'week' | '3days' | '24hours' | 'custom';
  timeZone: TimeZone;
  fromDate: string | null; // YYYY-MM-DD; custom appliedAt range, not meeting dates.
  toDate: string | null;
  sortBy: 'updatedAt' | 'appliedAt' | 'companyName' | 'jobTitle';
  direction: 'asc' | 'desc';
  cursor: string | null; // Bound to query/filter/sort and partition.
  limit: number;
}

export interface ApplicationListItem {
  applicationId: ID;
  revision: number;
  companyName: string;
  jobTitle: string;
  stage: ApplicationStage;
  salary: string | null;
  appliedAt: Instant | null;
  updatedAt: Instant;
  resumeAvailable: boolean;
  coverLetterAvailable: boolean;
  needsActionMeetingCount: number;
  updateMode: WorkflowContext['mode'];
}

export interface ApplicationQueryResult {
  items: ApplicationListItem[];
  filteredCount: number;
  totalCount: number;
  nextCursor: string | null;
  attention: AttentionSummary; // Global partition count, not filteredCount.
}

export interface AttentionSummary {
  partition: Partition;
  computedAt: Instant;
  meetingCount: number; // Count unique meeting IDs, not missing fields or application IDs.
  nextBoundaryAt: Instant | null; // A projection hint; every read uses current time.
}

export interface AttentionItem {
  applicationId: ID;
  meetingId: ID;
  scheduleVersion: number;
  applicationStage: ApplicationStage; // May be a closed stage with unfinished historical work.
  companyName: string;
  jobTitle: string;
  kind: Meeting['kind'];
  round: Meeting['round'];
  sessionIndex: number;
  endsAt: Instant;
  reasons: AttentionReason[];
  meetingRevision: number;
  reviewRevision: number;
}

export interface AttentionListResult {
  summary: AttentionSummary;
  snapshotId: ID;
  items: AttentionItem[]; // Oldest end first, then sequence/session/ID; same snapshot on paging.
  nextCursor: string | null;
}

// UI session state; does not mark tasks resolved. Sensitive draft text is stored separately.
export interface AttentionReviewSession {
  id: ID;
  partition: Partition;
  snapshotId: ID;
  orderedMeetingIds: ID[];
  scheduleVersions: Record<ID, number>;
  currentIndex: number;
  visitedMeetingIds: ID[];
  skippedMeetingIds: ID[];
  hasNewItems: boolean;
  origin: { route: string; query: string; filters: Record<string, string>; selectedId: ID | null; scrollTop: number };
}

export interface BoardProjection {
  serverNow: Instant; // Service-worker clock; not a claim of a remote server.
  timeZone: TimeZone;
  attention: AttentionSummary;
  groups: [
    { id: 'active'; columns: ['screen', 'interview'] },
    { id: 'closed'; columns: ['rejected', 'archived'] },
    { id: 'offers'; columns: ['offer'] },
  ];
  columns: Record<'screen' | 'interview', {
    cards: MeetingCardProjection[];
    initialFocusMeetingId: ID | null;
    hasMoreBefore: boolean;
    hasMoreAfter: boolean;
  }> & Record<'offer' | 'rejected' | 'archived', { cards: ApplicationCardProjection[] }>;
}

export type PreviousMeetingHistoryEntry = {
  type: 'meeting';
  meeting: Meeting;
} | {
  type: 'rescheduled';
  meetingId: ID;
  kind: Meeting['kind'];
  round: Meeting['round'];
  change: ScheduleChange; // Original time/reason; includes superseded future slots and unknown legacy times.
};

export interface PreviousMeetingProjection {
  currentMeetingId: ID;
  applicationId: ID;
  label: 'Previous meetings';
  entries: PreviousMeetingHistoryEntry[]; // One chronological collection for screenings and interviews.
  // Earlier elapsed appointments plus ALL retained reschedules of those and the current appointment.
  // Rescheduled slots display their reason under Transcript, never count as attended/action items.
  // Ordinary transcript content is loaded separately for the selected meeting/schedule version.
}

export interface MutationEnvelope<T> {
  version: 1;
  operation: string;
  requestId: ID;
  payload: T & { mutationId: ID }; // Each command lists every entity revision it checks.
}

export interface WorkflowAction {
  id: 'complete_meeting' | 'next_step' | 'record_follow_up' | 'schedule_screening' | 'set_schedule' | 'reschedule' | 'record_result' | 'schedule_interview' | 'schedule_next_round' | 'add_session' | 'set_outcome' | 'correct_stage' | 'edit_transcript' | 'add_message' | 'cancel_meeting' | 'mark_no_show';
  label: string;
  enabled: boolean;
  unavailableReason: string | null;
}

export interface WorkflowContext {
  applicationId: ID;
  applicationRevision: number;
  meetingId: ID | null;
  meetingRevision: number | null;
  meetingScheduleVersion: number | null;
  mode: 'advance' | 'post_meeting' | 'manage_schedule' | 'view_record' | 'needs_review';
  primaryAction: WorkflowAction | null;
  secondaryActions: WorkflowAction[];
  review: PostMeetingProjection | null;
  nextStep: { kind: Meeting['kind']; round: Meeting['round']; existingMeetingId: ID | null } | null;
  prerequisiteMeetingIds: ID[]; // Service rechecks ended/reviewed + explicit Passed confirmation on save.
  computedAt: Instant;
}

// IDs, sequence, kind and next round are assigned by the service, not trusted from the caller.
export interface MeetingDraftFields {
  lifecycle: 'draft' | 'scheduled';
  schedule: Schedule;
  channel: 'phone' | 'video' | null;
  phoneNumber: string | null;
  joinUrl: string | null;
  participants: Participant[];
  topics: MeetingTopic[];
}

export interface AdvanceApplicationInput {
  applicationId: ID;
  expectedApplicationRevision: number;
  next: 'screening' | 'interview' | 'next_round';
  meeting: MeetingDraftFields;
  // Next step from Pending includes explicit successful-result confirmations.
  // All sessions must be ended/reviewed; already Passed ones need no new result.
  passedResults: Array<{ meetingId: ID; expectedMeetingRevision: number; resultNote: string | null }>;
}

export interface RescheduleMeetingInput {
  applicationId: ID;
  meetingId: ID;
  expectedMeetingRevision: number;
  schedule: Extract<Schedule, { state: 'confirmed' }>;
  reason: string;
  previousSlotDidNotOccur: boolean; // Required true if the old slot already ended; completed meetings cannot be moved.
}

export interface ManualFollowUpFields {
  sender: Participant;
  recipients: Participant[];
  subject: string;
  bodyText: string;
  sentAt: Instant; // Actual sent time; meeting end <= sentAt <= now.
  confirmedAlreadySent: true; // A local user assertion, not provider verification or an outbound send.
}

export type TranscriptResolutionInput = {
  kind: 'save';
  expectedTranscriptRevision: number; // 0 on create; unique meeting/schedule version constraint.
  rawText: string;
  segments: Transcript['segments'];
  source: Transcript['source'];
  sourceFilename: string | null;
} | {
  kind: 'existing'; transcriptId: ID; expectedTranscriptRevision: number;
} | {
  kind: 'unavailable'; reason: string;
};

export type FollowUpResolutionInput = {
  kind: 'manual'; email: ManualFollowUpFields;
} | {
  kind: 'existing'; messageId: ID; expectedMessageRevision: number; confirmedAlreadySent: true;
} | {
  kind: 'not_required'; reason: string;
};

export interface CompleteMeetingReviewInput {
  applicationId: ID;
  expectedApplicationRevision: number;
  meetingId: ID;
  expectedMeetingRevision: number;
  expectedScheduleVersion: number;
  expectedReviewRevision: number;
  transcript: TranscriptResolutionInput;
  followUp: FollowUpResolutionInput;
  // Atomic content + review + completion. Undecided remains Pending; Passed/Failed is preserved.
}

export interface WorkflowDraft extends Entity {
  applicationId: ID;
  meetingId: ID;
  scheduleVersion: number;
  contextId: ID; // Keep drafts from different editors/tabs from overwriting each other silently.
  baseRevisions: Record<ID, number>;
  transcriptText: string;
  transcriptUnavailableReason: string;
  followUp: Partial<Omit<ManualFollowUpFields, 'confirmedAlreadySent'>> & { confirmedAlreadySent: boolean };
  selectedFollowUpMessageId: ID | null;
  followUpNotRequiredReason: string;
  // Private editor state only: excluded from chat/transcript queries and completion predicates.
}

export interface ReviewExceptionInput {
  meetingId: ID;
  expectedMeetingRevision: number;
  expectedReviewRevision: number;
  transcriptUnavailableReason?: string;
  followUpNotRequiredReason?: string;
  // Explicit decisions during outcome recording, not automatic suppression of reminders.
}

export interface AddMeetingSessionInput {
  applicationId: ID;
  expectedApplicationRevision: number;
  sameStepAsMeetingId: ID;
  expectedMeetingRevision: number;
  meeting: MeetingDraftFields;
}

export interface SetMeetingResultInput {
  applicationId: ID;
  expectedApplicationRevision: number;
  meetingId: ID;
  expectedMeetingRevision: number;
  result: MeetingResult;
  note: string | null;
  cancelMeetingIds: Array<{ meetingId: ID; expectedMeetingRevision: number }>;
  reviewExceptions: ReviewExceptionInput[];
}

export interface SetApplicationOutcomeInput {
  applicationId: ID;
  expectedApplicationRevision: number;
  outcome: 'offer' | 'rejected' | 'archived';
  occurredAt: Instant;
  reason: string | null;
  cancelMeetingIds: Array<{ meetingId: ID; expectedMeetingRevision: number }>;
  reviewExceptions: ReviewExceptionInput[];
}

export interface SaveTranscriptInput {
  applicationId: ID;
  meetingId: ID;
  expectedMeetingRevision: number;
  expectedScheduleVersion: number;
  expectedTranscriptRevision: number; // 0 means create, unique (meetingId, scheduleVersion).
  rawText: string;
  segments: Transcript['segments'];
  source: Transcript['source'];
  sourceFilename: string | null;
}

export interface SaveMessageInput {
  applicationId: ID;
  meetingId: ID | null;
  meetingScheduleVersion: number | null;
  messageId: ID | null; // Null creates; retries use mutationId.
  expectedMessageRevision: number; // 0 on creation.
  sender: Participant;
  recipients: Participant[];
  sentAt: Instant;
  channel: ConversationMessage['channel'];
  direction: ConversationMessage['direction'];
  subject: string | null;
  purpose: ConversationMessage['purpose'];
  evidence: ConversationMessage['evidence'];
  bodyText: string;
  sourceProvider: string | null;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
}

export interface WorkflowMutationResult {
  applicationId: ID;
  applicationRevision: number;
  stage: ApplicationStage;
  meetingIds: ID[];
  revisions: Record<ID, number>;
  invalidatedApplicationIds: ID[]; // Clients refetch projections; no history bodies broadcast.
  invalidatedMeetingIds: ID[];
  attention: AttentionSummary;
  workflow: WorkflowContext;
}

export interface MigrationManifest {
  schemaVersion: 1;
  status: 'prepared' | 'committed' | 'bridge_pending' | 'complete';
  revision: number;
  applicationMap: Record<string, ID>; // Namespaced source key -> canonical UUID.
  meetingMap: Record<string, ID>;
  importedSourceIds: string[];
  unresolvedSourceIds: string[];
  backupKey: string;
}
