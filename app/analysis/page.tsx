"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { LifecyclePanel } from "@/components/lifecycle/LifecyclePanel";
import { SyncKpiStrip } from "@/components/sync/SyncKpiStrip";
import { GrowthPanel } from "@/components/growth/GrowthPanel";
import { useSyncStats } from "@/hooks/useSyncStats";
import { useGrowthStats } from "@/hooks/useGrowthStats";
import { useLifecycleStats } from "@/hooks/useLifecycleStats";

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

export default function AnalysisPage() {
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useSyncStats();
  const { data: growthStats, isLoading: growthLoading } = useGrowthStats();
  const { data: lifecycleStats, isLoading: lifecycleLoading } = useLifecycleStats();

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
              <p className="text-sm font-bold text-gray-900 dark:text-white">Analysis</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Lifecycle · Sync · Growth</p>
            </div>
          </div>
          <ThemeToggle />
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

        {/* ── Member Growth ── */}
        <section>
          <SectionHeader
            title="Member Growth"
            subtitle="Active members added by date · excludes Non-Members and Resigned"
          />
          <GrowthPanel stats={growthStats} isLoading={growthLoading} />
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
