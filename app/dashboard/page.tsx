"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { AudienceStatsPanel } from "@/components/stats/AudienceStatsPanel";
import { useSyncStats } from "@/hooks/useSyncStats";
import { useSyncLogs } from "@/hooks/useSyncLogs";
import { useAudienceStats } from "@/hooks/useAudienceStats";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const [start, setStart] = useState(daysAgo(29));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));

  const { data: stats, isLoading: statsLoading } = useSyncStats();
  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceStats, isLoading: audienceLoading } = useAudienceStats();

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-hebe-deep">

      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-hebe-champagne/20 dark:border-hebe-deep-3
                         bg-white/95 dark:bg-hebe-deep-2/95 backdrop-blur-sm px-4 sm:px-6 py-3">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-3">

          {/* Brand */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Image
              src="/logo.png"
              alt="HHYC burgee"
              width={36}
              height={36}
              className="object-contain shrink-0 drop-shadow-sm"
            />
            <div className="min-w-0">
              <p className="font-serif text-xs sm:text-sm font-semibold tracking-wide text-hebe-ink dark:text-hebe-cream truncate leading-tight">
                {/* Abbreviated on very small screens */}
                <span className="sm:hidden">HHYC</span>
                <span className="hidden sm:inline">Hebe Haven Yacht Club</span>
              </p>
              <p className="text-[9px] sm:text-[10px] text-hebe-ink/45 dark:text-hebe-champagne/50 leading-tight mt-0.5 hidden xs:block">
                Sheets → Mailchimp
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />
            <Link
              href="/settings"
              className="flex items-center gap-1 sm:gap-1.5 rounded-lg border border-hebe-ink/15 dark:border-hebe-deep-3
                         px-2.5 py-2 text-xs text-hebe-ink/60 dark:text-hebe-champagne/60
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

        {/* KPI Strip */}
        <section>
          <SectionHeader
            title="Sync Overview"
            subtitle="Auto-refreshes every 30 seconds"
          />
          <SyncKpiStrip stats={stats} isLoading={statsLoading} />
        </section>

        {/* Audience Insights */}
        <section>
          <SectionHeader
            title="Audience Insights"
            subtitle="Computed from the sheet on each sync"
          />
          <AudienceStatsPanel stats={audienceStats} isLoading={audienceLoading} />
        </section>

        {/* Sync History */}
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
      <footer className="mt-12 border-t border-hebe-champagne/20 dark:border-hebe-deep-3 py-5 px-4 text-center">
        <p className="text-[9px] sm:text-[10px] text-hebe-ink/30 dark:text-hebe-champagne/30 font-serif tracking-widest uppercase">
          Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
