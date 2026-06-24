import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { AudienceStats } from "@/lib/types";

export async function GET() {
  const [stats, prev] = await Promise.all([
    kvGet<AudienceStats>("sync:audience_stats"),
    kvGet<AudienceStats>("sync:audience_stats_prev"),
  ]);
  return NextResponse.json({ current: stats ?? null, previous: prev ?? null });
}
