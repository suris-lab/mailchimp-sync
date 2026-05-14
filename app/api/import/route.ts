import { NextResponse } from "next/server";
import { importFromSheet } from "@/tools/import-contacts";
import type { ImportParams } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  let params: ImportParams;
  try {
    params = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!params.sourceSheetId || !params.sourceRange || !params.emailColumn || !params.interestTag) {
    return NextResponse.json(
      { error: "sourceSheetId, sourceRange, emailColumn, and interestTag are required" },
      { status: 400 },
    );
  }

  try {
    const result = await importFromSheet(params);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
