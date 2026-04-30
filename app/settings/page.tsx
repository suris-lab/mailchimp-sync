"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SchedulePanel } from "@/components/sync/SchedulePanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useSyncStats } from "@/hooks/useSyncStats";

export default function SettingsPage() {
  const { data: stats } = useSyncStats();

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">
      <header className="border-b border-hebe-champagne/20 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-hebe-ink/15 dark:border-gray-800 p-2
                         text-hebe-ink/50 dark:text-gray-500
                         hover:text-hebe-red dark:hover:text-hebe-red hover:border-hebe-red/30 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <Image src="/logo.png" alt="HHYC" width={30} height={30} className="object-contain" />
            <div>
              <p className="font-serif text-sm font-semibold text-hebe-ink dark:text-white">Settings</p>
              <p className="text-[10px] text-hebe-ink/40 dark:text-gray-500 mt-0.5">Sync schedule & configuration</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8 space-y-8">
        <section>
          <SectionHeader
            title="Sync Schedule"
            subtitle="Auto-sync runs via Vercel cron — manual and webhook syncs always run immediately"
          />
          <SchedulePanel lastSyncAt={stats?.last_sync_at} />
        </section>

        <section>
          <SectionHeader
            title="Diagnostics"
            subtitle="Check that all services are connected correctly"
          />
          <div className="rounded-xl border border-hebe-champagne/20 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
            <p className="text-xs text-hebe-ink/50 dark:text-gray-500 mb-4">
              Opens a JSON report showing the status of KV, Google Sheets, and Mailchimp connections.
            </p>
            <a
              href="/api/debug"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-hebe-ink/15 dark:border-gray-800
                         px-3 py-2 text-xs text-hebe-ink/70 dark:text-gray-300
                         hover:border-hebe-red hover:text-hebe-red transition-colors"
            >
              Run diagnostics →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
