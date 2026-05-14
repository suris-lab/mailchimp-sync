import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { undoImport } from "@/tools/import-contacts";
import type { ImportLog } from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const log = await kvGet<ImportLog>(`import:log:${id}`);
  if (!log) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (log.undone) return NextResponse.json({ error: "Already undone" }, { status: 409 });

  try {
    await undoImport(log.params, log.taggedEmails, log.insertedEmails);
    const updated: ImportLog = { ...log, undone: true };
    await kvSet(`import:log:${id}`, updated);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
