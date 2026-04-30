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
      <header className="border-b border-hebe-champagne/20 bg-white dark:bg-hebe-deep-2 dark:border-hebe-deep-3 px-6 py-3 sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">

          {/* Brand identity */}
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="HHYC burgee"
              width={40}
              height={40}
              className="object-contain drop-shadow-sm"
            />
            <div>
              <p className="font-serif text-sm font-semibold tracking-wide text-hebe-ink dark:text-hebe-cream leading-tight">
                Hebe Haven Yacht Club
              </p>
              <p className="text-[10px] text-hebe-ink/50 dark:text-hebe-champagne/60 leading-tight mt-0.5">
                Sheets → Mailchimp Sync
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/settings"
              className="flex items-center gap-1.5 rounded-lg border border-hebe-ink/15 px-3 py-2 text-xs
                         text-hebe-ink/70 hover:text-hebe-ink hover:border-hebe-ink/30 transition-colors
                         dark:border-hebe-deep-3 dark:text-hebe-champagne/70 dark:hover:text-hebe-cream dark:hover:border-hebe-champagne/40"
            >
              <Settings size={13} />
              Settings
            </Link>
            <ManualSyncButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-10">

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

        {/* Sync Log */}
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
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
      <footer className="mt-12 border-t border-hebe-champagne/20 dark:border-hebe-deep-3 py-5 px-6 text-center">
        <p className="text-[10px] text-hebe-ink/30 dark:text-hebe-champagne/30 font-serif tracking-wide">
          HEBE HAVEN YACHT CLUB · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
