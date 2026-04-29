// Maps Google Sheet column headers to Mailchimp merge tag names.
// Existing audience fields are configured via env vars so the mapping can be
// adjusted without code changes (see workflows/setup-environment.md).

export const FIELD_MAP = {
  // Existing Mailchimp audience fields — set these env vars to match your audience's merge tags
  FULLNAME: process.env.MC_TAG_FULLNAME ?? "FULLNAME",
  MEMBERSHIP: process.env.MC_TAG_MEMBERSHIP ?? "MEMBERSHIP",
  MEMBERSHIP_MOD: process.env.MC_TAG_MEMBERSHIP_MOD ?? "MEMMOD",

  // New custom merge fields (created once in Mailchimp audience settings)
  PHONE: "PHONE",
  MEMBERID: process.env.MC_TAG_MEMBERID ?? "HHYCMID",
  NOTE: "NOTE",
  CREATEDAT: "CREATEDAT",
  UPDATEDAT: "UPDATEDAT",
  CHANGEDID: "CHANGEDID",
} as const;

// Tag columns: these become Mailchimp tags prefixed with the column name
export const TAG_COLUMNS = ["Interest", "Facility", "Skill", "Administrative"] as const;
export type TagColumn = (typeof TAG_COLUMNS)[number];

// Parse a multi-select cell value into an array of individual tag strings
export function splitCellValues(raw: string | undefined): string[] {
  if (!raw) return [];
  // Try comma first (Google Sheets multi-select chips default), then newline
  const separator = raw.includes(",") ? "," : "\n";
  return raw
    .split(separator)
    .map((v) => v.trim())
    .filter(Boolean);
}

// Send the raw value as the tag name — no column prefix
export function buildTagName(_column: TagColumn, value: string): string {
  return value;
}
