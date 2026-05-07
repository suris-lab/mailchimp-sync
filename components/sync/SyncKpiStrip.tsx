import { KpiCard } from "@/components/ui/KpiCard";
import type { SyncStats, CronStatus } from "@/lib/types";

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

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

const CRON_LABELS: Record<CronStatus["result"], string> = {
  checking:         "Checking…",
  auth_failed:      "Auth failed",
  skipped_schedule: "Skipped (interval)",
  lock_busy:        "Lock busy",
  started:          "Running",
  completed:        "Completed",
  error:            "Error",
};

const CRON_PILL_STYLES: Record<CronStatus["result"], string> = {
  checking:         "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600",
  auth_failed:      "bg-hebe-red/10 text-hebe-red border border-hebe-red/30",
  skipped_schedule: "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600",
  lock_busy:        "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600",
  started:          "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  completed:        "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400",
  error:            "bg-hebe-red/10 text-hebe-red border border-hebe-red/30",
};

export function SyncKpiStrip({ stats, isLoading }: SyncKpiStripProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const status = stats?.last_sync_status ?? "never";
  const cs = stats?.cron_status;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2">
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

      {/* Cron diagnostics — two-line layout for readability */}
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-600">
          <span className="text-[10px] uppercase tracking-wider font-semibold">Cron</span>
          <span>·</span>
          {cs ? (
            <span>last hit {timeAgo(cs.hit_at)}</span>
          ) : (
            <span>no cron attempts recorded yet</span>
          )}
        </div>
        {cs && (
          <div className="flex items-center gap-2 pl-0.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CRON_PILL_STYLES[cs.result]}`}>
              {CRON_LABELS[cs.result]}
            </span>
            {cs.error && (
              <span className="text-[10px] text-hebe-red truncate max-w-[260px]" title={cs.error}>
                {cs.error}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
