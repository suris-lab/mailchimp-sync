import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { runSync, shouldSkipCronSync } from "@/tools/sync-engine";
import type { SyncLog } from "@/lib/types";

const KV_LOCK = "sync:lock";
const LOCK_TTL_SECONDS = 120;

export async function POST(req: NextRequest) {
  const triggeredBy = (req.headers.get("x-triggered-by") as SyncLog["triggered_by"]) ?? "manual";

  // Cron calls respect the user's schedule setting; manual/webhook always run
  if (triggeredBy === "cron") {
    const skip = await shouldSkipCronSync();
    if (skip) {
      return NextResponse.json({ success: true, skipped: true, reason: "Not due yet per schedule" });
    }
  }

  const lock = await kvGet<boolean>(KV_LOCK);
  if (lock) {
    return NextResponse.json({ success: false, error: "Sync already in progress" }, { status: 409 });
  }

  await kvSet(KV_LOCK, true, LOCK_TTL_SECONDS);

  try {
    const log = await runSync(triggeredBy);
    return NextResponse.json({ success: true, log });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  } finally {
    await kvDel(KV_LOCK);
  }
}
