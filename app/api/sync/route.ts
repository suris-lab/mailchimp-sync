import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { runSync, shouldSkipCronSync } from "@/tools/sync-engine";
import type { SyncLog, CronStatus } from "@/lib/types";

export const maxDuration = 60;

const KV_LOCK = "sync:lock";
const KV_CRON_STATUS = "sync:cron_status";
const LOCK_TTL_SECONDS = 120;

async function setCronStatus(status: CronStatus) {
  await kvSet(KV_CRON_STATUS, status).catch(() => {});
}

export async function GET(req: NextRequest) {
  const hitAt = new Date().toISOString();
  // Record the attempt immediately — before auth — so the dashboard can show
  // "cron is hitting the endpoint" vs "cron never fires at all"
  await setCronStatus({ hit_at: hitAt, result: "checking" });

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      await setCronStatus({ hit_at: hitAt, result: "auth_failed" });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const skip = await shouldSkipCronSync();
  if (skip) {
    await setCronStatus({ hit_at: hitAt, result: "skipped_schedule" });
    return NextResponse.json({ accepted: false, reason: "Not due yet per schedule" });
  }

  const lock = await kvGet<boolean>(KV_LOCK);
  if (lock) {
    await setCronStatus({ hit_at: hitAt, result: "lock_busy" });
    return NextResponse.json({ accepted: false, reason: "Sync already in progress" }, { status: 409 });
  }

  await kvSet(KV_LOCK, true, LOCK_TTL_SECONDS);
  await setCronStatus({ hit_at: hitAt, result: "started" });

  try {
    const log = await runSync("cron");
    await setCronStatus({ hit_at: hitAt, result: "completed" });
    return NextResponse.json({ accepted: true, log });
  } catch (err) {
    await setCronStatus({ hit_at: hitAt, result: "error", error: String(err) });
    return NextResponse.json({ accepted: true, error: String(err) }, { status: 500 });
  } finally {
    await kvDel(KV_LOCK);
  }
}

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

  try {
    const log = await runSync(triggeredBy);
    return NextResponse.json({ accepted: true, log });
  } catch (err) {
    return NextResponse.json({ accepted: true, error: String(err) }, { status: 500 });
  } finally {
    await kvDel(KV_LOCK);
  }
}
