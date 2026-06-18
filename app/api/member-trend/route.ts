import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { MemberTrendStats, MemberTrendEntry } from "@/lib/types";

const KV_KEY = "sync:member_trend_v3";
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
  const trimmed = raw.trim();
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
  const bust = new URL(request.url).searchParams.has("bust");

  if (!bust) {
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

  // Count additions per date from createdAt (only for dates in our window)
  const dateSet = new Set(dates);
  const added: Record<string, { qual: number; resigned: number; absent: number; nonMember: number }> = {};
  for (const date of dates) added[date] = { qual: 0, resigned: 0, absent: 0, nonMember: 0 };
  for (const t of tagged) {
    if (!dateSet.has(t.date)) continue;
    const a = added[t.date];
    if (t.qualifying) a.qual++;
    if (t.isResigned) a.resigned++;
    if (t.isAbsent)   a.absent++;
    if (t.isNonMember) a.nonMember++;
  }

  const current = {
    total: qualifying.length,
    active: qualifying.length - resignedN - absentN,
    resigned: resignedN,
    absent: absentN,
    non_member: nonMembers.length,
  };

  // Reconstruct historical totals by walking BACKWARDS from today's known counts.
  // This ensures the chart anchors to the real current total and subtracts additions
  // to estimate previous days — much more accurate than building up from createdAt alone.
  let rActive    = current.active;
  let rResigned  = current.resigned;
  let rAbsent    = current.absent;
  let rNonMember = current.non_member;

  const daily: MemberTrendEntry[] = new Array(dates.length);
  for (let i = dates.length - 1; i >= 0; i--) {
    daily[i] = { date: dates[i], active: rActive, resigned: rResigned, absent: rAbsent, non_member: rNonMember };
    const a = added[dates[i]];
    rActive    -= (a.qual - a.resigned - a.absent);
    rResigned  -= a.resigned;
    rAbsent    -= a.absent;
    rNonMember -= a.nonMember;
  }

  const stats: MemberTrendStats = {
    computed_at: new Date().toISOString(),
    current,
    daily,
  };

  await kvSet(KV_KEY, stats, CACHE_TTL);
  return NextResponse.json(stats);
}
