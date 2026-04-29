import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { SyncSchedule, ScheduleInterval } from "@/lib/types";

const KV_SCHEDULE = "sync:schedule";
const VALID_INTERVALS: ScheduleInterval[] = [-1, 0, 30, 60, 360, 720, 1440];

export async function GET() {
  const schedule = (await kvGet<SyncSchedule>(KV_SCHEDULE)) ?? {
    interval_minutes: 0,
    updated_at: null,
  };
  return NextResponse.json(schedule);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const interval = Number(body.interval_minutes) as ScheduleInterval;

  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const schedule: SyncSchedule = {
    interval_minutes: interval,
    updated_at: new Date().toISOString(),
  };

  await kvSet(KV_SCHEDULE, schedule);
  return NextResponse.json(schedule);
}
