import {
  fetchSheetContacts,
  getMainSheetHeaders,
  readSourceSheet,
  batchUpdateCells,
  appendRows,
  deleteRowsByEmail,
} from "./google-sheets";
import { validateEmailBatch } from "./validate-emails";
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
function buildNewRow(
  src: { email: string; name?: string; phone?: string },
  interestTag: string,
  headers: string[],
  administrativeTags?: string[],
): string[] {
  const row = new Array(headers.length).fill("");
  const set = (colName: string, value: string) => {
    const idx = headers.indexOf(colName);
    if (idx >= 0 && value) row[idx] = value;
  };
  set("Email1", src.email);
  if (src.name)  set("FullName", src.name);
  if (src.phone) set("Phone", src.phone);
  set("Membership", "Non_Member");
  set("Interest", interestTag);
  if (administrativeTags?.length) set("Administrative", administrativeTags.join(", "));
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

  const adminColIdx = headers.indexOf("Administrative");
  const adminColLetter = adminColIdx >= 0 ? colIndexToLetter(adminColIdx) : null;

  // Build index: lowercase email → { sheetRow (1-based), interests[], administrative[] }
  const emailIndex = new Map(
    main.map(c => [c.email.toLowerCase(), {
      sheetRow:      c.rowIndex + 1,
      interests:     c.interest,
      administrative: c.administrative,
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

  // 3. Validate + normalise every email from the source sheet
  const { results: validationMap, summary: validation } = validateEmailBatch(
    sources.map(s => s.email),
  );

  // 4. Classify each source row
  const cellUpdates: { range: string; value: string }[] = [];
  const newRows: string[][] = [];
  const taggedEmails: string[] = [];
  const insertedEmails: string[] = [];
  let skipped = 0;

  for (const src of sources) {
    if (!src.email) { skipped++; continue; }

    const vr = validationMap.get(src.email);
    if (!vr || !vr.valid) { skipped++; continue; } // invalid syntax or duplicate

    // Use the cleaned (trimmed + lowercased) address for all downstream work
    src.email = vr.clean;

    const key = src.email.toLowerCase();
    const existing = emailIndex.get(key);

    if (existing) {
      const needsInterest = !existing.interests.includes(params.interestTag);
      const adminTagsToAdd = (params.administrativeTags ?? []).filter(
        t => !existing.administrative.includes(t)
      );

      // Nothing new to write — skip (keeps operation idempotent)
      if (!needsInterest && adminTagsToAdd.length === 0) { skipped++; continue; }

      if (needsInterest) {
        cellUpdates.push({
          range: `${tab}!${interestColLetter}${existing.sheetRow}`,
          value: [...existing.interests, params.interestTag].join(", "),
        });
      }

      if (adminTagsToAdd.length > 0 && adminColLetter) {
        cellUpdates.push({
          range: `${tab}!${adminColLetter}${existing.sheetRow}`,
          value: [...existing.administrative, ...adminTagsToAdd].join(", "),
        });
      }

      taggedEmails.push(src.email);
    } else {
      newRows.push(buildNewRow(src, params.interestTag, headers, params.administrativeTags));
      insertedEmails.push(src.email);
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

  const tagFailed = errors.some(e => e.startsWith("Tag"));
  const rowFailed  = errors.some(e => e.startsWith("Row"));

  return {
    tagged:         tagFailed ? 0 : taggedEmails.length,
    inserted:       rowFailed  ? 0 : newRows.length,
    skipped,
    errors,
    taggedEmails:   tagFailed ? [] : taggedEmails,
    insertedEmails: rowFailed  ? [] : insertedEmails,
    validation,
  };
}

// Reverse a previous import: remove the interest tag (and any admin tags) from tagged
// contacts, and delete rows for inserted contacts.
export async function undoImport(
  params: ImportParams,
  taggedEmails: string[],
  insertedEmails: string[],
): Promise<void> {
  const [main, headers] = await Promise.all([
    fetchSheetContacts(),
    getMainSheetHeaders(),
  ]);

  const tabName = (process.env.SHEET_RANGE ?? "Sheet1!A:Z").split("!")[0];
  const tab = a1Tab(tabName);

  const interestColIdx = headers.indexOf("Interest");
  if (interestColIdx < 0) throw new Error('"Interest" column not found in main sheet');
  const interestColLetter = colIndexToLetter(interestColIdx);

  const adminColIdx = headers.indexOf("Administrative");
  const adminColLetter = adminColIdx >= 0 ? colIndexToLetter(adminColIdx) : null;

  const emailMap = new Map(main.map(c => [c.email.toLowerCase(), c]));

  const cellUpdates: { range: string; value: string }[] = [];

  for (const email of taggedEmails) {
    const contact = emailMap.get(email.toLowerCase());
    if (!contact) continue;

    // Remove interest tag
    cellUpdates.push({
      range: `${tab}!${interestColLetter}${contact.rowIndex + 1}`,
      value: contact.interest.filter(t => t !== params.interestTag).join(", "),
    });

    // Remove admin tags that were applied by this import
    if (params.administrativeTags?.length && adminColLetter) {
      cellUpdates.push({
        range: `${tab}!${adminColLetter}${contact.rowIndex + 1}`,
        value: contact.administrative
          .filter(t => !params.administrativeTags!.includes(t))
          .join(", "),
      });
    }
  }

  if (cellUpdates.length > 0) await batchUpdateCells(cellUpdates);

  // Delete inserted rows
  if (insertedEmails.length > 0) await deleteRowsByEmail(insertedEmails);
}
