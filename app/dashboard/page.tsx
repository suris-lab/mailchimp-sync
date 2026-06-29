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
import { SyncErrorSparkline } from "@/components/sync/SyncErrorSparkline";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { AudienceStatsPanel } from "@/components/stats/AudienceStatsPanel";
import { CampaignPanel } from "@/components/campaigns/CampaignPanel";
import { HealthPulseBar } from "@/components/dashboard/HealthPulseBar";
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
  const [trendDays, setTrendDays] = useState<30 | 60 | 90>(30);
  const [trendTab, setTrendTab] = useState<"total" | "resigned" | "absent">("total");

  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceData, isLoading: audienceLoading } = useAudienceStats();
  const audienceStats = audienceData?.current ?? null;
  const audiencePrev  = audienceData?.previous ?? null;
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
          <div className="flex items-center gap-1.5 sm:gap-2">
            {[
              { href: "/membership", icon: <Users size={13} />,         label: "Membership" },
              { href: "/survey",     icon: <ClipboardList size={13} />, label: "Survey" },
              { href: "/analysis",   icon: <BarChart2 size={13} />,     label: "Analysis" },
              { href: "/studio",     icon: <Sparkles size={13} />,      label: "AI Studio" },
              { href: "/settings",   icon: <Settings size={13} />,      label: "Settings" },
            ].map(({ href, icon, label }) => (
              <Link
                key={href}
                href={href}
                title={label}
                className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                           px-2 py-2 lg:px-2.5 text-xs text-gray-500 dark:text-gray-400
                           hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                           transition-colors"
              >
                {icon}
                <span className="hidden lg:inline">{label}</span>
              </Link>
            ))}
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

          // For Resigned/Absent tabs: cumulative new events within the selected period
          let cumResigned = 0;
          let cumAbsent = 0;
          const periodResigned = sliced.map((d) => { cumResigned += d.new_resigned ?? 0; return cumResigned; });
          const periodAbsent   = sliced.map((d) => { cumAbsent   += d.new_absent   ?? 0; return cumAbsent; });
          const periodResignedTotal = periodResigned[periodResigned.length - 1] ?? 0;
          const periodAbsentTotal   = periodAbsent[periodAbsent.length - 1] ?? 0;

          const tabs = [
            { key: "total"    as const, label: "Total Members",        count: current ? current.active : 0, color: "#EB0029" },
            { key: "resigned" as const, label: `Resigned (${trendDays}d)`, count: periodResignedTotal,               color: "#374151" },
            { key: "absent"   as const, label: `Absent (${trendDays}d)`,   count: periodAbsentTotal,                 color: "#6b7280" },
          ];

          const dataKey = trendTab === "total" ? "Total Members" : trendTab === "resigned" ? "New Resigned" : "New Absent";
          const lineColor = tabs.find((t) => t.key === trendTab)!.color;

          const chartData = sliced.map((d, i) => ({
            date: fmtDate(d.date),
            "Total Members": d.active ?? 0,
            "New Resigned": periodResigned[i],
            "New Absent": periodAbsent[i],
          }));

          // Dynamic Y-axis: zoom into the selected series so small changes are visible
          const values = chartData.map((row) => Number((row as Record<string, string | number>)[dataKey])).filter((n) => !isNaN(n));
          const dataMin = Math.min(...values);
          const dataMax = Math.max(...values);
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
                      {(current.active).toLocaleString()}
                    </p>
                    <p className="text-sm font-bold tracking-[0.2em] uppercase text-gray-900 dark:text-white mt-4" style={{ fontFamily: "Helvetica, Arial, sans-serif" }}>
                      Total Members
                    </p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-1.5">
                      Excl. Non-Members, Staff, GM, Reciprocal Club, Absent, Resigned &amp; Backup emails
                    </p>
                  </>
                )}
              </div>

              {/* Trend chart */}
              {chartData.length > 0 && (
                <div className="px-4 pb-5">
                  {/* Controls row: tabs + date range */}
                  <div className="flex items-center justify-between mb-4 px-2 flex-wrap gap-2">
                    <div className="flex gap-1 border border-gray-200 dark:border-gray-700 rounded-lg p-0.5">
                      {tabs.map((t) => (
                        <button
                          key={t.key}
                          onClick={() => setTrendTab(t.key)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                            trendTab === t.key
                              ? "text-white"
                              : "text-gray-500 dark:text-gray-500 hover:text-gray-800 dark:hover:text-gray-300"
                          }`}
                          style={trendTab === t.key ? { backgroundColor: t.color } : {}}
                        >
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
                        <linearGradient id="gradLine" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={lineColor} stopOpacity={0.12} />
                          <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
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
                      <Area
                        type="monotone" dataKey={dataKey} stroke={lineColor} strokeWidth={2}
                        fill="url(#gradLine)" dot={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Resigned / Absent member list — shown when that tab is active */}
              {trendTab !== "total" && (() => {
                const members = trendTab === "resigned"
                  ? (trendData?.resigned_members ?? [])
                  : (trendData?.absent_members ?? []);
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - trendDays);
                const cutoffISO = cutoff.toISOString().slice(0, 10);
                const filtered = members.filter((m) => m.updatedAt && m.updatedAt >= cutoffISO);
                const noDate = members.filter((m) => !m.updatedAt);
                const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                const fmtD = (iso: string) => {
                  const m = parseInt(iso.slice(5, 7), 10) - 1;
                  const d = parseInt(iso.slice(8, 10), 10);
                  return `${MONTHS[m]} ${d}`;
                };
                return (
                  <div className="px-5 pb-5">
                    <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
                      {trendTab === "resigned" ? "Resigned" : "Absent"} Members — last {trendDays} days ({filtered.length})
                    </p>
                    {filtered.length === 0 ? (
                      <p className="text-xs text-gray-400">No records in this period</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-gray-800">
                              {["Member ID", "Name", "Membership", "Date"].map((h, i) => (
                                <th key={h} className={`py-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 ${i === 0 ? "text-left" : i === 3 ? "text-right" : "text-left"} pr-4`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                            {filtered.map((m) => (
                              <tr key={m.memberId} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                                <td className="py-1.5 pr-4 text-gray-500 dark:text-gray-400 font-mono text-[11px]">{m.memberId}</td>
                                <td className="py-1.5 pr-4 text-gray-700 dark:text-gray-300">{m.fullName}</td>
                                <td className="py-1.5 pr-4 text-gray-400 text-[11px]">{m.membership.replace("Member_", "")}</td>
                                <td className="py-1.5 text-right text-gray-400 tabular-nums text-[11px]">{m.updatedAt ? fmtD(m.updatedAt) : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {noDate.length > 0 && (
                      <p className="text-[10px] text-gray-400 mt-2">
                        + {noDate.length} members with no recorded date (not shown)
                      </p>
                    )}
                  </div>
                );
              })()}
            </section>
          );
        })()}

        {/* ── Health Pulse ── */}
        <HealthPulseBar
          trendDelta={(() => {
            const d = (trendData?.daily ?? []).slice(-trendDays);
            if (d.length < 2) return null;
            const first = (d[0].active ?? 0) + (d[0].resigned ?? 0) + (d[0].absent ?? 0);
            const last  = (d[d.length - 1].active ?? 0) + (d[d.length - 1].resigned ?? 0) + (d[d.length - 1].absent ?? 0);
            return last - first;
          })()}
          lastSync={logsData?.logs?.[0] ? {
            status: logsData.logs[0].status,
            ago: timeAgo(logsData.logs[0].timestamp),
          } : null}
          runningAutomations={runningCount}
          overdueCount={membershipStats?.overdueFollowUps.count ?? 0}
        />

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
              <div className="px-5 py-2 grid grid-cols-[1fr_80px_80px_70px_70px_70px_72px] gap-3 border-b border-gray-50 dark:border-gray-800/60">
                {["Name", "Type", "Status", "Started", "In Progress", "Completed", "Rate"].map((h, i) => (
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
                    className="grid grid-cols-[1fr_80px_80px_70px_70px_70px_72px] gap-3 items-center
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
                    {/* Completion rate */}
                    <span className={`text-[11px] tabular-nums text-right font-semibold ${
                      a.started && a.started > 0 && Math.round(((a.completed ?? 0) / a.started) * 100) < 50
                        ? "text-hebe-red"
                        : "text-gray-600 dark:text-gray-300"
                    }`}>
                      {a.started && a.started > 0
                        ? `${Math.round(((a.completed ?? 0) / a.started) * 100)}%`
                        : "—"}
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
                { count: membershipStats?.overdueFollowUps.count ?? 0,      label: "Overdue",      contacts: membershipStats?.overdueFollowUps.contacts ?? [],      isOverdue: true },
                { count: membershipStats?.upcomingBirthdays30.count ?? 0,   label: "Birthdays",    contacts: membershipStats?.upcomingBirthdays30.contacts ?? [],   isOverdue: false },
                { count: membershipStats?.upcomingAgeTier90.count ?? 0,     label: "Age-Tier",     contacts: membershipStats?.upcomingAgeTier90.contacts ?? [],     isOverdue: false },
                { count: membershipStats?.upcomingSAEligible180.count ?? 0, label: "SA Eligible",  contacts: membershipStats?.upcomingSAEligible180.contacts ?? [], isOverdue: false },
                { count: membershipStats?.upcomingTermExpiry120.count ?? 0, label: "Term Expiry",  contacts: membershipStats?.upcomingTermExpiry120.contacts ?? [], isOverdue: false },
              ].map(({ count, label, contacts, isOverdue }) => {
                const thisWeek = isOverdue
                  ? contacts.filter((c) => c.daysUntil >= -7).length
                  : contacts.filter((c) => c.daysUntil >= 0 && c.daysUntil <= 7).length;
                return (
                  <div key={label} className="text-center min-w-[48px]">
                    <p className={`text-2xl font-black tabular-nums leading-none ${
                      count > 0 ? "text-gray-900 dark:text-white" : "text-gray-200 dark:text-gray-700"
                    }`}>
                      {count}
                    </p>
                    <p className="text-[9px] font-semibold text-gray-400 mt-2 uppercase tracking-wider whitespace-nowrap">
                      {label}
                    </p>
                    {thisWeek > 0 && (
                      <p className="text-[9px] font-bold text-hebe-red mt-1 tabular-nums">
                        {thisWeek} {isOverdue ? "past 7d" : "this week"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </section>

        {/* ── Audience Insights ── */}
        <section>
          <SectionHeader
            title="Audience Insights"
            subtitle="Computed from the sheet on each sync"
          />
          <AudienceStatsPanel stats={audienceStats} previous={audiencePrev} isLoading={audienceLoading} />
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
          <SyncErrorSparkline logs={(logsData?.logs ?? []).slice(0, 10)} />
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
