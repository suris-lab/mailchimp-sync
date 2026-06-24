import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { MemberTrendStats, MemberTrendEntry } from "@/lib/types";

const KV_KEY = "sync:member_trend_v6";
const CACHE_TTL = 3600; // 1 hour

function isNonMember(membership: string): boolean {
  const m = (membership ?? "").toLowerCase().replace(/[_\-\s]+/g, "");
  return m.includes("non") && m.includes("member");
}

function isExcludedMembership(membership: string): boolean {
  const m = (membership ?? "").toLowerCase().replace(/[_\-\s]+/g, "");
  return isNonMember(membership) ||
    m === "allstaff" || m === "gm" || m.includes("reciprocal");
}

function toISODate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().split(" ")[0]; // strip time component (e.g. "1/23/2026 19:58:34" → "1/23/2026")
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map(Number);
    if (m && d && y && y > 1900)
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return null;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const bust  = params.has("bust");
  const debug = params.has("debug");

  if (!bust && !debug) {
    const cached = await kvGet<MemberTrendStats>(KV_KEY);
    if (cached) return NextResponse.json(cached);
  }

  const contacts = await fetchSheetContacts();

  // Qualifying members (exclude non-member types, staff, GM, reciprocal)
  const qualifying = contacts.filter((c) => !isExcludedMembership(c.membership));
  const nonMembers = contacts.filter((c) => isNonMember(c.membership));

  const resignedN = qualifying.filter(
    (c) => (c.membershipModifier ?? "").toLowerCase().includes("resigned"),
  ).length;
  const absentN = qualifying.filter(
    (c) => (c.membershipModifier ?? "").toLowerCase().includes("absent"),
  ).length;

  // Debug: show raw resigned/absent members with their date fields
  if (debug) {
    const resignedContacts = qualifying
      .filter((c) => (c.membershipModifier ?? "").toLowerCase().includes("resigned"))
      .map((c) => ({
        memberId: c.memberId,
        fullName: c.fullName,
        membership: c.membership,
        modifier: c.membershipModifier,
        createdAt_raw: c.createdAt,
        updatedAt_raw: c.updatedAt,
        createdAt_parsed: toISODate(c.createdAt),
        updatedAt_parsed: toISODate(c.updatedAt),
      }));
    const absentContacts = qualifying
      .filter((c) => (c.membershipModifier ?? "").toLowerCase().includes("absent"))
      .map((c) => ({
        memberId: c.memberId,
        fullName: c.fullName,
        modifier: c.membershipModifier,
        updatedAt_raw: c.updatedAt,
        updatedAt_parsed: toISODate(c.updatedAt),
      }));
    return NextResponse.json({
      total_qualifying: qualifying.length,
      resigned_count: resignedContacts.length,
      absent_count: absentContacts.length,
      resigned_members: resignedContacts,
      absent_members: absentContacts.slice(0, 20),
    });
  }

  // Tag each contact with flags + parsed date for cumulative trend
  type Tagged = { date: string; qualifying: boolean; isResigned: boolean; isAbsent: boolean; isNonMember: boolean };
  const tagged: Tagged[] = [];

  for (const c of contacts) {
    const date = toISODate(c.createdAt);
    if (!date) continue;
    const qual = !isExcludedMembership(c.membership);
    const mod = (c.membershipModifier ?? "").toLowerCase();
    tagged.push({
      date,
      qualifying: qual,
      isResigned: qual && mod.includes("resigned"),
      isAbsent: qual && mod.includes("absent"),
      isNonMember: isNonMember(c.membership),
    });
  }

  // Build 90-day date range
  const today = new Date();
  const dates: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Count new qualifying members per date from createdAt (for total members trend)
  const dateSet = new Set(dates);
  const addedQual: Record<string, number> = {};
  for (const date of dates) addedQual[date] = 0;
  for (const t of tagged) {
    if (!dateSet.has(t.date)) continue;
    if (t.qualifying) addedQual[t.date]++;
  }

  // Count resigned/absent events per day using updatedAt (when modifier was changed).
  // createdAt is irrelevant — a member created in 2020 may resign in 2026.
  const newResignedPerDay: Record<string, number> = {};
  const newAbsentPerDay: Record<string, number> = {};
  for (const date of dates) { newResignedPerDay[date] = 0; newAbsentPerDay[date] = 0; }
  for (const c of qualifying) {
    const mod = (c.membershipModifier ?? "").toLowerCase();
    if (!mod.includes("resigned") && !mod.includes("absent")) continue;
    const eventDate = toISODate(c.updatedAt);
    if (!eventDate || !dateSet.has(eventDate)) continue;
    if (mod.includes("resigned")) newResignedPerDay[eventDate]++;
    if (mod.includes("absent"))   newAbsentPerDay[eventDate]++;
  }

  const current = {
    total: qualifying.length,
    active: qualifying.length - resignedN,
    resigned: resignedN,
    absent: absentN,
    non_member: nonMembers.length,
  };

  // Reconstruct historical totals by walking BACKWARDS from today's known counts.
  let rActive    = current.active;
  let rResigned  = current.resigned;
  let rAbsent    = current.absent;
  let rNonMember = current.non_member;

  const daily: MemberTrendEntry[] = new Array(dates.length);
  for (let i = dates.length - 1; i >= 0; i--) {
    const nr = newResignedPerDay[dates[i]];
    const na = newAbsentPerDay[dates[i]];
    daily[i] = {
      date: dates[i], active: rActive, resigned: rResigned, absent: rAbsent, non_member: rNonMember,
      new_resigned: nr, new_absent: na,
    };
    // Walk backwards: subtract today's new members, add back today's resignations/absences
    rActive    -= (addedQual[dates[i]] - nr - na);
    rResigned  -= nr;
    rAbsent    -= na;
    rNonMember -= 0; // non-member changes not tracked by updatedAt
  }

  const stats: MemberTrendStats = {
    computed_at: new Date().toISOString(),
    current,
    daily,
  };

  await kvSet(KV_KEY, stats, CACHE_TTL);
  return NextResponse.json(stats);
}
