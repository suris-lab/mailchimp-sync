import { NextResponse } from "next/server";
import { kvGet } from "@/lib/kv";
import type { SyncProgress } from "@/lib/types";

export async function GET() {
  const progress = await kvGet<SyncProgress>("sync:progress");
  return NextResponse.json(progress);
}
