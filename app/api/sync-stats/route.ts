import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { SyncStats, CronStatus } from "@/lib/types";

export async function GET() {
  const [stats, cronStatus] = await Promise.all([
    kvGet<SyncStats>("sync:stats"),
    kvGet<CronStatus>("sync:cron_status"),
  ]);

  const result: SyncStats = {
    total_ever_synced: 0,
    last_sync_at: null,
    last_sync_status: "never",
    last_new_added: 0,
    last_updated: 0,
    last_errors: 0,
    ...(stats ?? {}),
    cron_status: cronStatus ?? null,
  };

  return NextResponse.json(result);
}
