import type { EmailIssueType, EmailValidationResult, ImportValidationSummary } from "@/lib/types";

// Well-known domains — used for typo detection via the explicit map below
const DOMAIN_TYPO_MAP: Record<string, string> = {
  // Gmail
  "gmial.com":       "gmail.com",
  "gmai.com":        "gmail.com",
  "gamil.com":       "gmail.com",
  "gmail.co":        "gmail.com",
  "gmail.cm":        "gmail.com",
  "gmail.con":       "gmail.com",
  "gmaill.com":      "gmail.com",
  "gmali.com":       "gmail.com",
  "gimail.com":      "gmail.com",
  "gnail.com":       "gmail.com",
  "gmal.com":        "gmail.com",
  "gmaio.com":       "gmail.com",
  // Yahoo
  "yaho.com":        "yahoo.com",
  "yahooo.com":      "yahoo.com",
  "yhoo.com":        "yahoo.com",
  "yahoo.co":        "yahoo.com",
  "yahoo.cm":        "yahoo.com",
  "yahoo.con":       "yahoo.com",
  "yaho.co.uk":      "yahoo.co.uk",
  "yahooo.co.uk":    "yahoo.co.uk",
  // Hotmail
  "hotmial.com":     "hotmail.com",
  "hotmil.com":      "hotmail.com",
  "hotmail.co":      "hotmail.com",
  "hotmail.cm":      "hotmail.com",
  "hotmail.con":     "hotmail.com",
  "hotmaill.com":    "hotmail.com",
  "homail.com":      "hotmail.com",
  "hotmali.com":     "hotmail.com",
  "htomail.com":     "hotmail.com",
  // Outlook
  "outlok.com":      "outlook.com",
  "outloook.com":    "outlook.com",
  "outlook.co":      "outlook.com",
  "outllook.com":    "outlook.com",
  "outlock.com":     "outlook.com",
  "outlookk.com":    "outlook.com",
  // iCloud / Apple
  "iclud.com":       "icloud.com",
  "icoud.com":       "icloud.com",
  "icloud.co":       "icloud.com",
  "iclooud.com":     "icloud.com",
  "iclould.com":     "icloud.com",
  // Live / MSN
  "live.co":         "live.com",
  "live.cm":         "live.com",
  "live.con":        "live.com",
  "msn.co":          "msn.com",
};

// Structural email regex — catches missing @, missing TLD, embedded spaces
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(raw: string): EmailValidationResult {
  const issues: EmailIssueType[] = [];
  let clean = raw;

  // 1. Strip all whitespace (leading, trailing, internal)
  const trimmed = raw.trim().replace(/\s+/g, "");
  if (trimmed !== raw) {
    issues.push("auto_fixed_whitespace");
    clean = trimmed;
  }

  // 2. Lowercase the entire address
  const lowered = clean.toLowerCase();
  if (lowered !== clean) {
    issues.push("auto_fixed_case");
    clean = lowered;
  }

  // 3. Hard syntax check — if it fails we can't use this email at all
  if (!EMAIL_RE.test(clean)) {
    return { original: raw, clean, issues: [...issues, "invalid_syntax"], valid: false };
  }

  // 4. Domain typo check — valid syntax but looks like a misspelling
  const atIdx = clean.lastIndexOf("@");
  const domain = clean.slice(atIdx + 1);
  let suggestion: string | undefined;

  if (DOMAIN_TYPO_MAP[domain]) {
    suggestion = clean.slice(0, atIdx + 1) + DOMAIN_TYPO_MAP[domain];
    issues.push("domain_typo");
  }

  return {
    original: raw,
    clean,
    issues,
    suggestion,
    // Domain typos are blocked — the address is almost certainly wrong.
    // The user must correct it in their source sheet and re-import.
    valid: !issues.includes("domain_typo"),
  };
}

export function validateEmailBatch(raws: string[]): {
  results: Map<string, EmailValidationResult>;
  summary: ImportValidationSummary;
} {
  const results = new Map<string, EmailValidationResult>();
  const seen = new Set<string>();
  let autoFixed = 0;
  let invalid = 0;
  let domainTypos = 0;
  let duplicates = 0;
  const details: EmailValidationResult[] = [];

  for (const raw of raws) {
    if (!raw?.trim()) continue;

    const result = validateEmail(raw);

    // Duplicate check — keyed on the cleaned address
    if (seen.has(result.clean)) {
      result.issues.push("duplicate");
      result.valid = false;
      duplicates++;
    } else {
      seen.add(result.clean);
    }

    // Tally (only count auto-fix once per email even if both whitespace + case)
    const hasAutoFix = result.issues.includes("auto_fixed_whitespace") ||
                       result.issues.includes("auto_fixed_case");
    if (hasAutoFix)                          autoFixed++;
    if (result.issues.includes("invalid_syntax")) invalid++;
    if (result.issues.includes("domain_typo"))    domainTypos++;

    results.set(raw, result);

    // Only surface rows that have something to report
    if (result.issues.length > 0) details.push(result);
  }

  return {
    results,
    summary: { autoFixed, invalid, domainTypos, duplicates, details },
  };
}
