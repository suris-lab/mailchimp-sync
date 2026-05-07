import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { kvGet, kvLrange } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { SyncLog, SyncStats, AudienceStats, LifecycleStats } from "@/lib/types";

export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backedUpAt = new Date().toISOString();
  const snapshotDate = backedUpAt.slice(0, 10);

  try {
    // ── 1. Sync logs — upsert any IDs not yet in Supabase ──────────────────
    const allIds = await kvLrange("sync:log_ids", 0, -1);
    let logsUpserted = 0;

    if (allIds.length > 0) {
      // Find which IDs are already backed up
      const { data: existing } = await db
        .from("sync_logs")
        .select("id")
        .in("id", allIds);

      const existingIds = new Set((existing ?? []).map((r: { id: string }) => r.id));
      const newIds = allIds.filter((id) => !existingIds.has(id));

      // Fetch and insert new logs in batches to avoid hitting request size limits
      for (let i = 0; i < newIds.length; i += 50) {
        const batch = newIds.slice(i, i + 50);
        const logs = (
          await Promise.all(batch.map((id) => kvGet<SyncLog>(`sync:log:${id}`)))
        ).filter(Boolean) as SyncLog[];

        if (logs.length > 0) {
          await db.from("sync_logs").upsert(
            logs.map((l) => ({
              id:                 l.id,
              timestamp:          l.timestamp,
              triggered_by:       l.triggered_by,
              total_contacts:     l.total_contacts,
              contacts_processed: l.contacts_processed,
              new_added:          l.new_added,
              updated:            l.updated,
              errors:             l.errors,
              error_details:      l.error_details,
              duration_ms:        l.duration_ms,
              status:             l.status,
            }))
          );
          logsUpserted += logs.length;
        }
      }
    }

    // ── 2. Daily stats snapshot ─────────────────────────────────────────────
    const [syncStats, audienceStats, lifecycleStats] = await Promise.all([
      kvGet<SyncStats>("sync:stats"),
      kvGet<AudienceStats>("sync:audience_stats"),
      kvGet<LifecycleStats>("sync:lifecycle_stats"),
    ]);

    await db.from("daily_snapshots").upsert({
      snapshot_date:   snapshotDate,
      sync_stats:      syncStats,
      audience_stats:  audienceStats,
      lifecycle_stats: lifecycleStats,
    });

    // ── 3. Contact snapshot (rolling 30 days) ───────────────────────────────
    const contacts = await fetchSheetContacts();

    await db.from("contact_snapshots").upsert({
      snapshot_date: snapshotDate,
      contacts:      contacts,
      contact_count: contacts.length,
    });

    // Delete snapshots older than 30 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    await db
      .from("contact_snapshots")
      .delete()
      .lt("snapshot_date", cutoff.toISOString().slice(0, 10));

    return NextResponse.json({
      backed_up_at:  backedUpAt,
      snapshot_date: snapshotDate,
      logs_upserted: logsUpserted,
      contact_count: contacts.length,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
