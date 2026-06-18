import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { MemberTrendStats, MemberTrendEntry } from "@/lib/types";

const KV_KEY = "sync:member_trend";
const CACHE_TTL = 3600; // 1 hour

const EXCLUDED_MEMBERSHIPS = ["non-members", "all staff", "gm", "reciprocal_club"];

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

  // Filter to qualifying members only (exclude non-member types)
  const qualifying = contacts.filter(
    (c) => !EXCLUDED_MEMBERSHIPS.includes((c.membership ?? "").toLowerCase()),
  );

  const resigned = qualifying.filter(
    (c) => (c.membershipModifier ?? "").toLowerCase().includes("resigned"),
  );
  const absent = qualifying.filter(
    (c) => (c.membershipModifier ?? "").toLowerCase().includes("absent"),
  );

  // Parse createdAt dates for cumulative trend
  const withDate = qualifying
    .map((c) => ({
      date: toISODate(c.createdAt),
      isResigned: (c.membershipModifier ?? "").toLowerCase().includes("resigned"),
      isAbsent: (c.membershipModifier ?? "").toLowerCase().includes("absent"),
    }))
    .filter((c): c is { date: string; isResigned: boolean; isAbsent: boolean } => c.date !== null);

  // Sort by date ascending
  withDate.sort((a, b) => a.date.localeCompare(b.date));

  // Build 90-day date range
  const today = new Date();
  const dates: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Cumulative counts per day (contacts whose createdAt <= that day)
  let totalIdx = 0;
  let resignedIdx = 0;
  let absentIdx = 0;

  const sortedTotal = withDate.map((c) => c.date).sort();
  const sortedResigned = withDate.filter((c) => c.isResigned).map((c) => c.date).sort();
  const sortedAbsent = withDate.filter((c) => c.isAbsent).map((c) => c.date).sort();

  const daily: MemberTrendEntry[] = dates.map((date) => {
    while (totalIdx < sortedTotal.length && sortedTotal[totalIdx] <= date) totalIdx++;
    while (resignedIdx < sortedResigned.length && sortedResigned[resignedIdx] <= date) resignedIdx++;
    while (absentIdx < sortedAbsent.length && sortedAbsent[absentIdx] <= date) absentIdx++;
    return { date, total: totalIdx, resigned: resignedIdx, absent: absentIdx };
  });

  const current = {
    total: qualifying.length,
    resigned: resigned.length,
    absent: absent.length,
    active: qualifying.length - resigned.length - absent.length,
  };

  const stats: MemberTrendStats = {
    computed_at: new Date().toISOString(),
    current,
    daily,
  };

  await kvSet(KV_KEY, stats, CACHE_TTL);
  return NextResponse.json(stats);
}
