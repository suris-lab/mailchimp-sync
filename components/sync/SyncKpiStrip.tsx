import { KpiCard } from "@/components/ui/KpiCard";
import type { SyncStats } from "@/lib/types";

interface SyncKpiStripProps {
  stats: SyncStats | undefined;
  isLoading: boolean;
}

function fmt(n: number | undefined) {
  return n?.toLocaleString() ?? "—";
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}

export function SyncKpiStrip({ stats, isLoading }: SyncKpiStripProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
        ))}
      </div>
    );
  }

  const status = stats?.last_sync_status ?? "never";

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
      <KpiCard
        label="Total Synced"
        value={fmt(stats?.total_ever_synced)}
        sub="All time"
        accent="red"
      />
      <KpiCard
        label="Last — New"
        value={fmt(stats?.last_new_added)}
        sub="Added to Mailchimp"
        accent="neutral"
      />
      <KpiCard
        label="Last — Updated"
        value={fmt(stats?.last_updated)}
        sub="Contacts refreshed"
        accent="neutral"
      />
      <KpiCard
        label="Last Sync"
        value={status === "never" ? "Never" : fmtTime(stats?.last_sync_at)}
        sub={stats?.last_errors ? `${stats.last_errors} error(s)` : "No errors"}
        accent="neutral"
        badge={status}
        badgeVariant={status as "success" | "partial" | "error" | "never" | "skipped"}
      />
    </div>
  );
}
