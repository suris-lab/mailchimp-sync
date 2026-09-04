import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { runSync, shouldSkipCronSync } from "@/tools/sync-engine";
import type { SyncLog, CronStatus } from "@/lib/types";

function verifyBearer(header: string | null, secret: string): boolean {
  const provided = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export const maxDuration = 300;

const KV_LOCK = "sync:lock";
const KV_CRON_STATUS = "sync:cron_status";
const LOCK_TTL_SECONDS = 360;

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
    if (!verifyBearer(auth, secret)) {
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
    // Manual and webhook syncs always run regardless of the sheet's modified timestamp.
    // Only cron syncs skip when the sheet is unchanged.
    const force = triggeredBy !== "cron";
    const log = await runSync(triggeredBy, force);
    return NextResponse.json({ accepted: true, log });
  } catch (err) {
    return NextResponse.json({ accepted: true, error: String(err) }, { status: 500 });
  } finally {
    await kvDel(KV_LOCK);
  }
}
