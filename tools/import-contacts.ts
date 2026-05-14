import {
  fetchSheetContacts,
  getMainSheetHeaders,
  readSourceSheet,
  batchUpdateCells,
  appendRows,
} from "./google-sheets";
import type { ImportParams, ImportResult } from "@/lib/types";

// Convert a 0-based column index to a spreadsheet column letter (0→A, 25→Z, 26→AA …)
function colIndexToLetter(idx: number): string {
  let letter = "";
  let n = idx;
  while (n >= 0) {
    letter = String.fromCharCode(65 + (n % 26)) + letter;
    n = Math.floor(n / 26) - 1;
  }
  return letter;
}

// Wrap tab names that contain spaces or apostrophes in single quotes for A1 notation
function a1Tab(tabName: string): string {
  return /[ !']/.test(tabName) ? `'${tabName.replace(/'/g, "''")}'` : tabName;
}

// Build a full row array for insertion into the main sheet, matching its column order.
// Only sets Email1, FullName, Phone, Interest, and CreatedAt — all others left blank.
function buildNewRow(
  src: { email: string; name?: string; phone?: string },
  interestTag: string,
  headers: string[],
): string[] {
  const row = new Array(headers.length).fill("");
  const set = (colName: string, value: string) => {
    const idx = headers.indexOf(colName);
    if (idx >= 0 && value) row[idx] = value;
  };
  set("Email1", src.email);
  if (src.name)  set("FullName", src.name);
  if (src.phone) set("Phone", src.phone);
  set("Interest", interestTag);
  // Store CreatedAt in the same DD/MM/YYYY format the sheet uses
  set("CreatedAt", new Date().toLocaleDateString("en-GB"));
  return row;
}

export async function importFromSheet(params: ImportParams): Promise<ImportResult> {
  const errors: string[] = [];

  // 1. Load main sheet contacts + headers in parallel
  const [main, headers] = await Promise.all([
    fetchSheetContacts(),
    getMainSheetHeaders(),
  ]);

  const tabName = (process.env.SHEET_RANGE ?? "Sheet1!A:Z").split("!")[0];
  const tab = a1Tab(tabName);

  const interestColIdx = headers.indexOf("Interest");
  if (interestColIdx < 0) throw new Error(`"Interest" column not found in main sheet headers`);
  const interestColLetter = colIndexToLetter(interestColIdx);

  // Build index: lowercase email → { sheetRow (1-based), interests[] }
  // rowIndex from fetchSheetContacts is the array index (starting at 1 for first data row),
  // so the actual Google Sheets row number is rowIndex + 1.
  const emailIndex = new Map(
    main.map(c => [c.email.toLowerCase(), {
      sheetRow: c.rowIndex + 1,
      interests: c.interest,
    }])
  );

  // 2. Load source sheet
  const sources = await readSourceSheet(
    params.sourceSheetId,
    params.sourceRange,
    params.emailColumn,
    params.nameColumn,
    params.phoneColumn,
  );

  // 3. Classify each source row
  const cellUpdates: { range: string; value: string }[] = [];
  const newRows: string[][] = [];
  let skipped = 0;

  for (const src of sources) {
    if (!src.email) { skipped++; continue; }
    const key = src.email.toLowerCase();
    const existing = emailIndex.get(key);

    if (existing) {
      // Already has the tag — skip to keep operation idempotent
      if (existing.interests.includes(params.interestTag)) { skipped++; continue; }
      const updated = [...existing.interests, params.interestTag].join(", ");
      cellUpdates.push({
        range: `${tab}!${interestColLetter}${existing.sheetRow}`,
        value: updated,
      });
    } else {
      newRows.push(buildNewRow(src, params.interestTag, headers));
    }
  }

  // 4. Write — max 2 Sheets API calls total regardless of row count
  try {
    if (cellUpdates.length > 0) await batchUpdateCells(cellUpdates);
  } catch (err) {
    errors.push(`Tag update failed: ${String(err)}`);
  }

  try {
    if (newRows.length > 0) await appendRows(newRows);
  } catch (err) {
    errors.push(`Row insert failed: ${String(err)}`);
  }

  return {
    tagged:   errors.some(e => e.startsWith("Tag")) ? 0 : cellUpdates.length,
    inserted: errors.some(e => e.startsWith("Row")) ? 0 : newRows.length,
    skipped,
    errors,
  };
}
