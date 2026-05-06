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
  total_mailchimp_members: number;  // live from Mailchimp API
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

// Daily new-contact growth data — current window + previous window for comparison
export interface GrowthStats {
  last30Days: number;   // new contacts in most-recent 30 days
  last60Days: number;   // new contacts in most-recent 60 days
  prev30Days: number;   // new contacts in the 30 days before that (days 31–60)
  prev60Days: number;   // new contacts in the 60 days before that (days 61–120)
  dailyNew: { date: string; value: number }[]; // 120 entries, chronological
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
