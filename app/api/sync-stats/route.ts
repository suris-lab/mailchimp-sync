import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { SyncStats } from "@/lib/types";

export async function GET() {
  const stats = (await kvGet<SyncStats>("sync:stats")) ?? {
    total_ever_synced: 0,
    last_sync_at: null,
    last_sync_status: "never",
    last_new_added: 0,
    last_updated: 0,
    last_errors: 0,
  };
  return NextResponse.json(stats);
}
