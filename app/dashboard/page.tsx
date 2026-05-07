"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Settings, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { SyncLogTable } from "@/components/sync/SyncLogTable";
import { ManualSyncButton } from "@/components/sync/ManualSyncButton";
import { AudienceStatsPanel } from "@/components/stats/AudienceStatsPanel";
import { GrowthPanel } from "@/components/growth/GrowthPanel";
import { CampaignPanel } from "@/components/campaigns/CampaignPanel";
import { LifecyclePanel } from "@/components/lifecycle/LifecyclePanel";
import { useSyncStats } from "@/hooks/useSyncStats";
import { useSyncLogs } from "@/hooks/useSyncLogs";
import { useAudienceStats } from "@/hooks/useAudienceStats";
import { useGrowthStats } from "@/hooks/useGrowthStats";
import { useLifecycleStats } from "@/hooks/useLifecycleStats";

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function healthLabel(score: number): string {
  if (score >= 80) return "Good";
  if (score >= 60) return "Fair";
  if (score >= 40) return "At Risk";
  return "Critical";
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
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useSyncStats();
  const { data: logsData, isLoading: logsLoading } = useSyncLogs(start, end);
  const { data: audienceStats, isLoading: audienceLoading } = useAudienceStats();
  const { data: growthStats, isLoading: growthLoading } = useGrowthStats();
  const { data: lifecycleStats, isLoading: lifecycleLoading } = useLifecycleStats();

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
                <span className="ml-2 font-mono normal-case text-gray-300 dark:text-gray-700">
                  v{process.env.NEXT_PUBLIC_APP_VERSION}
                </span>
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
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

        {/* ── Contact Lifecycle ── */}
        <section>
          <SectionHeader
            title="Contact Lifecycle"
            collapsible={{
              isOpen: lifecycleOpen,
              onToggle: () => setLifecycleOpen((v) => !v),
              summary: lifecycleStats
                ? `Health Score: ${lifecycleStats.healthScore} · ${healthLabel(lifecycleStats.healthScore)} — ${lifecycleStats.current.total.toLocaleString()} contacts`
                : undefined,
            }}
          />
          {lifecycleOpen && <LifecyclePanel stats={lifecycleStats} isLoading={lifecycleLoading} />}
        </section>

        {/* ── Sync Overview ── */}
        <section>
          <SectionHeader
            title="Sync Overview"
            collapsible={{
              isOpen: syncOpen,
              onToggle: () => setSyncOpen((v) => !v),
              summary: stats?.last_sync_at
                ? `Last sync: ${timeAgo(stats.last_sync_at)} · ${stats.last_sync_status} · +${stats.last_new_added ?? 0} new, ${stats.last_updated ?? 0} updated`
                : stats ? "Never synced" : undefined,
            }}
          />
          {syncOpen && <SyncKpiStrip stats={stats} isLoading={statsLoading} />}
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
