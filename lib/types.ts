// ── Email validation ──────────────────────────────────────────────────────────

export type EmailIssueType =
  | "auto_fixed_whitespace"   // leading/trailing/internal spaces were stripped
  | "auto_fixed_case"         // address was lowercased
  | "invalid_syntax"          // doesn't pass structural regex — row is skipped
  | "domain_typo"             // domain looks like a misspelling of a known domain
  | "duplicate";              // same cleaned address appears more than once in the batch

export interface EmailValidationResult {
  original: string;           // raw value straight from the source sheet
  clean: string;              // normalised value (trimmed + lowercased)
  issues: EmailIssueType[];
  suggestion?: string;        // corrected email when domain_typo is detected
  valid: boolean;             // false = row is skipped; true = import proceeds with clean
}

export interface ImportValidationSummary {
  autoFixed: number;          // rows where whitespace / casing was silently corrected
  invalid: number;            // rows skipped due to bad syntax
  domainTypos: number;        // rows flagged for likely domain typo (still imported)
  duplicates: number;         // rows skipped because the cleaned email appeared earlier
  details: EmailValidationResult[];  // only rows that had at least one issue
}

// Contact import from an external Google Sheet
export interface ImportParams {
  sourceSheetId: string;
  sourceRange: string;          // e.g. "Form Responses 1!A:Z"
  emailColumn: string;          // column header in source sheet that holds email
  nameColumn?: string;          // optional — maps to FullName
  phoneColumn?: string;         // optional — maps to Phone
  interestTag: string;          // tag appended/added to Interest column
  administrativeTags?: string[]; // optional — appended to Administrative column
}

export interface ImportResult {
  tagged: number;
  inserted: number;
  skipped: number;
  errors: string[];
  taggedEmails: string[];              // emails that had the tag appended (for undo)
  insertedEmails: string[];            // emails inserted as new rows (for undo)
  validation?: ImportValidationSummary; // email hygiene report; present on fresh imports
}

export interface ImportLog {
  id: string;
  timestamp: string;      // ISO8601
  params: ImportParams;
  tagged: number;
  inserted: number;
  skipped: number;
  errors: string[];
  taggedEmails: string[];
  insertedEmails: string[];
  remark: string;
  undone: boolean;
}

// Raw row parsed from Google Sheet
export interface SheetContact {
  email: string;
  fullName: string;
  memberId: string;
  membership: string;
  membershipModifier: string;
  phone: string;
  note: string;
  createdAt: string;
  updatedAt: string;
  changedId: string;
  // Multi-select tag columns — stored as arrays after parsing
  interest: string[];
  facility: string[];
  skill: string[];
  administrative: string[];
  // Birthday milestone columns (optional — sent as merge fields, not tags)
  bday: string;
  bday18: string;
  bday21: string;
  bday25: string;
  bday30: string;
  // Sailing Academy and Training date columns
  saJoinDate: string;
  saGradDate: string;
  tJoinDate: string;
  tGradDate: string;
  rowIndex: number;
}

// Result of syncing a single contact to Mailchimp
export interface ContactSyncResult {
  email: string;
  status: "new" | "updated" | "error";
  error?: string;
}

// One complete sync run, stored in KV and displayed in the log table
export interface SyncLog {
  id: string;
  timestamp: string;
  triggered_by: "webhook" | "cron" | "manual";
  total_contacts: number;       // total rows in sheet
  contacts_processed: number;   // after incremental filter
  new_added: number;
  updated: number;
  errors: number;
  error_details: string[];
  duration_ms: number;
  status: "success" | "partial" | "error" | "skipped";
}

// Cron attempt record — written at start of every GET /api/sync call
export interface CronStatus {
  hit_at: string;
  result: "checking" | "auth_failed" | "skipped_schedule" | "lock_busy" | "started" | "completed" | "error";
  error?: string;
}

// Aggregate KPI stats — single KV key for fast dashboard reads
export interface SyncStats {
  total_ever_synced: number;
  last_sync_at: string | null;
  last_sync_status: SyncLog["status"] | "never";
  last_new_added: number;
  last_updated: number;
  last_errors: number;
  cron_status?: CronStatus | null; // injected by sync-stats API, not stored in this KV key
}

// Response shape for GET /api/sync-logs
export interface SyncLogsResponse {
  logs: SyncLog[];
  total: number;
}

// Aggregated audience statistics computed from the sheet on each sync
export interface AudienceStats {
  computed_at: string;
  total_mailchimp_members: number;  // subscribed only
  total_unsubscribed: number;       // unsubscribed count from Mailchimp
  total_sheet_contacts: number;     // sheet row count
  membership: Record<string, number>;
  membership_modifier: Record<string, number>;
  tags: {
    interest: Record<string, number>;
    facility: Record<string, number>;
    skill: Record<string, number>;
    administrative: Record<string, number>;
  };
}

export interface AudienceStatsResponse {
  current: AudienceStats | null;
  previous: AudienceStats | null;
}

// Daily new-contact growth data — current window + previous window for comparison
export interface GrowthStats {
  last30Days: number;   // new contacts in most-recent 30 days
  last60Days: number;   // new contacts in most-recent 60 days
  prev30Days: number;   // new contacts in the 30 days before that (days 31–60)
  prev60Days: number;   // new contacts in the 60 days before that (days 61–120)
  dailyNew: { date: string; value: number }[]; // 120 entries, chronological
}

// Member trend — cumulative member counts over time
export interface MemberTrendEntry {
  date: string;        // "YYYY-MM-DD"
  active: number;      // qualifying members minus resigned & absent
  resigned: number;    // subset with Resigned modifier
  absent: number;      // subset with Absent modifier
  non_member: number;  // contacts with Non_Member membership type
}

export interface MemberTrendStats {
  computed_at: string;
  current: { total: number; active: number; resigned: number; absent: number; non_member: number };
  daily: MemberTrendEntry[];  // chronological, up to 90 entries
}

// Mailchimp campaign categories
export type CampaignCategory = "Weekly What's On" | "Member Notice" | "Standalone EDM";

// Single campaign report record
export interface CampaignRecord {
  id: string;
  subject: string;
  sent_time: string;        // ISO8601
  emails_sent: number;
  opens: number;            // unique opens
  open_rate: number;        // 0–1
  clicks: number;           // unique clicks
  click_rate: number;       // 0–1 (CTR)
  unsubscribes: number;
  category: CampaignCategory;
}

// API response shape for GET /api/campaigns
export interface CampaignStats {
  campaigns: CampaignRecord[];
  totals: {
    count: number;
    total_sent: number;
    avg_open_rate: number;  // 0–1
    avg_ctr: number;        // 0–1
  };
}

// ── Content Studio ────────────────────────────────────────────────────────────

export interface StudioDraft {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  input: {
    objective: ContentObjective;
    events: StudioEvent[];
    additionalNotes: string;
  };
  output?: { subject: string; html: string; campaignUrl?: string };
  status: "draft" | "trash";
  deletedAt?: string;
}

export interface StudioEvent {
  title: string;
  datetime: string;
  details: string;
  eventCategory: string;  // "F&B" | "Sailing Event" | "Club News" | "Marine" | ""
  eventType: string;      // predefined chip value or custom text
  ctaUrl: string;
  ctaLabel: string;
}

export type ContentObjective = "open_rate" | "click_rate" | "re_engage";

export interface StudioInput {
  objective: ContentObjective;
  events: StudioEvent[];
  additionalNotes: string;
  subjectOnly?: boolean;
  ctaLabelOnly?: boolean;     // generate CTA label for a single event
  ctaLabelEventIndex?: number;
}

export interface StudioOutput {
  subject: string;
  html: string;
  campaignUrl?: string;
}

// ── Lifecycle Tracking ─────────────────────────────────────────────────────────

export type LifecycleStage = "new" | "active" | "cold" | "dead";

export interface LifecycleStageCounts {
  new:    number;
  active: number;
  cold:   number;
  dead:   number;
  total:  number;
}

export interface LifecycleHistoryEntry {
  date:   string;              // "YYYY-MM-DD"
  stages: LifecycleStageCounts;
}

export interface LifecycleStats {
  computed_at: string;
  current:     LifecycleStageCounts;
  healthScore: number;         // 0–100, pre-computed
  history:     LifecycleHistoryEntry[];  // max 90 entries, chronological
  fetchError?: string;         // set when Mailchimp unsubscribed fetch failed
}

// ── User-configured auto-sync schedule ────────────────────────────────────────

export type ScheduleInterval = -1 | 0 | 30 | 60 | 360 | 720 | 1440; // -1 = real-time (Apps Script), 0 = manual only

export interface SyncSchedule {
  interval_minutes: ScheduleInterval;
  updated_at: string;
}

export interface SyncProgress {
  phase: "fetching" | "comparing" | "syncing";
  processed: number;
  total: number;       // changed contacts — used for bar fill
  sheet_total?: number; // all contacts in sheet — used for label denominator
  started_at: string;
}

// ── Mailchimp Automations ──────────────────────────────────────────────────────

export type AutomationStatus = "sending" | "paused" | "save";

export interface MailchimpAutomation {
  id: string;
  title: string;
  status: AutomationStatus;
  emails_sent: number;
  started: number | null;
  in_progress: number | null;
  completed: number | null;
  start_time: string | null;
  workflow_type: string;
}

export interface MailchimpAutomationsResponse {
  automations: MailchimpAutomation[];
  total_items: number;
  computed_at: string;
}

// ── Survey Insights 2026 ───────────────────────────────────────────────────────

export interface SurveyAreaStat {
  label: string;
  satisfaction: number;
  importance: number;                              // normalised 0–1
  importance_source: "direct" | "priority_frequency";
  count: number;
}

export interface SurveySegmentStat {
  count: number;
  avg_satisfaction: number;
  nps_score: number;
  top_priorities: string[];
  low_sample: boolean;
}

export interface SurveyActionItem {
  priority_rank: number;
  priority_score: number;
  issue: string;
  evidence: string;
  recommended_action: string;
  owner: string;
  timing: "0–3m" | "3–6m" | "6–12m" | "Long-term";
}

export interface CommentTheme {
  theme: string;
  count: number;
  sentiment: { positive: number; neutral: number; negative: number };
  examples: string[];
}

export interface SurveyDataQuality {
  r1_rows: number;
  r2_rows: number;
  matched_complete: number;
  unmatched_r1: number;
  unmatched_r2: number;
  join_method: string;
  missing_fields: string[];
}

export interface SurveyInsights {
  computed_at: string;
  total_responses: number;
  data_quality: SurveyDataQuality;

  avg_satisfaction: number;
  satisfaction_dist: Record<string, number>;
  pct_satisfied: number;
  pct_dissatisfied: number;

  area_stats: SurveyAreaStat[];

  nps_score: number;
  avg_nps_raw: number;
  nps_dist: { promoters: number; passives: number; detractors: number };

  by_membership_category: Record<string, SurveySegmentStat>;
  by_tenure: Record<string, SurveySegmentStat>;
  by_visit_freq: Record<string, SurveySegmentStat>;
  by_usage_type: Record<string, SurveySegmentStat>;
  by_nps_group: Record<string, SurveySegmentStat>;

  top_priorities: { label: string; count: number; pct: number }[];

  comm_channels: { label: string; count: number; pct: number }[];
  comm_info_wanted: { label: string; count: number; pct: number }[];
  comm_satisfaction: number;
  website_rating: number;
  membership_value: number;
  referral_aware: { yes: number; no: number; pct_aware: number };
  avg_referral_attractive: number;
  referral_attractive_dist: Record<string, number>;
  avg_privilege_value: number;
  privilege_value_dist: Record<string, number>;
  privilege_not_aware_n: number;

  tenure_dist: Record<string, number>;
  visit_freq_dist: Record<string, number>;
  usage_type_dist: Record<string, number>;
  membership_category_dist: Record<string, number>;
  improvement_trend_dist: Record<string, number>;

  comment_themes: CommentTheme[];
  comment_count: number;
  comments: { segment?: string; lang?: "en" | "zh"; text: string }[];

  action_items: SurveyActionItem[];
}

// ── Membership Lifecycle ───────────────────────────────────────────────────────

export interface MembershipContact {
  memberId: string;
  fullName: string;
  email: string;
  membership: string;
  date: string;        // display-formatted date for this specific event
  daysUntil: number;   // positive = future, negative = past (overdue)
  eventType: string;   // e.g. "Birthday", "18th Birthday", "SA Graduation", "Term Expiry"
}

export interface MembershipStats {
  computed_at: string;
  totalWithAnyDate: number;      // contacts where at least one date field is non-empty
  totalWithCoreDates: number;    // contacts with bday + all 4 milestone BDAYs filled
  upcomingBirthdays30: {
    count: number;
    contacts: MembershipContact[];
  };
  upcomingAgeTier90: {
    count: number;
    contacts: MembershipContact[];
  };
  upcomingSAEligible180: {
    count: number;
    contacts: MembershipContact[];
  };
  upcomingTermExpiry120: {
    count: number;
    contacts: MembershipContact[];
  };
  overdueFollowUps: {
    count: number;
    contacts: MembershipContact[];
  };
}
