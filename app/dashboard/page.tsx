"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, Sparkles, Database, BarChart2, Users, Zap, ClipboardList } from "lucide-react";
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

  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceStats, isLoading: audienceLoading } = useAudienceStats();
  const lastBackupAt = useBackupStatus();
  const { data: membershipStats } = useMembershipStats();
  const { data: automationsData, isLoading: automationsLoading } = useMailchimpAutomations();

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
