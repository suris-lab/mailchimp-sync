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

// Aggregate KPI stats — single KV key for fast dashboard reads
export interface SyncStats {
  total_ever_synced: number;
  last_sync_at: string | null;
  last_sync_status: SyncLog["status"] | "never";
  last_new_added: number;
  last_updated: number;
  last_errors: number;
}

// Response shape for GET /api/sync-logs
export interface SyncLogsResponse {
  logs: SyncLog[];
  total: number;
}

// User-configured auto-sync schedule
export type ScheduleInterval = -1 | 0 | 30 | 60 | 360 | 720 | 1440; // -1 = real-time (Apps Script), 0 = manual only

export interface SyncSchedule {
  interval_minutes: ScheduleInterval;
  updated_at: string;
}
