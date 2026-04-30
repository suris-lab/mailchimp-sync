import { NextRequest, NextResponse, after } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { runSync, shouldSkipCronSync } from "@/tools/sync-engine";
import type { SyncLog } from "@/lib/types";

export const maxDuration = 60;

const KV_LOCK = "sync:lock";
const LOCK_TTL_SECONDS = 120;

export async function POST(req: NextRequest) {
  const triggeredBy = (req.headers.get("x-triggered-by") as SyncLog["triggered_by"]) ?? "manual";

  if (triggeredBy === "cron") {
    const skip = await shouldSkipCronSync();
    if (skip) {
      return NextResponse.json({ accepted: false, reason: "Not due yet per schedule" });
    }
  }

  const lock = await kvGet<boolean>(KV_LOCK);
  if (lock) {
    return NextResponse.json({ accepted: false, reason: "Sync already in progress" }, { status: 409 });
  }

  await kvSet(KV_LOCK, true, LOCK_TTL_SECONDS);

  // Return 202 immediately — sync runs after the response is sent so it
  // never hits the Vercel function timeout limit.
  after(async () => {
    try {
      await runSync(triggeredBy);
    } finally {
      await kvDel(KV_LOCK);
    }
  });

  return NextResponse.json({ accepted: true }, { status: 202 });
}
