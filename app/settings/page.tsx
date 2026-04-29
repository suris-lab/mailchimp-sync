"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SchedulePanel } from "@/components/sync/SchedulePanel";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { useSyncStats } from "@/hooks/useSyncStats";

export default function SettingsPage() {
  const { data: stats } = useSyncStats();

  return (
    <div className="min-h-full bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="mx-auto max-w-3xl flex items-center gap-4">
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-700 p-2 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-white">Settings</h1>
            <p className="text-xs text-gray-400 mt-0.5">Sync schedule and configuration</p>
          </div>
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
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
            <p className="text-xs text-gray-400 mb-3">
              Opens a JSON report showing the status of KV, Google Sheets, and Mailchimp connections.
            </p>
            <a
              href="/api/debug"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-lg border border-gray-700 px-3 py-2 text-xs text-gray-300 hover:text-white hover:border-gray-500 transition-colors"
            >
              Run diagnostics →
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
