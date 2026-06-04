import { google } from "googleapis";
import type { SheetContact } from "@/lib/types";
import { splitCellValues } from "@/lib/field-map";

// Expected column headers in the Google Sheet (order-independent, matched by name)
const COL = {
  MEMBER_ID: "MemberID",
  FULL_NAME: "FullName",
  MEMBERSHIP: "Membership",
  MEMBERSHIP_MODIFIER: "Membership_Modifier",
  EMAIL: "Email1",
  INTEREST: "Interest",
  FACILITY: "Facility",
  SKILL: "Skill",
  ADMINISTRATIVE: "Administrative",
  CREATED_AT: "CreatedAt",
  UPDATED_AT: "UpdatedAt",
  CHANGED_ID: "ChangedId",
  NOTE: "Note",
  PHONE: "Phone",
  // Birthday milestone columns — optional, sent to Mailchimp as merge fields
  BDAY:   "BDAY",
  BDAY18: "18BDAY",
  BDAY21: "21BDAY",
  BDAY25: "25BDAY",
  BDAY30: "30BDAY",
} as const;

function getAuth(scopes: string[] = ["https://www.googleapis.com/auth/spreadsheets.readonly"]) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes,
  });
}

// Returns the Drive modifiedTime for the sheet, or null if unavailable.
// Used to skip syncs when the sheet hasn't changed.
export async function getSheetModifiedTime(): Promise<string | null> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) return null;
  try {
    const auth = getAuth([
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ]);
    const drive = google.drive({ version: "v3", auth });
    const res = await drive.files.get({ fileId: sheetId, fields: "modifiedTime" });
    return res.data.modifiedTime ?? null;
  } catch {
    return null; // Drive API unavailable — fall through to full sync
  }
}

// Returns the header row of the main sheet (used by the import tool).
export async function getMainSheetHeaders(): Promise<string[]> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID env var");
  const tabName = (process.env.SHEET_RANGE ?? "Sheet1!A:Z").split("!")[0];
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  // Fetch the entire first row (no column cap) so headers beyond A:N are included
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `${tabName}!1:1`,
    majorDimension: "ROWS",
  });
  return (res.data.values?.[0] ?? []).map((h: unknown) => String(h).trim());
}

// Read any Google Sheet by ID + range, extracting email + optional name/phone.
// Columns are identified by header name (case-insensitive).
export async function readSourceSheet(
  sheetId: string,
  range: string,
  emailCol: string,
  nameCol?: string,
  phoneCol?: string,
): Promise<{ email: string; name?: string; phone?: string }[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map((h: unknown) => String(h).trim().toLowerCase());
  const idx = (col: string) => headers.indexOf(col.toLowerCase());
  const emailIdx = idx(emailCol);
  if (emailIdx < 0) throw new Error(`Column "${emailCol}" not found in source sheet`);
  const nameIdx  = nameCol  ? idx(nameCol)  : -1;
  const phoneIdx = phoneCol ? idx(phoneCol) : -1;

  const contacts: { email: string; name?: string; phone?: string }[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row: string[] = rows[i];
    const email = String(row[emailIdx] ?? "").trim();
    if (!email) continue;
    contacts.push({
      email,
      name:  nameIdx  >= 0 ? String(row[nameIdx]  ?? "").trim() : undefined,
      phone: phoneIdx >= 0 ? String(row[phoneIdx] ?? "").trim() : undefined,
    });
  }
  return contacts;
}

// Batch-update specific cells in one Sheets API call.
// Ranges must be in A1 notation e.g. "Sheet1!G5"
export async function batchUpdateCells(
  updates: { range: string; value: string }[],
): Promise<void> {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error("Missing SHEET_ID env var");
  const auth = getAuth(["https://www.googleapis.com/auth/spreadsheets"]);
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: sheetId,
    requestBody: {
      valueInputOption: "RAW",
      data: updates.map(u => ({ range: u.range, values: [[u.value]] })),
    },
  });
}

// Delete rows from the main sheet whose Email1 matches any of the given emails.
// Reads the sheet first to find current row positions (safe even if rows shifted since import).
export async function deleteRowsByEmail(emails: string[]): Promise<void> {
  const spreadsheetId = process.env.SHEET_ID;
  const range = process.env.SHEET_RANGE ?? "Sheet1!A:Z";
  const tabName = range.split("!")[0];
  if (!spreadsheetId) throw new Error("Missing SHEET_ID env var");

  const auth = getAuth(["https://www.googleapis.com/auth/spreadsheets"]);
  const sheets = google.sheets({ version: "v4", auth });

  // Resolve the numeric tab sheetId needed by deleteDimension
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const tabMeta = meta.data.sheets?.find(s => s.properties?.title === tabName);
  if (!tabMeta) throw new Error(`Tab "${tabName}" not found in spreadsheet`);
  const tabSheetId = tabMeta.properties!.sheetId!;

  // Read current values to find row indices by email
  const valRes = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = valRes.data.values;
  if (!rows || rows.length < 2) return;

  const headers = rows[0].map((h: unknown) => String(h).trim());
  const emailIdx = headers.indexOf(COL.EMAIL);
  if (emailIdx < 0) throw new Error('"Email1" column not found');

  const emailSet = new Set(emails.map(e => e.toLowerCase()));
  // rows[i] = 0-based array index i → sheet row i+1 (1-based) → delete startIndex = i
  const toDelete: number[] = [];
  for (let i = 1; i < rows.length; i++) {
    const email = String(rows[i][emailIdx] ?? "").trim().toLowerCase();
    if (emailSet.has(email)) toDelete.push(i);
  }

  if (toDelete.length === 0) return;

  // Delete bottom-to-top so earlier indices don't shift during the operation
  const requests = toDelete.sort((a, b) => b - a).map(idx => ({
    deleteDimension: {
      range: { sheetId: tabSheetId, dimension: "ROWS", startIndex: idx, endIndex: idx + 1 },
    },
  }));

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

// Append rows below the last row of data in the main sheet.
export async function appendRows(rows: string[][]): Promise<void> {
  const sheetId = process.env.SHEET_ID;
  const range = process.env.SHEET_RANGE ?? "Sheet1!A:Z";
  if (!sheetId) throw new Error("Missing SHEET_ID env var");
  const auth = getAuth(["https://www.googleapis.com/auth/spreadsheets"]);
  const sheets = google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: { values: rows },
  });
}

export async function fetchSheetContacts(): Promise<SheetContact[]> {
  const sheetId = process.env.SHEET_ID;
  // Use only the tab name — strip any column bounds (e.g. "Sheet1!A:N" → "Sheet1").
  // This ensures newly added columns (like BDAY) are always fetched regardless of
  // what range is configured in SHEET_RANGE.
  const tabName = (process.env.SHEET_RANGE ?? "Sheet1!A:Z").split("!")[0];

  if (!sheetId) throw new Error("Missing SHEET_ID env var");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,   // fetch entire tab — all rows, all columns
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  const headers: string[] = rows[0].map((h: string) => String(h).trim());

  function col(name: string): number {
    return headers.indexOf(name);
  }

  function cell(row: string[], name: string): string {
    const idx = col(name);
    return idx >= 0 ? String(row[idx] ?? "").trim() : "";
  }

  const contacts: SheetContact[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row: string[] = rows[i];
    const email = cell(row, COL.EMAIL);
    if (!email) continue; // skip rows with no email

    contacts.push({
      email,
      fullName: cell(row, COL.FULL_NAME),
      memberId: cell(row, COL.MEMBER_ID),
      membership: cell(row, COL.MEMBERSHIP),
      membershipModifier: cell(row, COL.MEMBERSHIP_MODIFIER),
      phone: cell(row, COL.PHONE),
      note: cell(row, COL.NOTE),
      createdAt: cell(row, COL.CREATED_AT),
      updatedAt: cell(row, COL.UPDATED_AT),
      changedId: cell(row, COL.CHANGED_ID),
      interest: splitCellValues(cell(row, COL.INTEREST)),
      facility: splitCellValues(cell(row, COL.FACILITY)),
      skill: splitCellValues(cell(row, COL.SKILL)),
      administrative: splitCellValues(cell(row, COL.ADMINISTRATIVE)),
      bday:   cell(row, COL.BDAY),
      bday18: cell(row, COL.BDAY18),
      bday21: cell(row, COL.BDAY21),
      bday25: cell(row, COL.BDAY25),
      bday30: cell(row, COL.BDAY30),
      rowIndex: i,
    });
  }

  return contacts;
}
