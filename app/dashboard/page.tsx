"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, Sparkles, Database, BarChart2, Users, Zap, ClipboardList, Calendar } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { AudienceStatsPanel } from "@/components/stats/AudienceStatsPanel";
import { CampaignPanel } from "@/components/campaigns/CampaignPanel";
import { useSyncLogs } from "@/hooks/useSyncLogs";
import { useAudienceStats } from "@/hooks/useAudienceStats";
import { useBackupStatus } from "@/hooks/useBackupStatus";
import { useMembershipStats } from "@/hooks/useMembershipStats";
import { useMailchimpAutomations } from "@/hooks/useMailchimpAutomations";
import { useMemberTrend } from "@/hooks/useMemberTrend";
import type { AutomationStatus } from "@/lib/types";

const AUTO_DOT: Record<AutomationStatus, string> = {
  sending: "bg-emerald-500",
  paused:  "bg-gray-400",
  save:    "bg-gray-300 dark:bg-gray-600",
};

const AUTO_LABEL: Record<AutomationStatus, string> = {
  sending: "Running",
  paused:  "Paused",
  save:    "Draft",
};

function workflowTypeLabel(type: string): string {
  const map: Record<string, string> = {
    emailSeries:     "Email Series",
    abandonedCart:   "Abandoned Cart",
    welcomeSeries:   "Welcome",
    dateAdded:       "Date-based",
    recurringEvent:  "Recurring",
    visitUrl:        "URL Trigger",
    tagBased:        "Tag-based",
    api:             "API Trigger",
    customerJourney: "Customer Journey",
  };
  return map[type] ?? type;
}

function fmtCount(n: number | null): string {
  if (n === null) return "—";
  return n.toLocaleString();
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

export default function DashboardPage() {
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [historyOpen, setHistoryOpen] = useState(false);
  const [trendDays, setTrendDays] = useState<30 | 60 | 90>(90);
  const [showTotal, setShowTotal] = useState(true);
  const [showResigned, setShowResigned] = useState(false);
  const [showAbsent, setShowAbsent] = useState(false);
  const [showNonMember, setShowNonMember] = useState(false);

  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceStats, isLoading: audienceLoading } = useAudienceStats();
  const lastBackupAt = useBackupStatus();
  const { data: membershipStats } = useMembershipStats();
  const { data: automationsData, isLoading: automationsLoading } = useMailchimpAutomations();
  const { data: trendData } = useMemberTrend();

  const automations = automationsData?.automations ?? [];
  const runningCount = automations.filter((a) => a.status === "sending").length;

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800
                         bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <Image src="/logo.png" alt="HHYC" width={48} height={48} className="object-contain shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                HHYC CRM Touchpoint System
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 tracking-wide uppercase">
                Hebe Haven Yacht Club
                <span className="ml-2 font-mono normal-case text-gray-300 dark:text-gray-700">
                  v{process.env.NEXT_PUBLIC_APP_VERSION}
                </span>
                {lastBackupAt && (
                  <span className="ml-3 normal-case tracking-normal inline-flex items-center gap-1 text-gray-300 dark:text-gray-700">
                    <Database size={9} />
                    {timeAgo(lastBackupAt)}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/membership"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <Users size={13} />
              <span>Membership</span>
            </Link>
            <Link
              href="/survey"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <ClipboardList size={13} />
              <span>Survey</span>
            </Link>
            <Link
              href="/analysis"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <BarChart2 size={13} />
              <span>Analysis</span>
            </Link>
            <Link
              href="/studio"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <Sparkles size={13} />
              <span>AI Studio</span>
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <Settings size={13} />
              <span>Settings</span>
            </Link>
            <ManualSyncButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Active Members Hero + Trend ── */}
        {(() => {
          const current = trendData?.current;
          const daily = trendData?.daily ?? [];
          const sliced = daily.slice(-trendDays);
          const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
          const fmtDate = (iso: string) => {
            const m = parseInt(iso.slice(5, 7), 10) - 1;
            const d = parseInt(iso.slice(8, 10), 10);
            return `${MONTHS[m]} ${d}`;
          };

          const chartData = sliced.map((d) => {
            const active    = d.active     ?? 0;
            const resigned  = d.resigned   ?? 0;
            const absent    = d.absent     ?? 0;
            const nonMember = d.non_member ?? 0;
            const row: Record<string, string | number> = {
              date: fmtDate(d.date),
              "Active Members": active,
            };
            if (showTotal)     row["Total"]      = active + resigned + absent;
            if (showResigned)  row["Resigned"]   = resigned;
            if (showAbsent)    row["Absent"]     = absent;
            if (showNonMember) row["Non-Member"] = nonMember;
            return row;
          });

          const toggles: { key: string; label: string; count: number; color: string; active: boolean; set: (v: boolean) => void }[] = [
            { key: "total",     label: "Total",       count: current?.total ?? 0,      color: "#374151", active: showTotal,     set: setShowTotal },
            { key: "resigned",  label: "Resigned",    count: current?.resigned ?? 0,   color: "#EB0029", active: showResigned,  set: setShowResigned },
            { key: "absent",    label: "Absent",       count: current?.absent ?? 0,     color: "#6b7280", active: showAbsent,    set: setShowAbsent },
            { key: "nonmember", label: "Non-Member",   count: current?.non_member ?? 0, color: "#9ca3af", active: showNonMember, set: setShowNonMember },
          ];

          // Dynamic Y-axis: zoom into the data range so small changes are visible
          const allValues = chartData.flatMap((row) =>
            Object.entries(row).filter(([k]) => k !== "date").map(([, v]) => Number(v)),
          ).filter((n) => !isNaN(n));
          const dataMin = Math.min(...allValues);
          const dataMax = Math.max(...allValues);
          const padding = Math.max(Math.ceil((dataMax - dataMin) * 0.3), 5);
          const yDomain: [number, number] = [Math.max(0, dataMin - padding), dataMax + padding];

          return (
            <section className="rounded-2xl bg-white dark:bg-black border border-gray-200 dark:border-gray-800 overflow-hidden">
              {/* Big number */}
              <div className="px-6 pt-10 pb-5 text-center">
                {!current ? (
                  <div className="h-32 flex items-center justify-center">
                    <div className="w-48 h-20 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                  </div>
                ) : (
                  <>
                    <p className="text-7xl sm:text-8xl font-bold tabular-nums leading-none text-hebe-red" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                      {current.active.toLocaleString()}
                    </p>
                    <p className="text-sm font-bold tracking-[0.2em] uppercase text-gray-900 dark:text-white mt-4" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                      Active Members
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
                      Excl. Non-Members, Staff, GM, Reciprocal Club, Resigned &amp; Absent
                    </p>
                  </>
                )}
              </div>

              {/* Trend chart */}
              {chartData.length > 0 && (
                <div className="px-4 pb-5">
                  {/* Controls row: toggles + date range */}
                  <div className="flex items-center justify-between mb-4 px-2 flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {toggles.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => t.set(!t.active)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            t.active
                              ? "border-transparent"
                              : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600"
                          }`}
                          style={t.active ? { backgroundColor: t.color + "20", color: t.color, borderColor: t.color + "40" } : {}}
                        >
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color, opacity: t.active ? 1 : 0.35 }} />
                          {t.label}
                          <span className="tabular-nums font-black text-sm">{t.count.toLocaleString()}</span>
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
                      {([30, 60, 90] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setTrendDays(d)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                            trendDays === d
                              ? "bg-hebe-red text-white"
                              : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-white"
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="gradActive" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#EB0029" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#EB0029" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#374151" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#374151" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} className="dark:[&>line]:stroke-gray-800" />
                      <XAxis
                        dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }}
                        axisLine={false} tickLine={false}
                        interval={trendDays <= 30 ? 6 : trendDays <= 60 ? 13 : 14}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={44}
                        domain={yDomain} allowDataOverflow
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12 }}
                        labelStyle={{ color: "#6b7280", fontSize: 11 }}
                        itemStyle={{ padding: 0 }}
                      />
                      {/* Total — toggled overlay behind Active */}
                      {showTotal && (
                        <Area
                          type="monotone" dataKey="Total" stroke="#374151" strokeWidth={1.5}
                          fill="url(#gradTotal)" dot={false}
                        />
                      )}
                      {/* Active Members — always visible, main line */}
                      <Area
                        type="monotone" dataKey="Active Members" stroke="#EB0029" strokeWidth={2}
                        fill="url(#gradActive)" dot={false}
                      />
                      {showResigned && (
                        <Area
                          type="monotone" dataKey="Resigned" stroke="#EB0029" strokeWidth={1.5}
                          strokeDasharray="6 3" fill="none" dot={false} opacity={0.6}
                        />
                      )}
                      {showAbsent && (
                        <Area
                          type="monotone" dataKey="Absent" stroke="#6b7280" strokeWidth={1.5}
                          strokeDasharray="4 3" fill="none" dot={false}
                        />
                      )}
                      {showNonMember && (
                        <Area
                          type="monotone" dataKey="Non-Member" stroke="#9ca3af" strokeWidth={1.5}
                          strokeDasharray="2 2" fill="none" dot={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          );
        })()}

        {/* ── Operations Hub ── */}
        <section>

          {/* Dark title bar */}
          <div className="rounded-t-2xl bg-gray-900 dark:bg-black border border-gray-800 px-5 py-4
                          flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black tracking-[0.28em] uppercase text-white">Operations Hub</p>
              <p className="text-[9px] text-gray-500 tracking-widest uppercase mt-0.5">Live system status</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 tracking-widest uppercase">Live</span>
            </div>
          </div>

          {/* Mailchimp Automations */}
          <div className="border-x border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">

            {/* Sub-header */}
            <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <Zap size={11} className="text-gray-400" />
                <p className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-400">
                  Mailchimp Automations
                </p>
              </div>
              {!automationsLoading && automationsData && (
                <span className="text-[9px] text-gray-400 tabular-nums">
                  {runningCount > 0 && (
                    <>
                      <span className="font-semibold text-gray-900 dark:text-white">{runningCount} running</span>
                      {" · "}
                    </>
                  )}
                  {automations.length} total
                </span>
              )}
            </div>

            {/* Column headers */}
            {!automationsLoading && automations.length > 0 && (
              <div className="px-5 py-2 grid grid-cols-[1fr_80px_80px_70px_70px_70px] gap-3 border-b border-gray-50 dark:border-gray-800/60">
                {["Name", "Type", "Status", "Started", "In Progress", "Completed"].map((h, i) => (
                  <span
                    key={h}
                    className={`text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 ${i >= 3 ? "text-right" : ""}`}
                  >
                    {h}
                  </span>
                ))}
              </div>
            )}

            {/* Rows */}
            {automationsLoading ? (
              <div className="px-5 py-3 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-8 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
                ))}
              </div>
            ) : automations.length === 0 ? (
              <p className="px-5 py-6 text-xs text-gray-400">No automations found in Mailchimp</p>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {automations.map((a) => (
                  <div
                    key={a.id}
                    className="grid grid-cols-[1fr_80px_80px_70px_70px_70px] gap-3 items-center
                               px-5 py-3 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors"
                  >
                    {/* Name + dot */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${AUTO_DOT[a.status] ?? "bg-gray-400"}`} />
                      <span className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                        {a.title}
                      </span>
                    </div>
                    {/* Type */}
                    <span className="text-[10px] text-gray-400 truncate">
                      {workflowTypeLabel(a.workflow_type)}
                    </span>
                    {/* Status badge */}
                    <span>
                      <span className={`inline-block text-[9px] font-semibold px-2 py-0.5 rounded-full border ${
                        a.status === "sending"
                          ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30"
                          : a.status === "paused"
                          ? "border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800"
                          : "border-gray-200 dark:border-gray-800 text-gray-400 dark:text-gray-600 bg-transparent"
                      }`}>
                        {AUTO_LABEL[a.status]}
                      </span>
                    </span>
                    {/* Started */}
                    <span className="text-[11px] tabular-nums text-gray-600 dark:text-gray-300 text-right">
                      {fmtCount(a.started)}
                    </span>
                    {/* In Progress */}
                    <span className="text-[11px] tabular-nums text-gray-600 dark:text-gray-300 text-right">
                      {fmtCount(a.in_progress)}
                    </span>
                    {/* Completed */}
                    <span className="text-[11px] tabular-nums text-gray-600 dark:text-gray-300 text-right">
                      {fmtCount(a.completed)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Membership Triggers — full-width strip */}
          <div className="rounded-b-2xl border border-t-0 border-gray-200 dark:border-gray-800
                          bg-white dark:bg-gray-900 px-6 py-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users size={11} className="text-gray-400" />
                <p className="text-[9px] font-black tracking-[0.2em] uppercase text-gray-400">
                  Membership Triggers
                </p>
              </div>
              <Link href="/membership" className="text-[10px] font-semibold text-hebe-red hover:underline">
                View all →
              </Link>
            </div>
            <div className="flex items-start gap-8">
              {[
                { count: membershipStats?.overdueFollowUps.count ?? 0,      label: "Overdue" },
                { count: membershipStats?.upcomingBirthdays30.count ?? 0,   label: "Birthdays" },
                { count: membershipStats?.upcomingAgeTier90.count ?? 0,     label: "Age-Tier" },
                { count: membershipStats?.upcomingSAEligible180.count ?? 0, label: "SA Eligible" },
                { count: membershipStats?.upcomingTermExpiry120.count ?? 0, label: "Term Expiry" },
              ].map(({ count, label }) => (
                <div key={label} className="text-center min-w-[48px]">
                  <p className={`text-2xl font-black tabular-nums leading-none ${
                    count > 0 ? "text-gray-900 dark:text-white" : "text-gray-200 dark:text-gray-700"
                  }`}>
                    {count}
                  </p>
                  <p className="text-[9px] font-semibold text-gray-400 mt-2 uppercase tracking-wider whitespace-nowrap">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </section>

        {/* ── Audience Insights ── */}
        <section>
          <SectionHeader
            title="Audience Insights"
            subtitle="Computed from the sheet on each sync"
          />
          <AudienceStatsPanel stats={audienceStats} isLoading={audienceLoading} />
        </section>

        {/* ── Sync History ── */}
        <section>
          <SectionHeader
            title="Sync History"
            collapsible={{
              isOpen: historyOpen,
              onToggle: () => setHistoryOpen((v) => !v),
            }}
          />
          {historyOpen && (
            <div className="mb-4 flex justify-end">
              <DateRangePicker
                start={start}
                end={end}
                onChange={(s, e) => { setStart(s); setEnd(e); }}
              />
            </div>
          )}
          <SyncLogTable
            logs={historyOpen ? (logsData?.logs ?? []) : (logsData?.logs ?? []).slice(0, 5)}
            isLoading={logsLoading}
          />
        </section>

        {/* ── Campaign Analytics ── */}
        <section>
          <SectionHeader
            title="Campaign Analytics"
            subtitle="Mailchimp email performance · categorised by subject"
          />
          <CampaignPanel />
        </section>

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
