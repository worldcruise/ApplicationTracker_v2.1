/**
 * Application Tracker: implemented app-owned data structures, 2026-11-12.
 * Documentation snapshot, not imported by the extension or a replacement validator.
 * Optional fields reflect legacy records and fields populated later in a workflow.
 * JsonObject means an intentionally extensible JSON payload, not an omitted entity.
 * Browser handles, provider tokens and third-party Autofill configuration are not
 * application domain entities. File handles are represented separately below.
 *
 * candidateId is the internal ID for the user's single profile.
 * Application.createdAt is the submission/recording time; no submittedAt field.
 * Live meeting details remain embedded/overlaid; the normalized repositories in
 * meeting-domain-contracts.ts are a proposal, not the implemented storage layout.
 */

export type ID = string;
export type Instant = string; // ISO 8601 UTC; legacy date strings noted separately.
export type Month = string;   // YYYY-MM where known; legacy profile input may vary.
export type Day = string;     // YYYY-MM-DD.
export type Json = null | boolean | number | string | Json[] | JsonObject;
export interface JsonObject { [field: string]: Json | undefined }
export type Dictionary<T> = Record<string, T>;

// PROFILE: canonical Autofill-compatible facts and uploaded resume.

export interface Profile {
  profileName: string;
  nameData: {
    firstName: string; lastName: string; preferredName: boolean;
    prefix?: string; middleName?: string; suffix?: string;
    preferredFirstName?: string; preferredMiddleName?: string; preferredLastName?: string;
  };
  addressData: {
    line1: string; line2?: string; city: string; state: string;
    postalCode: string; country: string;
  };
  contactData: {
    phoneDeviceType: string; phoneCountryCode: string;
    phoneNumber: string; email: string;
  };
  jobData: ProfileWork[];
  educationData: ProfileEducation[];
  languageData: { language: string; proficiency: string; fluent: boolean }[];
  skillsData: string[];
  resumeData: {
    resumeBase64: string; fileName: string; fileSize: number;
    dateUploaded: Instant | '';
  };
  websiteData: { websites: string[]; linkedin?: string; github?: string; personal?: string };
  employmentData: {
    gender: string; ethnicity: string;
    eligibilityUS?: boolean | 'undisclosed'; sponsorship?: boolean | 'undisclosed';
    disability?: boolean | 'undisclosed'; veteran?: boolean | 'undisclosed';
    hispanicOrLatino?: boolean | 'undisclosed'; age?: number | 'undisclosed';
  };
}
export interface ProfileWork {
  id?: ID; // Persisted across resume title/description updates; legacy IDs are retained.
  jobTitle: string; company: string; location: string;
  startDate: string; endDate?: string; currentlyWorkHere: boolean; description: string;
}
export interface ProfileEducation {
  id?: ID; // Independent of the mutable field of study.
  degreeName?: string; // Original credential, e.g. Bachelor of Science; degree is its level.
  school: string; degree: string; fieldOfStudy: string;
  currentlyAttending: boolean; startDate?: string; endDate?: string; gpa?: string;
}
export interface ProfileRecord {
  id: ID; profile: Profile; studio: StudioProfileExtras; revision: number;
  originalFilename: string; importedAt: Instant; createdAt: Instant;
  updatedAt: Instant; lastMutationId: string;
}
export interface StudioProfileExtras {
  additional?: JsonObject; candidate?: JsonObject; personalDetails?: JsonObject;
  professionalProfile?: JsonObject;
  roles?: { key: string; occurrence: number; id: ID; fields: JsonObject }[];
  education?: { key: string; occurrence: number; id: ID; fields: JsonObject }[];
  applicationPreferences?: ApplicationPreferences;
  customPromptInstructions?: Json[];
}
export interface ApplicationPreferences extends JsonObject {
  assignedPromptTemplateId?: ID;
  preferredDocumentTemplateId?: ID;
  exportDirectory?: string;
}

// STUDIO: profile projection, CV text, formatting and frozen document snapshots.

export interface CandidateDocument {
  schemaVersion: 1 | 2; kind: 'application-tracker-candidate';
  candidate: JsonObject & { id: ID; name: string };
  personalDetails?: JsonObject & {
    email?: string; phone?: string;
    address?: JsonObject;
    onlinePresence?: { linkedin: string; github: string; website: string };
  };
  companies?: (JsonObject & {
    id: ID; name: string; title: string; location?: string;
    startDate?: Month; endDate?: Month | null; current?: boolean;
    shortDetail?: string; highlights?: string[];
  })[];
  professionalProfile?: JsonObject & { skills?: string[]; education?: JsonObject[] };
  applicationPreferences?: ApplicationPreferences;
  customPromptInstructions?: Json[];
}
export interface CV {
  company: string; title: string; summary: string;
  skills: Record<string, string[]>[];
  experience: { title: string; company: string; sentences: string[] }[];
  education: { degree: string }[];
}
export interface DocumentTemplateRef { id: ID; version: number }
export interface DocumentTemplate extends DocumentTemplateRef {
  label?: string; settings?: JsonObject; [field: string]: unknown;
}
export interface ResumeBindings { experience: (ID | null)[]; education: (ID | null)[] }
export interface StudioDraft {
  schemaVersion: 1; id: ID; candidateId: ID | null; revision: number;
  captureId: ID | null; sourceUrl: string | null;
  jobInputKind: 'empty' | 'raw_capture' | 'job_description';
  jobInputRaw: string; cvJsonRaw: string;
  coverLetterEnabled: boolean; coverLetterRaw: string;
  documentTemplate: DocumentTemplateRef;
  formattingOverrides: JsonObject; templateOverrides?: Dictionary<JsonObject>;
  bindings: ResumeBindings;
}
export interface StoredDraft {
  draft: StudioDraft; userEdited: boolean;
  pendingCaptureId: ID | null; lastSeenCaptureId: ID | null;
  lastMutationId: string;
  bindingIdentities?: { experience: string[]; education: string[] };
}
export interface RenderProfileWork {
  id: ID; label: string; company: string; role: string;
  startDate: string; endDate: string; current: boolean; location: string;
}
export interface RenderProfileEducation {
  id: ID; label: string; degree: string; school: string;
  startDate: string; endDate: string; location?: string;
}
export interface Certification {
  id: ID; name: string; issuer: string; issuedOn: string; expiresOn: string; url: string;
}
export interface DocumentSnapshot {
  schemaVersion: 2; resumeContractVersion: 1;
  workspaceId: string; draftId: ID; documentRevision: number; candidateRevision: number;
  candidate: { id: ID; name: string };
  documentTemplate: DocumentTemplate; formattingOverrides: JsonObject;
  profile: {
    contact: string[]; links: string[]; experience: RenderProfileWork[];
    education: RenderProfileEducation[]; certifications?: Certification[];
  };
  bindings: ResumeBindings; resume: CV;
}
export interface PreparedResume {
  cvJsonRaw: string; coverLetterRaw: string; coverLetterEnabled: boolean;
  documentTemplate: DocumentTemplateRef; snapshot: DocumentSnapshot;
  inputRevision: number; candidateRevision: number; version: number; savedAt: Instant;
  export?: {
    ticketId: ID; bindingId: ID; companyFolder: string;
    fileName: string; state: string;
  };
}
export interface ParsedResume {
  schemaVersion: 1; source: { fileName: string; pageCount: number };
  profile: Partial<Profile>; sections: Dictionary<string[]>;
  rawText: string; warnings: string[];
}

// JOB QUEUE: editable job and prepared documents before submission.

export type QueueStatus = 'Queued' | 'Generating' | 'Ready' | 'Failed' | 'Applied';
// Applied queue rows stay internally linked but disappear from the active queue.
export type ApplicationStatus = 'applied' | 'screen' | 'interview' | 'offer' | 'rejected' | 'archived';
// archived is the legacy stored name for the Failed application column.
export interface RecordEvent { label: string; at: Instant }
export interface QueueJob {
  id: ID; type: 'queue'; candidateId: ID; candidateName: string; candidateRevision: number;
  company: string; role: string; salary: string; url: string;
  description: string; notes: string; conversationUrl: string;
  promptTemplateId: ID; promptSnapshot: PromptTemplate;
  status: QueueStatus; revision: number; inputRevision: number; attempt: number;
  resume: PreparedResume | null; resumeHistory: PreparedResume[];
  coverLetterRaw?: string; coverLetterEnabled?: boolean; error?: string;
  createdAt: Instant; updatedAt: Instant; deletedAt?: Instant;
  events: RecordEvent[]; submission?: { at: Instant }; applicationId?: ID;
  isMock?: boolean; // Compatibility marker; installed-mode cleanup removes these rows.
}

// APPLICATIONS: original submitted record plus private document/metadata overlay.

export interface RawApplication {
  id?: ID; applicationId?: ID;
  jobTitle: string; companyName: string; jobLink: string; companyLink: string;
  date: string; // Legacy submitted date, commonly Date.toString().
  createdAt?: Instant; updatedAt?: Instant; profileName: string; status: ApplicationStatus;
  salary?: string; notes?: string; description?: string; jobDescription?: string;
  resume?: PreparedResume | null; coverLetterRaw?: string; coverLetterEnabled?: boolean;
  meeting?: MeetingDetails; meetingHistory?: MeetingRecord[];
  conversationMessages?: Message[]; isMock?: boolean;
  [legacyField: string]: unknown;
}
export interface ApplicationMetadata {
  sourceAnchor: string; revision: number; updatedAt: Instant; createdAt?: Instant | null;
  candidateId?: ID; candidateName?: string; queueId?: ID;
  salary?: string; notes?: string; description?: string; conversationUrl?: string;
  resume?: PreparedResume | null; coverLetterRaw?: string; coverLetterEnabled?: boolean;
  events?: RecordEvent[]; syncWarning?: string;
  deletedRecord?: RawApplication; // Local restore payload, not a second application.
}
export interface ApplicationRecord {
  id: ID; type: 'applications'; revision: string; // Metadata revision + legacy fingerprint.
  candidateId: ID | null; candidateName: string; workflowApplicationId?: ID;
  company: string; role: string; url: string | null; status: ApplicationStatus;
  createdAt: Instant | null; // Submitted/recorded date, normalized from legacy date.
  updatedAt: string; salary: string; notes: string; description: string; conversationUrl: string;
  resume: PreparedResume | null; coverLetterRaw: string; coverLetterEnabled: boolean;
  events: RecordEvent[]; syncWarning: string; isMock: boolean;
}
export interface ImportReport {
  imported: number; skipped: number; failed: number;
  errors: { row: number; message: string }[];
}
export interface RecordMutationReceipt {
  signature: string; id: ID | null;
  deletedRecord?: ApplicationRecord | QueueJob; importReport?: ImportReport;
}
export interface JobRecordsStore {
  schemaVersion: 1;
  jobs: QueueJob[];
  applications: Dictionary<ApplicationMetadata>;
  aliases: Dictionary<ID>;
  receipts: Dictionary<RecordMutationReceipt>;
}
export interface RecordsResponse {
  candidate: { id: ID; name: string } | null;
  applications: ApplicationRecord[]; jobs: QueueJob[];
  selectedId?: ID | null;
  deletedRecord?: ApplicationRecord | QueueJob; importReport?: ImportReport;
}

// MEETINGS: current application overlay and retained appointment/history records.

export type MeetingKind = 'screen' | 'interview';
export type MeetingResult = 'pending' | 'passed' | 'failed';
export type MeetingLifecycle = 'draft' | 'scheduled' | 'completed' | 'cancelled' | 'no_show';
export type MeetingTopic = 'panel' | 'marathon' | 'final' | 'technical' | 'system_design' | 'live_coding' | 'behavioral' | 'cultural';
export type MeetingBadge = 'upcoming' | 'pending' | 'passed' | 'failed' | 'needs_action';
export interface Participant { name?: string; email?: string }
export interface Message {
  id: ID; meetingId?: ID; channel?: 'email' | 'chat' | 'note'; purpose?: 'follow_up' | 'general';
  sender: Participant; recipients: Participant[]; subject?: string;
  sentAt: Instant; body: string;
}
export interface PostMeetingReview {
  required: boolean; completedAt: Instant | null;
  transcriptUnavailableReason?: string; followUpNotRequiredReason?: string;
  followUp: Message | null;
}
export interface ScheduleSnapshot {
  kind?: MeetingKind; startsAt?: Instant | ''; endsAt?: Instant | '';
  mode?: 'phone' | 'video'; round?: number | null; interviewer?: string;
  topics?: MeetingTopic[]; phone?: string; joinUrl?: string; transcript?: string;
}
export interface ScheduleChange {
  id: ID; changedAt: Instant; reason: string; previous: ScheduleSnapshot | null;
  nextStartsAt: Instant; nextEndsAt: Instant;
}
export interface MeetingDetails {
  kind?: MeetingKind; round?: number | null; // Screening: null; interviews: 1–6.
  startsAt?: Instant | ''; endsAt?: Instant | ''; mode?: 'phone' | 'video';
  interviewer?: string; phone?: string; joinUrl?: string; topics?: MeetingTopic[];
  result?: MeetingResult; lifecycle?: MeetingLifecycle;
  transcript?: string; chatHistory?: string; messages?: Message[];
  review?: PostMeetingReview;
  rescheduled?: boolean; rescheduleReason?: string; scheduleHistory?: ScheduleChange[];
  history?: MeetingRecord[]; updatedAt?: Instant; applicationStage?: ApplicationStatus;
}
export interface MeetingRecord {
  id: ID; applicationId?: ID; companyName: string; jobTitle: string;
  jobLink?: string; companyLink?: string; profileName?: string;
  status: ApplicationStatus; date?: string; appliedAt?: string; updatedAt?: string;
  meeting?: MeetingDetails; meetingHistory?: MeetingRecord[];
  conversationMessages?: Message[]; outcomeReason?: string; isMock?: boolean;
  // Read-only rescheduled/history projections, not independently scheduled meetings:
  sourceMeetingId?: ID; historyOnly?: boolean; eventType?: 'rescheduled'; changedAt?: Instant | null;
}
// Upcoming, Needs action, today's totals, colors, previous-meeting projections,
// calendar positions and pipeline counts are computed; they are not source records.

// APPLY TO JOB: frozen inputs and per-window form-filling state.

export interface ApplyOptions {
  reuse: boolean; reviewAI: boolean; autoNext: boolean;
  saveAnswers: boolean; record: boolean; autoSubmit: boolean;
}
export interface FormField {
  id: string; key: string; label: string; type: string; kind: 'ai' | 'fact';
  required: boolean; filled: boolean; frameId: number; documentId?: string;
  answer: string; options: { value: string; label: string }[];
  [scanField: string]: unknown;
}
export interface ApplyFrame {
  frameId: number; documentId?: string; url?: string;
  nextAvailable?: boolean; submitAvailable?: boolean;
}
export interface ApplyRun {
  id: ID; windowId: number; jobId: ID; candidateId: ID;
  candidateRevision: number; inputRevision: number; resumeVersion: number;
  company: string; role: string; job: QueueJob; profile: Profile;
  phase: 'filling' | 'drafting' | 'questions' | 'ready' | 'paused' | 'cancelled' | 'error' | 'submission-pending' | 'submitted';
  epoch: number; step: 'setup' | 'autofill' | 'review'; message: string;
  tabId: number; targetUrl: string; fields: FormField[]; questions: FormField[];
  frames: ApplyFrame[]; drafts: Dictionary<string>; options: ApplyOptions;
  recordMutationId: ID; recordRequest?: JsonObject; applicationId?: ID;
  confirmedSubmission?: boolean; updatedAt: Instant;
}
export interface PendingProfileImport {
  token: ID; jobId: ID; inputRevision: number; resumeVersion: number | null;
  candidateId: ID; candidateRevision: number; profile: Profile;
}
export interface ApprovedAnswer {
  answer: string; candidateRevision: number; jobId?: ID; inputRevision?: number;
}

// PROMPTS, CAPTURES, IMPORT/EXPORT AND LOCAL FILE HANDLES.

export interface PromptTemplate { id: ID; title: string; text: string }
export interface PromptLibrary { revision: number; selectedId: ID; templates: PromptTemplate[] }
export interface PageCapture {
  schemaVersion: 1; id: ID; sourceTabId: number; sourceWindowId: number;
  sourceUrl: string; pageTitle: string; selectedCompanyHint: string | null;
  extractedCompanyName: string | null; rawPageText: string;
  capturedAt: Instant; truncated: boolean;
}
export interface StoredCapture {
  capture: PageCapture; candidateId: ID | null; expiresAt: number;
  status: string; clipboard: string;
}
export interface ExportSelection {
  snapshot: DocumentSnapshot; draftRevision: number; jobInputRaw: string;
  cvJsonRaw: string; coverLetterEnabled: boolean; coverLetterRaw: string;
  letter: { schemaVersion: 1; candidateId: ID; jobId: ID; paragraphs: string[] } | null;
  renderedAt: Instant; omitJobDescription?: boolean; destination?: ExportDestination;
}
export interface ExportDestination {
  bindingId: ID; candidateId: ID; preference: string; rootName: string; companyFolder: string;
}
export interface ExportFile {
  kind: string; filename: string; state: string;
  downloadId?: number; url?: string; attemptId?: ID; cleanupPending?: boolean;
  error?: string;
}
export interface ExportTicket {
  id: ID; fingerprint: string; candidateId: ID; candidateRevision: number;
  draftId: ID; draftRevision: number; documentRevision: number;
  createdAt: number; retryUntil: number; phase: string; message: string;
  selection?: ExportSelection; warning: string | null; destination?: ExportDestination;
  files: ExportFile[];
}
export interface DirectoryBinding {
  id: ID; candidateId: ID; name: string; preference: string;
  handle: FileSystemDirectoryHandle; // Structured-cloned local browser capability; not JSON/CSV.
}
export interface QueueCsvRow {
  Company: string; Role: string; 'Application link': string; Salary: string; JD: string;
}

// UI STATE: distinct from application facts and submitted documents.

export interface RecordsUI {
  tab: 'applications' | 'queue'; selected: ID | null;
  mode: 'description' | 'details'; editing: boolean; adding: boolean;
  drafts: Dictionary<{ revision?: number | string; fields: JsonObject }>;
  deleted: QueueJob | ApplicationRecord | null; query: string;
  layouts: { applications: 'cards' | 'list'; queue: 'cards' | 'list' };
}
export interface ApplyUI {
  jobId: ID | null; tabId: number; tailor: boolean; tailorPreferenceSet: boolean;
  step: 'setup' | 'autofill' | 'review'; question: string | null;
  answers: Dictionary<string>; remember: Dictionary<boolean>; options: Partial<ApplyOptions>;
}
export interface InlineDockGrant {
  token: string; documentId: string; collapsed: boolean;
  [bindingField: string]: unknown;
}
export interface WorkspaceBinding { windowId: number; instanceId: ID; visible: boolean }
export interface PreviewBinding {
  workspaceId: string; browserWindowId: number; routeId: ID;
  tabId: number | null; documentId: string | null; generation: string;
  documentRevision: number; draftId: ID | null; candidateId: ID | null;
  draftRevision: number; status: string; message: string; warning: string | null;
  snapshot: DocumentSnapshot | null;
}
export interface RequestEnvelope<T> {
  version: 1; operation: string; requestId: ID; payload: T;
  workspaceId?: string; workspaceInstanceId?: ID;
}
export type ResponseEnvelope<T> = {
  ok: true; requestId?: ID; result: T;
} | {
  ok: false; requestId?: ID;
  error: { code?: string; message: string; fieldPath?: string; currentRevision?: number };
};

// STORAGE INVENTORY: actual stores, not a single serialized application object.

export interface ChromeLocalData {
  profile?: Profile;
  appliedList?: RawApplication[];
  dailyGoal?: number;
  'ui-theme:v1'?: 'light' | 'dark';
  'meeting-details:v1'?: Dictionary<MeetingDetails>;
  'meeting-timezone:v1'?: string; // IANA zone or the supported system preference.
  'meeting-view:v1'?: 'calendar' | 'progress';
  'meeting-calendar-view:v1'?: 'day' | 'week' | 'month';
  'application-views:v1'?: { applications: 'list' | 'cards' | 'board'; queue: 'list' | 'cards' };
  // Legacy demo stores are retained only for compatibility/cleanup. Mock rows are removed.
  'meeting-mock-cards:v1'?: MeetingRecord[];
  'meeting-mock-cards:version'?: number;
  'meeting-application-overrides:v1'?: Dictionary<JsonObject>;
  'meeting-application-documents:v1'?: Dictionary<JsonObject>;
  'meeting-workflow-receipts:v1'?: Dictionary<string>;
}
export interface PrivateStudioData {
  // IndexedDB database autofill-resume-studio-v1, object store records.
  'active-candidate:v1'?: ID;
  'speedy-profile-registry:v1'?: number;
  'dock-job-records:v1'?: JobRecordsStore;
  'prompt-templates:v1'?: PromptLibrary;
  'default-export-root:v1'?: { id: ID; name: string };
  [key: `autofill-profile:${string}`]: ProfileRecord | undefined;
  [key: `dock-apply-run:v1:${number}`]: ApplyRun | undefined;
  [key: `dock-apply-ui:v1:${string}`]: ApplyUI | undefined; // windowId[:tabId].
  [key: `dock-apply-import:v1:${number}`]: PendingProfileImport | undefined;
  [key: `dock-approved-answers:v1:${string}`]: Dictionary<ApprovedAnswer> | undefined;
  [key: `dock-draft-backup:${string}`]: StudioDraft | undefined;
  // Profile migrations and resume replacement also retain backup records.
}
export interface ChromeSessionData {
  'captures:v1'?: ID[];
  'pdf-exports:v1'?: ID[];
  [key: `draft:${string}`]: StoredDraft | undefined; // unbound or candidate:<profileId>.
  [key: `capture:${string}`]: StoredCapture | undefined;
  [key: `pdf-export:${string}`]: ExportTicket | undefined;
  [key: `dock-records-ui:v1:${string}`]: RecordsUI | undefined; // windowId[:tabId].
  [key: `web-records-ui:v1:${number}`]: RecordsUI | undefined;
  [key: `web-application-detail:v1:${number}`]: RecordsUI | undefined;
  [key: `inline-dock:v1:${number}`]: InlineDockGrant | undefined;
  [key: `dock-workspace:v1:${number}`]: WorkspaceBinding | undefined;
  [key: `preview-tab:v1:${string}`]: PreviewBinding | undefined;
  // Capture notices and compatibility records also use this internal session area.
}
export interface ExportDirectoryDatabase {
  // IndexedDB database application-tracker-export-files-v1.
  roots: Dictionary<DirectoryBinding>;
  preferences: Dictionary<ID>; // Key: JSON.stringify([candidateId, preference]).
  receipts: Dictionary<JsonObject>; // Local filesystem-write receipts.
}

// INVARIANTS
// 1. One profile per account; candidateId is an internal compatibility name.
// 2. Editing/replacing the uploaded resume updates that same profile.
// 3. Queue documents can change. Submitted application documents remain fixed.
// 4. createdAt records application submission/creation; updatedAt records later edits.
// 5. Screening precedes interview progression; interview round is limited to 1–6.
// 6. Offer, Rejected and Failed are application outcomes, not meeting appointments.
// 7. Rescheduled slots keep their previous schedule and reason in scheduleHistory.
// 8. Manual follow-up records do not send email.
// 9. Queue CSV import/export contains only the five QueueCsvRow fields.
// 10. Installed-mode readers remove marked demos and never automatically seed them.
