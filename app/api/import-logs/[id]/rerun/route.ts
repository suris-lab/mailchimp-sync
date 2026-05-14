import { NextResponse } from "next/server";
import { kvGet, kvSet, kvLpush } from "@/lib/kv";
import { importFromSheet } from "@/tools/import-contacts";
import type { ImportLog } from "@/lib/types";

export const maxDuration = 60;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const original = await kvGet<ImportLog>(`import:log:${id}`);
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const result = await importFromSheet(original.params);

    const log: ImportLog = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      params: original.params,
      tagged: result.tagged,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors,
      taggedEmails: result.taggedEmails,
      insertedEmails: result.insertedEmails,
      remark: "",
      undone: false,
    };

    await kvSet(`import:log:${log.id}`, log);
    await kvLpush("import:log_ids", log.id);

    return NextResponse.json({ result, log });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
