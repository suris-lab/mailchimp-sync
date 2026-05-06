import { randomUUID, createHash } from "crypto";
import type { SyncLog, SyncStats, SyncSchedule, SheetContact, AudienceStats, LifecycleStats, LifecycleStageCounts } from "@/lib/types";
import { fetchSheetContacts, getSheetModifiedTime } from "./google-sheets";
import { upsertContacts } from "./mailchimp-upsert";
import { kvGet, kvSet, kvLpush } from "@/lib/kv";

const KV_STATS = "sync:stats";
const KV_LOG_IDS = "sync:log_ids";
const KV_SCHEDULE = "sync:schedule";
// v4 key — always index by email (not memberId) to eliminate stableKey collisions when
// multiple sheet rows share the same memberId (e.g. backup contacts). Bumping the key
// forces a one-time full re-sync so all fingerprints are rebuilt under the new scheme.
const KV_CONTACT_FP = "sync:contact_fingerprints_v4";
const KV_SHEET_MODIFIED = "sync:sheet_modified_at";
const KV_LIFECYCLE_STATS = "sync:lifecycle_stats";
// Unsubscribed email set cached by computeLifecycleStats — read by runSync to skip
// unsubscribed contacts without an extra Mailchimp API call per sync.
const KV_UNSUBSCRIBED = "sync:unsubscribed_emails";

type ContactFpEntry = { email: string; fp: string };

// Always key fingerprints by email. Using memberId caused collisions when two sheet rows
// share the same memberId (backup contacts) — the slot was shared so one contact was
// always detected as changed. Email is guaranteed unique per row.
function stableKey(c: { email: string }): string {
  return c.email.toLowerCase();
}

async function computeAudienceStats(allContacts: SheetContact[]): Promise<void> {
  const membership: Record<string, number> = {};
  const membership_modifier: Record<string, number> = {};
  const interest: Record<string, number> = {};
  const facility: Record<string, number> = {};
  const skill: Record<string, number> = {};
  const administrative: Record<string, number> = {};

  for (const c of allContacts) {
    if (c.membership)         membership[c.membership]                  = (membership[c.membership] ?? 0) + 1;
    if (c.membershipModifier) membership_modifier[c.membershipModifier] = (membership_modifier[c.membershipModifier] ?? 0) + 1;

    // Tag fields — track contacts with no value as "Blank" so they appear in charts
    if (c.interest.length > 0)       { for (const v of c.interest)       interest[v]       = (interest[v] ?? 0) + 1; }
    else                             { interest["Blank"]                  = (interest["Blank"] ?? 0) + 1; }
    if (c.facility.length > 0)       { for (const v of c.facility)       facility[v]       = (facility[v] ?? 0) + 1; }
    else                             { facility["Blank"]                  = (facility["Blank"] ?? 0) + 1; }
    if (c.skill.length > 0)          { for (const v of c.skill)          skill[v]          = (skill[v] ?? 0) + 1; }
    else                             { skill["Blank"]                     = (skill["Blank"] ?? 0) + 1; }
    if (c.administrative.length > 0) { for (const v of c.administrative) administrative[v] = (administrative[v] ?? 0) + 1; }
    else                             { administrative["Blank"]            = (administrative["Blank"] ?? 0) + 1; }
  }

  let total_mailchimp_members = 0;
  try {
    const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
    mc.setConfig({
      apiKey: process.env.MAILCHIMP_API_KEY!,
      server: process.env.MAILCHIMP_SERVER_PREFIX!,
    });
    const list = await mc.lists.getList(process.env.MAILCHIMP_AUDIENCE_ID!, { fields: ["stats.member_count"] });
    total_mailchimp_members = list?.stats?.member_count ?? 0;
  } catch { /* fail silently — sheet stats still show */ }

  const stats: AudienceStats = {
    computed_at: new Date().toISOString(),
    total_mailchimp_members,
    total_sheet_contacts: allContacts.length,
    membership,
    membership_modifier,
    tags: { interest, facility, skill, administrative },
  };

  await kvSet("sync:audience_stats", stats);
}

async function computeLifecycleStats(allContacts: SheetContact[]): Promise<void> {
  const audienceId = process.env.MAILCHIMP_AUDIENCE_ID!;
  const now = Date.now();
  const DAY_MS = 86_400_000;

  // Load previous stats first — used as fallback if Mailchimp fetch fails.
  const prev = await kvGet<LifecycleStats>(KV_LIFECYCLE_STATS);

  // Fetch unsubscribed emails from Mailchimp.
  // No `fields` filter — the subset filter is unreliable with this SDK version and can
  // silently return an empty members array. Fetching all fields is safe for < 1 000 contacts.
  const unsubscribedEmails = new Set<string>();
  let fetchError: string | undefined;
  try {
    const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
    mc.setConfig({ apiKey: process.env.MAILCHIMP_API_KEY!, server: process.env.MAILCHIMP_SERVER_PREFIX! });
    const res = await mc.lists.getListMembersInfo(audienceId, {
      status: "unsubscribed",
      count: 1000,
      offset: 0,
    }) as any;
    for (const m of (res.members ?? []) as any[]) {
      if (m.email_address) unsubscribedEmails.add(m.email_address.toLowerCase());
    }
  } catch (err) {
    fetchError = String(err);
  }

  // Cache the unsubscribed set so runSync can filter without an extra Mailchimp API call.
  if (!fetchError) {
    kvSet(KV_UNSUBSCRIBED, [...unsubscribedEmails]).catch(() => {});
  }

  // If the fetch failed, preserve previous counts — don't misclassify Dead contacts.
  if (fetchError) {
    const preserved = prev?.current ?? { new: 0, active: 0, cold: 0, dead: 0, total: allContacts.length };
    const today = new Date().toISOString().slice(0, 10);
    const history = (prev?.history ?? []).filter(h => h.date !== today);
    history.push({ date: today, stages: preserved });
    if (history.length > 90) history.splice(0, history.length - 90);
    await kvSet(KV_LIFECYCLE_STATS, {
      computed_at: new Date().toISOString(),
      current: preserved,
      healthScore: prev?.healthScore ?? 0,
      history,
      fetchError,
    } as LifecycleStats);
    return;
  }

  const counts: LifecycleStageCounts = { new: 0, active: 0, cold: 0, dead: 0, total: allContacts.length };

  for (const c of allContacts) {
    // Dead = unsubscribed in Mailchimp (highest priority)
    if (unsubscribedEmails.has(c.email.toLowerCase())) { counts.dead++; continue; }

    // New = created within 7 days (from sheet CreatedAt)
    const createdMs = c.createdAt ? Date.parse(c.createdAt) : NaN;
    if (!isNaN(createdMs) && now - createdMs <= 7 * DAY_MS) { counts.new++; continue; }

    // Active = contact record has been updated (changedId set OR updatedAt non-empty)
    const hasUpdate = (c.changedId && c.changedId.trim() !== "") ||
                      (c.updatedAt && c.updatedAt.trim() !== "");
    if (hasUpdate) { counts.active++; continue; }

    counts.cold++;
  }

  const healthScore = counts.total > 0
    ? Math.round((counts.active * 100 + counts.new * 80 + counts.cold * 30) / counts.total)
    : 0;

  const today = new Date().toISOString().slice(0, 10);
  const history = (prev?.history ?? []).filter(h => h.date !== today);
  history.push({ date: today, stages: counts });
  if (history.length > 90) history.splice(0, history.length - 90);

  await kvSet(KV_LIFECYCLE_STATS, {
    computed_at: new Date().toISOString(),
    current: counts,
    healthScore,
    history,
  } as LifecycleStats);
}

export async function shouldSkipCronSync(): Promise<boolean> {
  const schedule = await kvGet<SyncSchedule>(KV_SCHEDULE);
  if (!schedule) return false; // no schedule set → let cron run freely
  if (schedule.interval_minutes <= 0) return true;

  const stats = await kvGet<SyncStats>(KV_STATS);
  if (!stats?.last_sync_at) return false;

  const elapsed = (Date.now() - new Date(stats.last_sync_at).getTime()) / 60_000;
  return elapsed < schedule.interval_minutes;
}

// Hash every meaningful field so any change to any column triggers a resync.
// Tag arrays are sorted before hashing — Google Sheets can return multi-value cells
// in different orders between API calls, which would otherwise produce a different
// fingerprint for the same data and cause a false re-sync every run.
function fullFingerprint(c: SheetContact): string {
  const raw = [
    c.email, c.fullName, c.memberId, c.membership, c.membershipModifier,
    c.phone, c.note, c.createdAt, c.updatedAt, c.changedId,
    ...[...c.interest].sort(), ...[...c.facility].sort(),
    ...[...c.skill].sort(),    ...[...c.administrative].sort(),
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

      // Lifecycle stages evolve as Mailchimp engagement timestamps age — refresh
      // even when the sheet is unchanged. Gate to once per hour to avoid excess API calls.
      const lc = await kvGet<LifecycleStats>(KV_LIFECYCLE_STATS);
      const lcAgeHours = lc ? (Date.now() - new Date(lc.computed_at).getTime()) / 3_600_000 : Infinity;
      if (lcAgeHours > 1) {
        fetchSheetContacts()
          .then(contacts => computeLifecycleStats(contacts))
          .catch(() => {});
      }

      return log;
    }

    // 2. Fetch all contacts from Google Sheets
    const allContacts = await fetchSheetContacts();
    total_contacts = allContacts.length;

    // 3. Compute audience stats from the full contact list and store in KV
    computeAudienceStats(allContacts).catch(() => {}); // fire-and-forget, non-blocking
    computeLifecycleStats(allContacts).catch(() => {});

    // 4. Load saved fingerprints and the cached unsubscribed email set.
    const savedFp = (await kvGet<Record<string, ContactFpEntry>>(KV_CONTACT_FP)) ?? {};
    const isFirstRun = Object.keys(savedFp).length === 0;
    const unsubscribedEmails = new Set<string>(
      (await kvGet<string[]>(KV_UNSUBSCRIBED)) ?? []
    );

    // updatedFp starts as a copy of savedFp; entries are overwritten as contacts are processed.
    const updatedFp: Record<string, ContactFpEntry> = { ...savedFp };
    let fpDirty = false;

    const contacts: SheetContact[] = [];
    for (const c of allContacts) {
      const key = stableKey(c);
      const saved = savedFp[key];
      const currentFp = fullFingerprint(c);
      if (!saved || saved.fp !== currentFp) {
        // Unsubscribed contacts must never be sent to Mailchimp (compliance).
        // Save their fingerprint so they are not re-detected on the next sync.
        if (unsubscribedEmails.has(c.email.toLowerCase())) {
          updatedFp[key] = { email: c.email.toLowerCase(), fp: currentFp };
          fpDirty = true;
          continue;
        }
        contacts.push(c);
      }
    }
    contacts_processed = contacts.length;

    if (contacts.length > 0) {
      // Upsert changed contacts to Mailchimp.
      // On first run (no fingerprints yet) skip tag API calls — merge fields only.
      // Tags sync on the next run when fingerprints exist and only a small
      // number of changed contacts need processing.
      const results = await upsertContacts(contacts, new Set(), isFirstRun);

      for (const r of results) {
        if (r.status === "new" || r.status === "updated") {
          if (r.status === "new") new_added++; else updated++;
          const c = contacts.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
          if (c) {
            const key = stableKey(c);
            updatedFp[key] = { email: c.email.toLowerCase(), fp: fullFingerprint(c) };
            fpDirty = true;
          }
        } else if (r.status === "error") {
          errors++;
          if (error_details.length < 10) error_details.push(`${r.email}: ${r.error}`);
          // Do NOT save fingerprint on error — contact will be retried next sync
        }
      }
    }

    if (fpDirty) {
      await kvSet(KV_CONTACT_FP, updatedFp);
    }

    if (errors > 0 && errors < contacts_processed) status = "partial";
    else if (contacts_processed > 0 && errors === contacts_processed) status = "error";

    // Save the sheet's modified timestamp so the next sync can skip if unchanged
    if (sheetModifiedAt && status !== "error") {
      await kvSet(KV_SHEET_MODIFIED, sheetModifiedAt);
    }
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
