import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { MemberTrendStats, MemberTrendEntry } from "@/lib/types";

const KV_KEY = "sync:member_trend_v2";
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

  // Build sorted date arrays for each series
  const sortedQual      = tagged.filter((t) => t.qualifying).map((t) => t.date).sort();
  const sortedResigned  = tagged.filter((t) => t.isResigned).map((t) => t.date).sort();
  const sortedAbsent    = tagged.filter((t) => t.isAbsent).map((t) => t.date).sort();
  const sortedNonMember = tagged.filter((t) => t.isNonMember).map((t) => t.date).sort();

  // Build 90-day date range
  const today = new Date();
  const dates: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Walk through sorted arrays to get cumulative counts at each date
  let qIdx = 0, rIdx = 0, aIdx = 0, nmIdx = 0;

  const daily: MemberTrendEntry[] = dates.map((date) => {
    while (qIdx  < sortedQual.length      && sortedQual[qIdx] <= date)      qIdx++;
    while (rIdx  < sortedResigned.length  && sortedResigned[rIdx] <= date)  rIdx++;
    while (aIdx  < sortedAbsent.length    && sortedAbsent[aIdx] <= date)    aIdx++;
    while (nmIdx < sortedNonMember.length && sortedNonMember[nmIdx] <= date) nmIdx++;
    return { date, active: qIdx - rIdx - aIdx, resigned: rIdx, absent: aIdx, non_member: nmIdx };
  });

  const current = {
    total: qualifying.length,
    active: qualifying.length - resignedN - absentN,
    resigned: resignedN,
    absent: absentN,
    non_member: nonMembers.length,
  };

  const stats: MemberTrendStats = {
    computed_at: new Date().toISOString(),
    current,
    daily,
  };

  await kvSet(KV_KEY, stats, CACHE_TTL);
  return NextResponse.json(stats);
}
