import { NextResponse } from "next/server";
import { kvGet, kvLrange } from "@/lib/kv";
import type { SyncLog, GrowthStats } from "@/lib/types";

export async function GET() {
  const ids = await kvLrange("sync:log_ids", 0, 999);
  const logs = await Promise.all(ids.map((id) => kvGet<SyncLog>(`sync:log:${id}`)));
  const validLogs = logs.filter((l): l is SyncLog => l !== null && l.status !== "skipped");

  // Build a bucket for every day in the past 120 days (current 60d + previous 60d for comparison)
  const buckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 0; i < 120; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  for (const log of validLogs) {
    const date = log.timestamp.slice(0, 10);
    if (date in buckets) {
      buckets[date] += log.new_added;
    }
  }

  // Sorted chronologically — index 0 = oldest (119 days ago), last = today
  const dailyNew = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  // dailyNew has 120 entries; last 60 = current, first 60 = previous
  const current60 = dailyNew.slice(60);   // days 0–59 ago (most recent)
  const prev60    = dailyNew.slice(0, 60); // days 60–119 ago

  const last60Days = current60.reduce((s, d) => s + d.value, 0);
  const prev60Days = prev60.reduce((s, d) => s + d.value, 0);

  const last30Days = current60.slice(30).reduce((s, d) => s + d.value, 0); // last 30 of current 60
  const prev30Days = current60.slice(0, 30).reduce((s, d) => s + d.value, 0); // the 30 before that

  const stats: GrowthStats = { last30Days, last60Days, prev30Days, prev60Days, dailyNew };
  return NextResponse.json(stats);
}
