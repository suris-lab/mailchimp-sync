import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import type { ImportLog } from "@/lib/types";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const log = await kvGet<ImportLog>(`import:log:${id}`);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { remark?: string };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updated: ImportLog = { ...log, remark: body.remark ?? log.remark };
  await kvSet(`import:log:${id}`, updated);
  return NextResponse.json(updated);
}
