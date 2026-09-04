import { timingSafeEqual } from "crypto";
import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet, kvDel } from "@/lib/kv";
import { runSync } from "@/tools/sync-engine";

export const maxDuration = 300;

const KV_LOCK = "sync:lock";
const LOCK_TTL_SECONDS = 360;

function validateSecret(provided: string | null): boolean {
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || !provided) return false;
  try {
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!validateSecret(secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lock = await kvGet<boolean>(KV_LOCK);
  if (lock) {
    return NextResponse.json({ status: "already_running" }, { status: 202 });
  }

  await kvSet(KV_LOCK, true, LOCK_TTL_SECONDS);

  // `after` keeps the work attached to this Vercel invocation after the fast
  // acknowledgement is sent to Apps Script; a detached promise may be dropped.
  after(async () => {
    try {
      await runSync("webhook");
    } finally {
      await kvDel(KV_LOCK);
    }
  });

  return NextResponse.json({ status: "accepted" });
}
