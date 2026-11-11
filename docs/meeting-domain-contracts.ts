// Proposed domain contracts. Design only: not imported by the extension.
export type ID = string;
export type Instant = string; // ISO 8601 UTC, ending in Z.
export type TimeZone = string; // Valid IANA zone, e.g. America/New_York.
export type Partition = 'live' | 'mock';
export type ApplicationStage = 'applied' | 'screen' | 'interview' | 'offer' | 'rejected' | 'archived';
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
  sourceRefs: Array<{ system: string; sourceId: string }>;
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
  schedule: Schedule;
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
  reason: string | null;
  recordedAt: Instant; // Import time is not represented as the original event time.
  occurredAt: Instant | null;
}

export interface ApplicationStageChange extends Entity {
  applicationId: ID;
  from: ApplicationStage;
  to: ApplicationStage;
  occurredAt: Instant;
}

export interface Transcript extends Entity {
  applicationId: ID;
  meetingId: ID;
  rawText: string;
  segments: Array<{ offsetMs: number | null; speaker: string | null; text: string }>;
  source: 'manual' | 'import' | 'mock';
}

// The application is the conversation boundary. A meeting is an optional link.
export interface ConversationMessage extends Entity {
  applicationId: ID;
  meetingId: ID | null;
  sourceThreadId: string | null;
  sourceMessageId: string | null;
  channel: 'email' | 'chat' | 'note';
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
  startsAt: Instant | null;
  endsAt: Instant | null;
  tags: VisibleMeetingTag[];
  round: number | null;
  hasChatHistory: true; // Capability; an empty conversation is still available.
  hasPreviousMeetingsTab: boolean; // True only for interviews.
  previousMeetingCount: number;
  canOpenPreviousMeetings: boolean; // True only when count > 0.
  transcriptAvailable: boolean;
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
  hasChatHistory: true;
  // Intentionally no round, meeting time range, join action, or meeting tags.
}

export interface BoardProjection {
  serverNow: Instant; // Service-worker clock; not a claim of a remote server.
  timeZone: TimeZone;
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

export interface PreviousMeetingProjection {
  currentMeetingId: ID;
  applicationId: ID;
  previousMeetings: Meeting[];
  // Only earlier, elapsed, non-cancelled meetings from this application.
  // Transcript content is loaded separately for the selected previous meeting.
}

export interface MutationEnvelope<T> {
  version: 1;
  operation: string;
  requestId: ID;
  payload: T & { mutationId: ID; expectedRevision: number };
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
