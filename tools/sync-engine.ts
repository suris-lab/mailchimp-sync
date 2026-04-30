import { randomUUID, createHash } from "crypto";
import type { SyncLog, SyncStats, SyncSchedule, SheetContact } from "@/lib/types";
import { fetchSheetContacts, getSheetModifiedTime } from "./google-sheets";
import { upsertContacts } from "./mailchimp-upsert";
import { kvGet, kvSet, kvLpush } from "@/lib/kv";

const KV_STATS = "sync:stats";
const KV_LOG_IDS = "sync:log_ids";
const KV_SCHEDULE = "sync:schedule";
const KV_CONTACT_FP = "sync:contact_fingerprints";
const KV_SHEET_MODIFIED = "sync:sheet_modified_at";

export async function shouldSkipCronSync(): Promise<boolean> {
  const schedule = await kvGet<SyncSchedule>(KV_SCHEDULE);
  if (!schedule || schedule.interval_minutes <= 0) return true;

  const stats = await kvGet<SyncStats>(KV_STATS);
  if (!stats?.last_sync_at) return false;

  const elapsed = (Date.now() - new Date(stats.last_sync_at).getTime()) / 60_000;
  return elapsed < schedule.interval_minutes;
}

// Hash every meaningful field so any change to any column triggers a resync.
// Does NOT rely on the UpdatedAt column being maintained in the sheet.
function fullFingerprint(c: SheetContact): string {
  const raw = [
    c.email, c.fullName, c.memberId, c.membership, c.membershipModifier,
    c.phone, c.note, c.createdAt, c.updatedAt, c.changedId,
    ...c.interest, ...c.facility, ...c.skill, ...c.administrative,
  ].join("|");
  return createHash("md5").update(raw).digest("hex");
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
    // 1. Check if the sheet has been modified since the last sync.
    //    If not, skip everything — no rows fetched, no Mailchimp calls.
    const sheetModifiedAt = await getSheetModifiedTime();
    const lastSheetModifiedAt = await kvGet<string>(KV_SHEET_MODIFIED);

    if (sheetModifiedAt && sheetModifiedAt === lastSheetModifiedAt) {
      const log: SyncLog = {
        id,
        timestamp: new Date().toISOString(),
        triggered_by: triggeredBy,
        total_contacts: 0,
        contacts_processed: 0,
        new_added: 0,
        updated: 0,
        errors: 0,
        error_details: [],
        duration_ms: Date.now() - start,
        status: "skipped",
      };
      await kvSet(`sync:log:${id}`, log);
      await kvLpush(KV_LOG_IDS, id);

      const prevStats = (await kvGet<SyncStats>(KV_STATS)) ?? {
        total_ever_synced: 0,
        last_sync_at: null,
        last_sync_status: "never" as const,
        last_new_added: 0,
        last_updated: 0,
        last_errors: 0,
      };
      await kvSet(KV_STATS, {
        ...prevStats,
        last_sync_at: log.timestamp,
        last_sync_status: "skipped",
      } satisfies SyncStats);

      return log;
    }

    // 2. Fetch all contacts from Google Sheets
    const allContacts = await fetchSheetContacts();
    total_contacts = allContacts.length;

    // 3. Load saved fingerprints — compare every contact against last known state
    const savedFp = (await kvGet<Record<string, string>>(KV_CONTACT_FP)) ?? {};
    const isFirstRun = Object.keys(savedFp).length === 0;

    const contacts = allContacts.filter((c) => {
      const fp = fullFingerprint(c);
      return savedFp[c.email.toLowerCase()] !== fp;
    });
    contacts_processed = contacts.length;

    if (contacts.length > 0) {
      // 4. Upsert changed contacts to Mailchimp.
      // On first run (no fingerprints yet) skip tag API calls — merge fields only.
      // Tags sync on the next run when fingerprints exist and only a small
      // number of changed contacts need processing.
      const results = await upsertContacts(contacts, new Set(), isFirstRun);

      const updatedFp: Record<string, string> = { ...savedFp };
      for (const r of results) {
        if (r.status === "new") {
          new_added++;
          // Save fingerprint for newly added contacts
          const c = contacts.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
          if (c) updatedFp[r.email.toLowerCase()] = fullFingerprint(c);
        } else if (r.status === "updated") {
          updated++;
          const c = contacts.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
          if (c) updatedFp[r.email.toLowerCase()] = fullFingerprint(c);
        } else if (r.status === "error") {
          errors++;
          if (error_details.length < 10) error_details.push(`${r.email}: ${r.error}`);
          // Do NOT save fingerprint on error — contact will be retried next sync
        }
      }

      await kvSet(KV_CONTACT_FP, updatedFp);
    }

    // Save the sheet's modified timestamp so the next sync can skip if unchanged
    if (sheetModifiedAt && status !== "error") {
      await kvSet(KV_SHEET_MODIFIED, sheetModifiedAt);
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

  const prevStats = (await kvGet<SyncStats>(KV_STATS)) ?? {
    total_ever_synced: 0,
    last_sync_at: null,
    last_sync_status: "never" as const,
    last_new_added: 0,
    last_updated: 0,
    last_errors: 0,
  };

  await kvSet(KV_STATS, {
    total_ever_synced: prevStats.total_ever_synced + new_added,
    last_sync_at: log.timestamp,
    last_sync_status: log.status,
    last_new_added: new_added,
    last_updated: updated,
    last_errors: errors,
  } satisfies SyncStats);

  return log;
}
