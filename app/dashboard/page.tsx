"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { SchedulePanel } from "@/components/sync/SchedulePanel";
import { useSyncStats } from "@/hooks/useSyncStats";
import { useSyncLogs } from "@/hooks/useSyncLogs";

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

  return (
    <div className="min-h-full bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-white">Sheets → Mailchimp Sync</h1>
            <p className="text-xs text-gray-400 mt-0.5">Real-time contact sync dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => document.getElementById("sync-schedule")?.scrollIntoView({ behavior: "smooth" })}
              title="Settings"
              className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              <Settings size={14} />
            </button>
            <ManualSyncButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8 space-y-8">
        {/* KPI Strip */}
        <section>
          <SectionHeader
            title="Sync Overview"
            subtitle="Auto-refreshes every 30 seconds"
          />
          <SyncKpiStrip stats={stats} isLoading={statsLoading} />
        </section>

        {/* Schedule */}
        <section id="sync-schedule">
          <SectionHeader
            title="Sync Schedule"
            subtitle="Auto-sync runs via Vercel cron — manual and webhook syncs always run immediately"
          />
          <SchedulePanel lastSyncAt={stats?.last_sync_at} />
        </section>

        {/* Sync Log */}
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
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
    </div>
  );
}
