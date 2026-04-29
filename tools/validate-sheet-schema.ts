const REQUIRED_HEADERS = ["Email1", "FullName", "MemberID"];

export function validateSchema(headers: string[]): { valid: boolean; missingColumns: string[] } {
  const missingColumns = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return { valid: missingColumns.length === 0, missingColumns };
}
