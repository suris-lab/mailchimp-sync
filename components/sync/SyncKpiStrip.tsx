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
  auth_failed:      "Auth failed — check CRON_SECRET",
  skipped_schedule: "Skipped (interval not elapsed)",
  lock_busy:        "Skipped (sync in progress)",
  started:          "Running",
  completed:        "Completed",
  error:            "Error",
};

const CRON_COLORS: Record<CronStatus["result"], string> = {
  checking:         "text-gray-400 dark:text-gray-600",
  auth_failed:      "text-hebe-red font-semibold",
  skipped_schedule: "text-gray-400 dark:text-gray-600",
  lock_busy:        "text-gray-400 dark:text-gray-600",
  started:          "text-gray-500 dark:text-gray-400",
  completed:        "text-gray-500 dark:text-gray-400",
  error:            "text-hebe-red font-semibold",
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

      {/* Cron diagnostics row — shows whether Vercel is hitting /api/sync */}
      <div className="flex items-center gap-1.5 px-1 text-[10px] text-gray-400 dark:text-gray-600">
        <span className="uppercase tracking-wider font-semibold">Cron</span>
        <span>·</span>
        {cs ? (
          <>
            <span>last hit {timeAgo(cs.hit_at)}</span>
            <span>·</span>
            <span className={CRON_COLORS[cs.result]}>{CRON_LABELS[cs.result]}</span>
            {cs.error && (
              <span className="text-hebe-red truncate max-w-[260px]" title={cs.error}>
                — {cs.error}
              </span>
            )}
          </>
        ) : (
          <span>no cron attempts recorded yet</span>
        )}
      </div>
    </div>
  );
}
