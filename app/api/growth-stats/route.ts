import { NextResponse } from "next/server";
import { kvGet, kvSet } from "@/lib/kv";
import { fetchSheetContacts } from "@/tools/google-sheets";
import type { GrowthStats } from "@/lib/types";

const KV_KEY = "sync:member_growth";
const CACHE_TTL = 3600; // 1 hour

// Parse "M/D/YYYY", "MM/DD/YYYY", or ISO prefix → "YYYY-MM-DD". Returns null on bad input.
function toISODate(raw: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().split(" ")[0]; // strip time component
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  const parts = trimmed.split("/");
  if (parts.length === 3) {
    const [m, d, y] = parts.map(Number);
    if (m && d && y && y > 1900) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return null;
}

export async function GET(request: Request) {
  const bust = new URL(request.url).searchParams.has("bust");

  if (!bust) {
    const cached = await kvGet<GrowthStats>(KV_KEY);
    if (cached) return NextResponse.json(cached);
  }

  const contacts = await fetchSheetContacts();

  // Qualifying members: membership contains "Member", excludes "Non-Member", excludes Resigned
  const members = contacts.filter((c) => {
    const m = c.membership ?? "";
    if (!m.includes("Member") || m.includes("Non-Member")) return false;
    if (c.membershipModifier === "Member_Resigned") return false;
    return true;
  });

  // Build a bucket for every day in the past 120 days
  const buckets: Record<string, number> = {};
  const today = new Date();
  for (let i = 0; i < 120; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }

  for (const c of members) {
    const date = toISODate(c.createdAt);
    if (date && date in buckets) {
      buckets[date]++;
    }
  }

  // Sorted chronologically — index 0 = oldest (119 days ago), last = today
  const dailyNew = Object.entries(buckets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));

  const current60 = dailyNew.slice(60);
  const prev60    = dailyNew.slice(0, 60);

  const last60Days = current60.reduce((s, d) => s + d.value, 0);
  const prev60Days = prev60.reduce((s, d) => s + d.value, 0);
  const last30Days = current60.slice(30).reduce((s, d) => s + d.value, 0);
  const prev30Days = current60.slice(0, 30).reduce((s, d) => s + d.value, 0);

  const stats: GrowthStats = { last30Days, last60Days, prev30Days, prev60Days, dailyNew };
  await kvSet(KV_KEY, stats, CACHE_TTL);
  return NextResponse.json(stats);
}
