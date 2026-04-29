import { NextRequest, NextResponse } from "next/server";
import { kvGet, kvLrange } from "@/lib/kv";
import type { SyncLog, SyncLogsResponse } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const ids = await kvLrange("sync:log_ids", 0, 199); // max 200 most recent
  const logs = await Promise.all(ids.map((id) => kvGet<SyncLog>(`sync:log:${id}`)));
  const validLogs = logs.filter((l): l is SyncLog => l !== null);

  const filtered = validLogs.filter((log) => {
    if (start && log.timestamp < start) return false;
    if (end && log.timestamp > end + "T23:59:59Z") return false;
    return true;
  });

  const response: SyncLogsResponse = { logs: filtered, total: filtered.length };
  return NextResponse.json(response);
}
