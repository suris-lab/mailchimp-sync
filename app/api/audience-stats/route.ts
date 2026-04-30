import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { AudienceStats } from "@/lib/types";

export async function GET() {
  const stats = await kvGet<AudienceStats>("sync:audience_stats");
  return NextResponse.json(stats ?? null);
}
