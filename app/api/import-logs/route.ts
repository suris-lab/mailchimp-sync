import { NextResponse } from "next/server";
import { kvGet, kvLrange } from "@/lib/kv";
import type { ImportLog } from "@/lib/types";

export async function GET() {
  const ids = await kvLrange("import:log_ids", 0, -1);
  const logs = (
    await Promise.all(ids.map(id => kvGet<ImportLog>(`import:log:${id}`)))
  ).filter(Boolean) as ImportLog[];
  return NextResponse.json(logs);
}
