"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, ChevronDown, ChevronUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { AudienceStatsPanel } from "@/components/stats/AudienceStatsPanel";
import { GrowthPanel } from "@/components/growth/GrowthPanel";
import { useSyncStats } from "@/hooks/useSyncStats";
import { useSyncLogs } from "@/hooks/useSyncLogs";
import { useAudienceStats } from "@/hooks/useAudienceStats";
import { useGrowthStats } from "@/hooks/useGrowthStats";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [overviewOpen, setOverviewOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useSyncStats();
  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceStats, isLoading: audienceLoading } = useAudienceStats();
  const { data: growthStats, isLoading: growthLoading } = useGrowthStats();

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-gray-200 dark:border-gray-800
                         bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-3 min-w-0">
            <Image
              src="/logo.png"
              alt="HHYC"
              width={48}
              height={48}
              className="object-contain shrink-0"
            />
            <div className="min-w-0 hidden sm:block">
              <p className="text-sm font-bold tracking-tight text-gray-900 dark:text-white leading-none">
                HHYC CRM Touchpoint System
              </p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 tracking-wide uppercase">
                Hebe Haven Yacht Club
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-2 text-xs text-gray-500 dark:text-gray-400
                         hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red
                         transition-colors"
            >
              <Settings size={13} />
              <span className="hidden sm:inline">Settings</span>
            </Link>
            <ManualSyncButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8 sm:space-y-10">

        {/* ── Sync Overview (collapsible) ── */}
        <section>
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <span className="block h-4 w-0.5 rounded-full bg-hebe-red shrink-0" />
              <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white uppercase">
                Sync Overview
              </h2>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">
                — auto-refreshes every 30s
              </span>
            </div>
            <button
              onClick={() => setOverviewOpen((v) => !v)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700
                         px-2.5 py-1.5 text-[11px] text-gray-400 dark:text-gray-500
                         hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
            >
              {overviewOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {overviewOpen ? "Collapse" : "Expand"}
            </button>
          </div>
          {overviewOpen && <SyncKpiStrip stats={stats} isLoading={statsLoading} />}
        </section>

        {/* ── Contact Growth ── */}
        <section>
          <SectionHeader
            title="Contact Growth"
            subtitle="New contacts added via sync — sourced from sync run logs"
          />
          <GrowthPanel stats={growthStats} isLoading={growthLoading} />
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
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <SectionHeader
              title="Sync History"
              subtitle={`${logsData?.total ?? 0} run(s) in selected range`}
            />
            <DateRangePicker
              start={start}
              end={end}
              onChange={(s, e) => { setStart(s); setEnd(e); }}
            />
          </div>
          <SyncLogTable logs={logsData?.logs ?? []} isLoading={logsLoading} />
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
