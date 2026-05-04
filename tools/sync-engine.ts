import { randomUUID, createHash } from "crypto";
import type { SyncLog, SyncStats, SyncSchedule, SheetContact, AudienceStats, LifecycleStats, LifecycleStageCounts } from "@/lib/types";
import { fetchSheetContacts, getSheetModifiedTime } from "./google-sheets";
import { upsertContacts } from "./mailchimp-upsert";
import { kvGet, kvSet, kvLpush } from "@/lib/kv";

const KV_STATS = "sync:stats";
const KV_LOG_IDS = "sync:log_ids";
const KV_SCHEDULE = "sync:schedule";
// v2 key — keyed by memberId (fallback: email) storing { email, fp } pairs so email changes
// can be detected. The old "sync:contact_fingerprints" key (email-keyed strings) is abandoned;
// the first sync after deploy will do a one-time full re-sync of all contacts.
const KV_CONTACT_FP = "sync:contact_fingerprints_v2";
const KV_SHEET_MODIFIED = "sync:sheet_modified_at";
const KV_LIFECYCLE_STATS = "sync:lifecycle_stats";

type ContactFpEntry = { email: string; fp: string };

// Stable identity key: memberId when available; fall back to email for contacts without one.
// If a contact has no memberId and their email changes we cannot detect it — document accordingly.
function stableKey(c: { memberId: string; email: string }): string {
  return c.memberId.trim() || c.email.toLowerCase();
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

  // Fetch unsubscribed emails from Mailchimp — two parallel calls (subscribed default
  // call doesn't return unsubscribed contacts). HHYC < 500 contacts; add pagination
  // if count ever exceeds 1000.
  const unsubscribedEmails = new Set<string>();
  try {
    const mc = (await import("@mailchimp/mailchimp_marketing")).default as any;
    mc.setConfig({ apiKey: process.env.MAILCHIMP_API_KEY!, server: process.env.MAILCHIMP_SERVER_PREFIX! });
    const res = await mc.lists.getListMembersInfo(audienceId, {
      fields: ["members.email_address"],
      status: "unsubscribed",
      count: 1000,
      offset: 0,
    }) as any;
    for (const m of (res.members ?? []) as any[]) {
      unsubscribedEmails.add(m.email_address.toLowerCase());
    }
  } catch { /* fail silently — dead stage falls back to 0 */ }

  const counts: LifecycleStageCounts = { new: 0, active: 0, cold: 0, dead: 0, total: allContacts.length };

  for (const c of allContacts) {
    // Dead = unsubscribed in Mailchimp
    if (unsubscribedEmails.has(c.email.toLowerCase())) { counts.dead++; continue; }

    // New = created within 7 days (from sheet CreatedAt)
    const createdMs = c.createdAt ? Date.parse(c.createdAt) : NaN;
    if (!isNaN(createdMs) && now - createdMs <= 7 * DAY_MS) { counts.new++; continue; }

    // Active = contact record has been updated (changedId set OR updatedAt non-empty)
    const hasUpdate = (c.changedId && c.changedId.trim() !== "") ||
                      (c.updatedAt && c.updatedAt.trim() !== "");
    if (hasUpdate) { counts.active++; continue; }

    // Cold = subscribed but nothing has changed since import
    counts.cold++;
  }

  const healthScore = counts.total > 0
    ? Math.round((counts.active * 100 + counts.new * 80 + counts.cold * 30) / counts.total)
    : 0;

  // Upsert today's snapshot — one entry per calendar day, max 90 entries kept
  const today = new Date().toISOString().slice(0, 10);
  const prev = await kvGet<LifecycleStats>(KV_LIFECYCLE_STATS);
  const history = (prev?.history ?? []).filter(h => h.date !== today);
  history.push({ date: today, stages: counts });
  if (history.length > 90) history.splice(0, history.length - 90);

  await kvSet(KV_LIFECYCLE_STATS, {
    computed_at: new Date().toISOString(),
    current: counts,
    healthScore,
    history,
  } satisfies LifecycleStats);
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

    // 4. Load saved fingerprints — compare every contact against last known state.
    //    Keyed by memberId (fallback: email); value is { email, fp } so we can detect
    //    email address changes and route them to a PATCH call instead of batch upsert.
    const savedFp = (await kvGet<Record<string, ContactFpEntry>>(KV_CONTACT_FP)) ?? {};
    const isFirstRun = Object.keys(savedFp).length === 0;

    const contacts: SheetContact[] = [];
    for (const c of allContacts) {
      const key = stableKey(c);
      const saved = savedFp[key];
      const currentFp = fullFingerprint(c);
      if (!saved || saved.fp !== currentFp) {
        if (saved && saved.email !== c.email.toLowerCase()) {
          // Email has changed — attach old email so upsertContacts can PATCH the
          // existing Mailchimp record rather than creating a duplicate contact.
          contacts.push({ ...c, oldEmail: saved.email });
        } else {
          contacts.push(c);
        }
      }
    }
    contacts_processed = contacts.length;

    if (contacts.length > 0) {
      // Upsert changed contacts to Mailchimp.
      // On first run (no fingerprints yet) skip tag API calls — merge fields only.
      // Tags sync on the next run when fingerprints exist and only a small
      // number of changed contacts need processing.
      const results = await upsertContacts(contacts, new Set(), isFirstRun);

      const updatedFp: Record<string, ContactFpEntry> = { ...savedFp };
      for (const r of results) {
        if (r.status === "new" || r.status === "updated") {
          if (r.status === "new") new_added++; else updated++;
          const c = contacts.find((x) => x.email.toLowerCase() === r.email.toLowerCase());
          if (c) {
            const key = stableKey(c);
            updatedFp[key] = { email: c.email.toLowerCase(), fp: fullFingerprint(c) };
            // If the email changed, the old stableKey entry (if it was email-based) may
            // still exist — remove it to avoid stale entries when memberId is blank.
            if (c.oldEmail && !c.memberId.trim() && updatedFp[c.oldEmail]) {
              delete updatedFp[c.oldEmail];
            }
          }
        } else if (r.status === "error") {
          errors++;
          if (error_details.length < 10) error_details.push(`${r.email}: ${r.error}`);
          // Do NOT save fingerprint on error — contact will be retried next sync
        }
      }

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
