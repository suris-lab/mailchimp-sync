"use client";

import { useState } from "react";
import Link from "next/link";
import { Settings } from "lucide-react";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
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
            <Link
              href="/settings"
              className="flex items-center gap-2 rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              <Settings size={13} />
              Settings
            </Link>
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
