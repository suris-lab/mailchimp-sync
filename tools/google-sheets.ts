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
} as const;

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }

  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function fetchSheetContacts(): Promise<SheetContact[]> {
  const sheetId = process.env.SHEET_ID;
  const range = process.env.SHEET_RANGE ?? "Sheet1!A:Z";

  if (!sheetId) throw new Error("Missing SHEET_ID env var");

  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range,
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
      rowIndex: i,
    });
  }

  return contacts;
}
