import { NextResponse } from "next/server";
import { kvGet, kvLrange } from "@/lib/kv";
import type { SyncLog, GrowthStats } from "@/lib/types";

export async function GET() {
  const ids = await kvLrange("sync:log_ids", 0, 499);
  const logs = await Promise.all(ids.map((id) => kvGet<SyncLog>(`sync:log:${id}`)));
  const validLogs = logs.filter((l): l is SyncLog => l !== null && l.status !== "skipped");

  // Build a bucket for every day in the past 60 days, initialised to 0
  const buckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  // Accumulate new_added from each log into its date bucket
  for (const log of validLogs) {
    const date = log.timestamp.slice(0, 10);
    if (date in buckets) {
      buckets[date] += log.new_added;
    }
  }

  const dailyNew = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  const cutoff30 = new Date(today);
  cutoff30.setDate(today.getDate() - 30);
  const cutoff30Str = cutoff30.toISOString().slice(0, 10);

  const last30Days = dailyNew
    .filter(({ date }) => date >= cutoff30Str)
    .reduce((s, { value }) => s + value, 0);

  const last60Days = dailyNew.reduce((s, { value }) => s + value, 0);

  const stats: GrowthStats = { last30Days, last60Days, dailyNew };
  return NextResponse.json(stats);
}
