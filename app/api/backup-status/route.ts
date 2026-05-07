import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const { data } = await db
      .from("daily_snapshots")
      .select("created_at")
      .order("snapshot_date", { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ last_backup_at: data?.created_at ?? null });
  } catch {
    return NextResponse.json({ last_backup_at: null });
  }
}
