import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { SheetContact } from "@/lib/types";
import type { MembershipContact, MembershipStats } from "@/lib/types";

const KV_KEY = "sync:membership_stats";
const CACHE_TTL = 3600; // 1 hour

// Parse "M/D/YYYY" or "MM/DD/YYYY" → Date at local midnight. Returns null on bad input.
function parseSheetDate(raw: string): Date | null {
  if (!raw) return null;
  const parts = raw.trim().split("/");
  if (parts.length !== 3) return null;
  const [m, d, y] = parts.map(Number);
  if (!m || !d || !y || y < 1900) return null;
  const date = new Date(y, m - 1, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

function todayMidnight(): Date {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function daysDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// For annual events (BDAY): does month/day fall within the next `days` days from today?
// Checks this year and next year to handle year-end wrap-around.
function annualWithinDays(
  d: Date,
  days: number,
): { matches: boolean; daysUntil: number } {
  const today = todayMidnight();
  const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());

  for (const candidate of [thisYear, nextYear]) {
    const diff = daysDiff(today, candidate);
    if (diff >= 0 && diff <= days) return { matches: true, daysUntil: diff };
  }
  return { matches: false, daysUntil: daysDiff(today, thisYear) };
}

// Is the date in [today, today+days]?
function withinDays(d: Date, days: number): boolean {
  const today = todayMidnight();
  const diff = daysDiff(today, d);
  return diff >= 0 && diff <= days;
}

// Is the date in the past, within the last `days` days?
function overdueWithinDays(d: Date, days: number): boolean {
  const today = todayMidnight();
  const diff = daysDiff(today, d); // negative = past
  return diff < 0 && diff >= -days;
}

function fmtDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${m}/${day}/${d.getFullYear()}`;
}

function toContact(
  c: SheetContact,
  date: Date,
  daysUntil: number,
  eventType: string,
): MembershipContact {
  return {
    memberId: c.memberId,
    fullName: c.fullName,
    email: c.email,
    membership: c.membership,
    date: fmtDate(date),
    daysUntil,
    eventType,
  };
}

// Age-tier triggers are only relevant when the contact is in the expected
// membership tier leading up to that birthday. Resigned contacts are excluded
// from all age-tier triggers regardless of tier.
const AGE_TIER_MEMBERSHIP: Record<string, string> = {
  "18th Birthday": "Member_Cadet",
  "21st Birthday": "Member_Junior",
  "25th Birthday": "Member_Associate1",
  "30th Birthday": "Member_Associate2",
};

function eligibleForAgeTier(c: SheetContact, label: string): boolean {
  if (c.membershipModifier === "Member_Resigned") return false;
  const required = AGE_TIER_MEMBERSHIP[label];
  return required ? c.membership === required : true;
}

function compute(contacts: SheetContact[]): MembershipStats {
  const birthdayBucket: MembershipContact[] = [];
  const ageTierBucket: MembershipContact[] = [];
  const saEligibleBucket: MembershipContact[] = [];
  const termExpiryBucket: MembershipContact[] = [];
  const overdueBucket: MembershipContact[] = [];

  const today = todayMidnight();
  let totalWithAnyDate = 0;
  let totalWithCoreDates = 0;

  for (const c of contacts) {
    const hasAny =
      c.bday || c.bday18 || c.bday21 || c.bday25 || c.bday30 ||
      c.saJoinDate || c.saGradDate || c.tJoinDate || c.tGradDate;
    if (hasAny) totalWithAnyDate++;

    const hasCore = !!(c.bday && c.bday18 && c.bday21 && c.bday25 && c.bday30);
    if (hasCore) totalWithCoreDates++;

    // Annual birthday check (next 30 days)
    const bday = parseSheetDate(c.bday);
    if (bday) {
      const { matches, daysUntil } = annualWithinDays(bday, 30);
      if (matches) birthdayBucket.push(toContact(c, bday, daysUntil, "Birthday"));
    }

    // Age-tier milestone checks (next 90 days)
    const milestones: [string, string][] = [
      [c.bday18, "18th Birthday"],
      [c.bday21, "21st Birthday"],
      [c.bday25, "25th Birthday"],
      [c.bday30, "30th Birthday"],
    ];
    for (const [raw, label] of milestones) {
      if (!eligibleForAgeTier(c, label)) continue;
      const d = parseSheetDate(raw);
      if (d && withinDays(d, 90)) {
        ageTierBucket.push(toContact(c, d, daysDiff(today, d), label));
      }
    }

    // SA graduation (next 180 days)
    const saGrad = parseSheetDate(c.saGradDate);
    if (saGrad && withinDays(saGrad, 180)) {
      saEligibleBucket.push(toContact(c, saGrad, daysDiff(today, saGrad), "SA Graduation"));
    }

    // Term expiry (next 120 days)
    const tGrad = parseSheetDate(c.tGradDate);
    if (tGrad && withinDays(tGrad, 120)) {
      termExpiryBucket.push(toContact(c, tGrad, daysDiff(today, tGrad), "Term Expiry"));
    }

    // Overdue follow-ups: milestone dates that passed in last 180 days
    const overdueCandidates: [string, string][] = [
      [c.bday18, "18th Birthday"],
      [c.bday21, "21st Birthday"],
      [c.bday25, "25th Birthday"],
      [c.bday30, "30th Birthday"],
      [c.saGradDate, "SA Graduation"],
      [c.tGradDate, "Term Expiry"],
    ];
    for (const [raw, label] of overdueCandidates) {
      if (!eligibleForAgeTier(c, label)) continue;
      const d = parseSheetDate(raw);
      if (d && overdueWithinDays(d, 180)) {
        overdueBucket.push(toContact(c, d, daysDiff(today, d), label));
      }
    }
  }

  const byDaysUntil = (a: MembershipContact, b: MembershipContact) =>
    a.daysUntil - b.daysUntil;

  birthdayBucket.sort(byDaysUntil);
  ageTierBucket.sort(byDaysUntil);
  saEligibleBucket.sort(byDaysUntil);
  termExpiryBucket.sort(byDaysUntil);
  overdueBucket.sort(byDaysUntil);

  const cap = <T>(arr: T[]) => arr.slice(0, 200);

  return {
    computed_at: new Date().toISOString(),
    totalWithAnyDate,
    totalWithCoreDates,
    upcomingBirthdays30: { count: birthdayBucket.length, contacts: cap(birthdayBucket) },
    upcomingAgeTier90: { count: ageTierBucket.length, contacts: cap(ageTierBucket) },
    upcomingSAEligible180: { count: saEligibleBucket.length, contacts: cap(saEligibleBucket) },
    upcomingTermExpiry120: { count: termExpiryBucket.length, contacts: cap(termExpiryBucket) },
    overdueFollowUps: { count: overdueBucket.length, contacts: cap(overdueBucket) },
  };
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const bust  = params.has("bust");
    const debug = params.get("debug"); // "30bday" | "18bday" | "21bday" | "25bday" | "all"

    // Debug mode: skip cache, return per-contact diagnostic for age-tier triggers
    if (debug) {
      const contacts = await fetchSheetContacts();
      const today = todayMidnight();

      const MILESTONE_FIELDS: Record<string, { raw: (c: SheetContact) => string; label: string }> = {
        "18bday": { raw: (c) => c.bday18, label: "18th Birthday" },
        "21bday": { raw: (c) => c.bday21, label: "21st Birthday" },
        "25bday": { raw: (c) => c.bday25, label: "25th Birthday" },
        "30bday": { raw: (c) => c.bday30, label: "30th Birthday" },
      };

      const targets = debug === "all"
        ? Object.values(MILESTONE_FIELDS)
        : [MILESTONE_FIELDS[debug.toLowerCase()]].filter(Boolean);

      const rows = contacts
        .filter((c) => targets.some(({ raw }) => raw(c)))
        .map((c) => {
          const checks = targets.map(({ raw, label }) => {
            const rawVal = raw(c);
            const parsed = parseSheetDate(rawVal);
            const resigned = c.membershipModifier === "Member_Resigned";
            const requiredTier = AGE_TIER_MEMBERSHIP[label];
            const tierMatch = requiredTier ? c.membership === requiredTier : true;
            const daysUntil = parsed ? daysDiff(today, parsed) : null;
            let bucket = "—";
            if (parsed) {
              if (withinDays(parsed, 90))        bucket = "ageTier (upcoming)";
              else if (overdueWithinDays(parsed, 180)) bucket = "overdue";
              else if (daysUntil !== null && daysUntil > 90) bucket = "too far (>90d)";
              else bucket = "too old (>180d past)";
            }
            return {
              trigger: label,
              raw_value: rawVal || "(empty)",
              parsed: parsed ? fmtDate(parsed) : null,
              days_until: daysUntil,
              resigned,
              required_tier: requiredTier,
              actual_tier: c.membership,
              tier_match: tierMatch,
              eligible: !resigned && tierMatch,
              would_appear_in: (!resigned && tierMatch && parsed) ? bucket : "excluded (eligibility)",
            };
          });
          return {
            memberId: c.memberId,
            fullName: c.fullName,
            email: c.email,
            membership: c.membership,
            membershipModifier: c.membershipModifier || "(none)",
            checks,
          };
        });

      return NextResponse.json({ debug_mode: debug, today: fmtDate(today), contacts: rows });
    }

    if (!bust) {
      const cached = await kvGet<MembershipStats>(KV_KEY);
      if (cached) return NextResponse.json(cached);
    }

    const contacts = await fetchSheetContacts();
    const stats = compute(contacts);
    await kvSet(KV_KEY, stats, CACHE_TTL);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[membership-stats]", err);
    return NextResponse.json({ error: "Failed to compute membership stats" }, { status: 500 });
  }
}
