import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { LifecycleStats } from "@/lib/types";

export async function GET() {
  const stats = await kvGet<LifecycleStats>("sync:lifecycle_stats");
  if (!stats) return NextResponse.json(null);
  return NextResponse.json(stats);
}
