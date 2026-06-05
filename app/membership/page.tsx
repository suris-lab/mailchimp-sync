"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp, ChevronsUpDown, X, RefreshCw } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { useMembershipStats } from "@/hooks/useMembershipStats";
import type { MembershipContact, MembershipStats } from "@/lib/types";

// ── Action list helpers ────────────────────────────────────────────────────────

type ActionStatus = "Future" | "Watch" | "Prepare" | "Urgent" | "Overdue" | "Eligible";

function getStatus(daysUntil: number, eventType: string): ActionStatus {
  // SA members who pass their grad date are "Eligible" — conversion is the member's choice,
  // not a deadline breach, so "Overdue" would be misleading.
  if (daysUntil < 0 && eventType === "SA Graduation") return "Eligible";
  if (daysUntil < 0)    return "Overdue";
  if (daysUntil <= 30)  return "Urgent";
  if (daysUntil <= 90)  return "Prepare";
  if (daysUntil <= 180) return "Watch";
  return "Future";
}

const STATUS_STYLES: Record<ActionStatus, string> = {
  Overdue:  "bg-hebe-red/10 text-hebe-red border border-hebe-red/30",
  Eligible: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800",
  Urgent:   "bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800",
  Prepare:  "bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800",
  Watch:    "bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800",
  Future:   "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
};

function triggerLabel(eventType: string): string {
  const map: Record<string, string> = {
    "Birthday":      "Birthday",
    "18th Birthday": "18BDAY",
    "21st Birthday": "21BDAY",
    "25th Birthday": "25BDAY",
    "30th Birthday": "30BDAY",
    "SA Graduation": "SA_GRADDATE",
    "Term Expiry":   "T_GRADDATE",
  };
  return map[eventType] ?? eventType;
}

const TIER_DISPLAY: Record<string, string> = {
  "Member_Cadet":           "Cadet",
  "Member_Junior":          "Junior",
  "Member_Associate1":      "Associate1",
  "Member_Associate2":      "Associate2",
  "Member_SeniorAssociate": "SeniorAssociate",
  "Member_Term":            "Term",
};

function tierLabel(raw: string): string {
  return TIER_DISPLAY[raw] ?? raw.replace(/^Member_/, "");
}

function suggestedAction(eventType: string, daysUntil: number): string {
  const overdue = daysUntil < 0;
  switch (eventType) {
    case "Birthday":
      return overdue ? "Send belated birthday greeting" : "Send birthday greeting";
    case "18th Birthday":
      return overdue ? "Follow up on Junior → SA conversion" : "Review conversion to Senior Associate";
    case "21st Birthday":
      return overdue ? "Follow up on Full Membership eligibility" : "Review Full Membership eligibility";
    case "25th Birthday":
    case "30th Birthday":
      return overdue ? "Follow up on membership tier review" : "Schedule membership tier review";
    case "SA Graduation":
      return overdue ? "Review Full Membership application" : "Invite to apply for Full Membership";
    case "Term Expiry":
      return overdue ? "Follow up — renewal offer overdue" : "Send membership renewal offer";
    default:
      return "Review member record";
  }
}

function buildActionList(stats: MembershipStats): MembershipContact[] {
  const all = [
    ...stats.upcomingBirthdays30.contacts,
    ...stats.upcomingAgeTier90.contacts,
    ...stats.upcomingSAEligible180.contacts,
    ...stats.upcomingTermExpiry120.contacts,
    ...stats.overdueFollowUps.contacts,
  ];
  // Deduplicate by email + eventType (same event can appear in multiple buckets only
  // if windows overlap — in practice they don't, but guard anyway)
  const seen = new Set<string>();
  const deduped = all.filter((c) => {
    const key = `${c.email}|${c.eventType}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.sort((a, b) => a.daysUntil - b.daysUntil);
}

// ── Action card with expandable contact table ──────────────────────────────────

interface ActionCardProps {
  label: string;
  windowLabel: string;
  count: number | undefined;
  contacts: MembershipContact[] | undefined;
  isLoading: boolean;
  showEventType?: boolean;
  pastTense?: boolean; // overdue: days shown as "X days ago"
}

function ActionCard({
  label,
  windowLabel,
  count,
  contacts,
  isLoading,
  showEventType = false,
  pastTense = false,
}: ActionCardProps) {
  const [open, setOpen] = useState(false);
  const hasItems = (count ?? 0) > 0;
  const accent = hasItems ? "border-l-hebe-red" : "border-l-gray-200 dark:border-l-gray-800";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse">
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
        <div className="h-8 w-12 rounded bg-gray-100 dark:bg-gray-800 mb-2" />
        <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-l-[3px] border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${accent}`}>
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </p>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${hasItems ? "text-hebe-red" : "text-gray-900 dark:text-white"}`}>
          {count ?? 0}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">{windowLabel}</p>
          {hasItems && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-hebe-red dark:hover:text-hebe-red transition-colors"
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {open ? "Hide" : "View"}
            </button>
          )}
        </div>
      </div>

      {open && contacts && contacts.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Member ID
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Full Name
                </th>
                {showEventType && (
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Event
                  </th>
                )}
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Date
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {pastTense ? "Days Ago" : "Days Until"}
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr
                  key={`${c.email}-${c.eventType}-${i}`}
                  className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-gray-400">
                    {c.memberId || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">
                    {c.fullName || c.email}
                  </td>
                  {showEventType && (
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {c.eventType}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono">
                    {c.date}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.daysUntil === 0 ? (
                      <span className="text-hebe-red font-semibold">Today</span>
                    ) : c.daysUntil > 0 ? (
                      <span className="text-gray-600 dark:text-gray-400">{c.daysUntil}d</span>
                    ) : (
                      <span className="text-hebe-red">{Math.abs(c.daysUntil)}d ago</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Action list table ─────────────────────────────────────────────────────────

type SortKey = "daysUntil" | "date" | "tier" | "triggerType";
type SortDir = "asc" | "desc";

const ALL_STATUSES: ActionStatus[] = ["Overdue", "Eligible", "Urgent", "Prepare", "Watch", "Future"];


function parseDateNum(d: string): number {
  const [m, day, y] = d.split("/").map(Number);
  return (y || 0) * 10000 + (m || 0) * 100 + (day || 0);
}

function FilterChip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-colors ${
        active
          ? "bg-hebe-red border-hebe-red text-white"
          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
      }`}
    >
      {label}
    </button>
  );
}

function SortTh({
  label, col, active, dir, onSort, align = "left",
}: {
  label: string; col: SortKey; active: boolean; dir: SortDir;
  onSort: (k: SortKey) => void; align?: "left" | "right";
}) {
  return (
    <th
      onClick={() => onSort(col)}
      className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-widest cursor-pointer select-none
                  transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-200
                  ${align === "right" ? "text-right" : "text-left"}`}
    >
      <span className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`}>
        {label}
        {active
          ? <span className="text-hebe-red">{dir === "asc" ? "↑" : "↓"}</span>
          : <ChevronsUpDown size={10} className="text-gray-300 dark:text-gray-700" />}
      </span>
    </th>
  );
}

function ActionListTable({ contacts }: { contacts: MembershipContact[] }) {
  const [tierFilter, setTierFilter]       = useState("");
  const [triggerFilter, setTriggerFilter] = useState("");
  const [statusFilter, setStatusFilter]   = useState("");
  const [sortKey, setSortKey]             = useState<SortKey>("daysUntil");
  const [sortDir, setSortDir]             = useState<SortDir>("asc");

  const allTiers = useMemo(
    () => Array.from(new Set(contacts.map((c) => c.membership || "—"))).sort(),
    [contacts],
  );
  const allTriggers = useMemo(
    () => Array.from(new Set(contacts.map((c) => triggerLabel(c.eventType)))),
    [contacts],
  );

  const filtered = useMemo(() => {
    let rows = contacts;
    if (tierFilter)    rows = rows.filter((c) => (c.membership || "—") === tierFilter);
    if (triggerFilter) rows = rows.filter((c) => triggerLabel(c.eventType) === triggerFilter);
    if (statusFilter)  rows = rows.filter((c) => getStatus(c.daysUntil, c.eventType) === statusFilter);
    return rows;
  }, [contacts, tierFilter, triggerFilter, statusFilter]);

  const sorted = useMemo(() => {
    const sign = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "daysUntil":   return (a.daysUntil - b.daysUntil) * sign;
        case "date":        return (parseDateNum(a.date) - parseDateNum(b.date)) * sign;
        case "tier":        return a.membership.localeCompare(b.membership) * sign;
        case "triggerType": return triggerLabel(a.eventType).localeCompare(triggerLabel(b.eventType)) * sign;
        default:            return 0;
      }
    });
  }, [filtered, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  }

  const anyFilter = !!(tierFilter || triggerFilter || statusFilter);

  function clearFilters() {
    setTierFilter(""); setTriggerFilter(""); setStatusFilter("");
  }

  if (contacts.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">No upcoming actions in any window</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">

      {/* ── Filter bar ── */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 space-y-2.5">
        {/* Row: Membership Tier */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-14">Tier</span>
          <FilterChip label="All" active={!tierFilter} onClick={() => setTierFilter("")} />
          {allTiers.map((t) => (
            <FilterChip key={t} label={tierLabel(t)} active={tierFilter === t} onClick={() => setTierFilter(tierFilter === t ? "" : t)} />
          ))}
        </div>
        {/* Row: Trigger Type */}
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-14">Trigger</span>
          <FilterChip label="All" active={!triggerFilter} onClick={() => setTriggerFilter("")} />
          {allTriggers.map((t) => (
            <FilterChip key={t} label={t} active={triggerFilter === t} onClick={() => setTriggerFilter(triggerFilter === t ? "" : t)} />
          ))}
        </div>
        {/* Row: Status */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 flex-1">
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 w-14">Status</span>
            <FilterChip label="All" active={!statusFilter} onClick={() => setStatusFilter("")} />
            {ALL_STATUSES.map((s) => (
              <FilterChip key={s} label={s} active={statusFilter === s} onClick={() => setStatusFilter(statusFilter === s ? "" : s)} />
            ))}
          </div>
          <div className="flex items-center gap-3 shrink-0 pl-4">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 tabular-nums">
              {sorted.length} / {contacts.length}
            </span>
            {anyFilter && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-hebe-red dark:hover:text-hebe-red transition-colors"
              >
                <X size={11} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs whitespace-nowrap">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900">
              <th className="px-4 py-3 pl-5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Member ID</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Member Name</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Email</th>
              <SortTh label="Membership Tier" col="tier"        active={sortKey === "tier"}        dir={sortDir} onSort={toggleSort} />
              <SortTh label="Trigger Type"    col="triggerType" active={sortKey === "triggerType"} dir={sortDir} onSort={toggleSort} />
              <SortTh label="Trigger Date"    col="date"        active={sortKey === "date"}        dir={sortDir} onSort={toggleSort} />
              <SortTh label="Days Remaining"  col="daysUntil"   active={sortKey === "daysUntil"}   dir={sortDir} onSort={toggleSort} align="right" />
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Status</th>
              <th className="px-4 py-3 pr-5 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">Suggested Action</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                  No records match the selected filters
                </td>
              </tr>
            ) : sorted.map((c, i) => {
              const status = getStatus(c.daysUntil, c.eventType);
              return (
                <tr
                  key={`${c.email}|${c.eventType}|${i}`}
                  className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-3 pl-5 font-mono text-gray-500 dark:text-gray-400">{c.memberId || "—"}</td>
                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-medium">{c.fullName || "—"}</td>
                  <td className="px-4 py-3 text-gray-400 dark:text-gray-500">{c.email}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{c.membership || "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
                      {triggerLabel(c.eventType)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-500 dark:text-gray-400">{c.date}</td>
                  <td className="px-4 py-3 tabular-nums text-right">
                    {c.daysUntil === 0
                      ? <span className="text-hebe-red font-semibold">Today</span>
                      : c.daysUntil > 0
                      ? <span className="text-gray-600 dark:text-gray-300">{c.daysUntil}d</span>
                      : <span className="text-hebe-red font-medium">{Math.abs(c.daysUntil)}d ago</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${STATUS_STYLES[status]}`}>
                      {status}
                    </span>
                  </td>
                  <td className="px-4 py-3 pr-5 text-gray-500 dark:text-gray-400 max-w-[260px] whitespace-normal">
                    {suggestedAction(c.eventType, c.daysUntil)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {contacts.length >= 200 && (
        <p className="px-5 py-3 text-[10px] text-gray-400 dark:text-gray-500 border-t border-gray-100 dark:border-gray-800">
          Showing first 200 records — sync more data to see all
        </p>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MembershipPage() {
  const { data: stats, isLoading, refresh } = useMembershipStats();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await refresh(); } finally { setRefreshing(false); }
  }

  const actionList = useMemo(
    () => (stats ? buildActionList(stats) : []),
    [stats],
  );

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-2
                         text-gray-400 dark:text-gray-500
                         hover:text-hebe-red dark:hover:text-hebe-red hover:border-hebe-red/30 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <Image src="/logo.png" alt="HHYC" width={30} height={30} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Membership</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Lifecycle tracking & upcoming actions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={refreshing || isLoading}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Overview ── */}
        <section>
          <SectionHeader
            title="Overview"
            subtitle="Date coverage across all contact records"
          />
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse">
                  <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
                  <div className="h-8 w-16 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <KpiCard
                label="Records With Dates"
                value={stats?.totalWithAnyDate?.toLocaleString() ?? "—"}
                sub="at least one date field filled"
              />
              <KpiCard
                label="Complete Core Data"
                value={stats?.totalWithCoreDates?.toLocaleString() ?? "—"}
                sub="bday + all 4 milestones filled"
              />
            </div>
          )}
        </section>

        {/* ── Upcoming Actions ── */}
        <section>
          <SectionHeader
            title="Upcoming Actions"
            subtitle="Member lifecycle events requiring follow-up"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              label="Birthdays"
              windowLabel="next 30 days"
              count={stats?.upcomingBirthdays30.count}
              contacts={stats?.upcomingBirthdays30.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Age-Tier Conversions"
              windowLabel="next 90 days"
              count={stats?.upcomingAgeTier90.count}
              contacts={stats?.upcomingAgeTier90.contacts}
              isLoading={isLoading}
              showEventType
            />
            <ActionCard
              label="SA → Full Member Eligible"
              windowLabel="next 180 days"
              count={stats?.upcomingSAEligible180.count}
              contacts={stats?.upcomingSAEligible180.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Term Memberships Expiring"
              windowLabel="next 120 days"
              count={stats?.upcomingTermExpiry120.count}
              contacts={stats?.upcomingTermExpiry120.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Overdue Follow-ups"
              windowLabel="passed in last 180 days"
              count={stats?.overdueFollowUps.count}
              contacts={stats?.overdueFollowUps.contacts}
              isLoading={isLoading}
              showEventType
              pastTense
            />
          </div>
        </section>

        {/* ── Tier Progression Tracker ── */}
        <section>
          <SectionHeader
            title="Tier Progression Tracker"
            subtitle="All lifecycle events consolidated · sorted by urgency"
          />
          {isLoading ? (
            <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 rounded bg-gray-100 dark:bg-gray-800" style={{ width: `${75 + (i % 3) * 8}%` }} />
              ))}
            </div>
          ) : (
            <ActionListTable contacts={actionList} />
          )}
        </section>

        {stats && (
          <p className="text-[10px] text-gray-300 dark:text-gray-700 text-right">
            Computed {new Date(stats.computed_at).toLocaleString()} · cached 1 hr
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-5 px-4 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-600 tracking-widest uppercase">
          Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
