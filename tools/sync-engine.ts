import { randomUUID } from "crypto";
import type { SyncLog, SyncStats, SyncSchedule, SheetContact } from "@/lib/types";
import { fetchSheetContacts } from "./google-sheets";
import { upsertContacts } from "./mailchimp-upsert";
import { kvGet, kvSet, kvLpush } from "@/lib/kv";

const KV_KNOWN_EMAILS = "sync:known_emails";
const KV_STATS = "sync:stats";
const KV_LOG_IDS = "sync:log_ids";
const KV_SCHEDULE = "sync:schedule";

export async function shouldSkipCronSync(): Promise<boolean> {
  const schedule = await kvGet<SyncSchedule>(KV_SCHEDULE);
  if (!schedule || schedule.interval_minutes <= 0) return true;

  const stats = await kvGet<SyncStats>(KV_STATS);
  if (!stats?.last_sync_at) return false;

  const elapsed = (Date.now() - new Date(stats.last_sync_at).getTime()) / 60_000;
  return elapsed < schedule.interval_minutes;
}

// Parse date strings including DD/MM/YYYY (common in HK/AU sheets)
function parseDate(s: string): number {
  if (!s) return NaN;
  let t = new Date(s).getTime();
  if (!isNaN(t)) return t;
  // DD/MM/YYYY or D/M/YYYY
  const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmy) {
    t = new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`).getTime();
    if (!isNaN(t)) return t;
  }
  return NaN;
}

// Filter to contacts changed since the last sync using the UpdatedAt column.
// Falls back to the full list when UpdatedAt is missing or unparseable.
function filterChanged(contacts: SheetContact[], lastSyncAt: string | null): SheetContact[] {
  if (!lastSyncAt) return contacts; // first run — sync everything

  const lastSyncMs = new Date(lastSyncAt).getTime();
  if (isNaN(lastSyncMs)) return contacts;

  return contacts.filter((c) => {
    if (!c.updatedAt) return true; // no date — include to be safe
    const updatedMs = parseDate(c.updatedAt);
    return isNaN(updatedMs) || updatedMs >= lastSyncMs;
  });
}

export async function runSync(triggeredBy: SyncLog["triggered_by"]): Promise<SyncLog> {
  const start = Date.now();
  const id = randomUUID();

  let total_contacts = 0;
  let contacts_processed = 0;
  let new_added = 0;
  let updated = 0;
  let errors = 0;
  const error_details: string[] = [];
  let status: SyncLog["status"] = "success";

  try {
    // 1. Fetch all contacts from Google Sheets
    const allContacts = await fetchSheetContacts();

    // 2. Load previous stats to get last sync time for incremental filtering
    const prevStats = (await kvGet<SyncStats>(KV_STATS)) ?? {
      total_ever_synced: 0,
      last_sync_at: null,
      last_sync_status: "never" as const,
      last_new_added: 0,
      last_updated: 0,
      last_errors: 0,
    };

    // 3. Incremental: only process contacts updated since last sync
    total_contacts = allContacts.length;
    const contacts = filterChanged(allContacts, prevStats.last_sync_at);
    contacts_processed = contacts.length;

    if (contacts.length > 0) {
      // 4. Upsert to Mailchimp (merge fields + tags, concurrency-limited)
      const knownEmailsArr = (await kvGet<string[]>(KV_KNOWN_EMAILS)) ?? [];
      const knownEmails = new Set(knownEmailsArr.map((e) => e.toLowerCase()));

      const results = await upsertContacts(contacts, knownEmails);

      for (const r of results) {
        if (r.status === "new") new_added++;
        else if (r.status === "updated") updated++;
        else if (r.status === "error") {
          errors++;
          if (error_details.length < 10) error_details.push(`${r.email}: ${r.error}`);
        }
      }

      // 5. Update known emails
      const successEmails = results
        .filter((r) => r.status !== "error")
        .map((r) => r.email.toLowerCase());
      const updatedKnown = Array.from(new Set([...knownEmailsArr, ...successEmails]));
      await kvSet(KV_KNOWN_EMAILS, updatedKnown);
    }

    if (errors > 0 && errors < contacts_processed) status = "partial";
    else if (contacts_processed > 0 && errors === contacts_processed) status = "error";
  } catch (err) {
    status = "error";
    error_details.push(String(err));
    errors = contacts_processed || 1;
  }

  const log: SyncLog = {
    id,
    timestamp: new Date().toISOString(),
    triggered_by: triggeredBy,
    total_contacts,
    contacts_processed,
    new_added,
    updated,
    errors,
    error_details,
    duration_ms: Date.now() - start,
    status,
  };

  await kvSet(`sync:log:${id}`, log);
  await kvLpush(KV_LOG_IDS, id);

  const prevStats2 = (await kvGet<SyncStats>(KV_STATS)) ?? {
    total_ever_synced: 0,
    last_sync_at: null,
    last_sync_status: "never" as const,
    last_new_added: 0,
    last_updated: 0,
    last_errors: 0,
  };

  await kvSet(KV_STATS, {
    total_ever_synced: prevStats2.total_ever_synced + new_added,
    last_sync_at: log.timestamp,
    last_sync_status: log.status,
    last_new_added: new_added,
    last_updated: updated,
    last_errors: errors,
  } satisfies SyncStats);

  return log;
}
