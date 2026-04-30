"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SyncLog } from "@/lib/types";

interface SyncLogTableProps {
  logs: SyncLog[];
  isLoading: boolean;
}

function statusBadge(status: SyncLog["status"]) {
  const map: Record<string, string> = {
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    partial: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
    error:   "bg-hebe-red/10 text-hebe-red border-hebe-red/30",
    skipped: "bg-hebe-ink/5 text-hebe-ink/50 dark:bg-hebe-deep-3 dark:text-hebe-champagne/50 border-hebe-champagne/20 dark:border-hebe-deep-3",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${map[status]}`}>
      {status}
    </span>
  );
}

function triggeredByBadge(by: SyncLog["triggered_by"]) {
  const map: Record<string, string> = {
    webhook: "text-hebe-navy dark:text-hebe-champagne",
    cron:    "text-violet-600 dark:text-violet-400",
    manual:  "text-hebe-red",
  };
  return <span className={`text-xs font-medium ${map[by]}`}>{by}</span>;
}

const thCell = "px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/40 dark:text-hebe-champagne/40";
const thCellR = "px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/40 dark:text-hebe-champagne/40";

export function SyncLogTable({ logs, isLoading }: SyncLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-hebe-ink/5 dark:bg-hebe-deep-2 animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-8 text-center text-sm text-hebe-ink/40 dark:text-hebe-champagne/40">
        No sync runs in this date range.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hebe-champagne/20 dark:border-hebe-deep-3 bg-hebe-cream/60 dark:bg-hebe-deep-2">
            <th className={thCell}>Time</th>
            <th className={thCell}>Trigger</th>
            <th className={thCellR}>Total</th>
            <th className={thCellR}>Processed</th>
            <th className={thCellR}>New</th>
            <th className={thCellR}>Updated</th>
            <th className={thCellR}>Errors</th>
            <th className={thCellR}>Duration</th>
            <th className={thCell}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hebe-champagne/10 dark:divide-hebe-deep-3 bg-white dark:bg-hebe-deep">
          {logs.map((log) => {
            const hasErrors = log.errors > 0 && log.error_details.length > 0;
            const isExpanded = expandedId === log.id;
            return (
              <>
                <tr
                  key={log.id}
                  className="hover:bg-hebe-cream dark:hover:bg-hebe-deep-2 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-hebe-ink/70 dark:text-hebe-champagne/70">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{triggeredByBadge(log.triggered_by)}</td>
                  <td className="px-4 py-3 text-right text-xs text-hebe-ink/40 dark:text-hebe-champagne/40">
                    {(log.total_contacts ?? "—").toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-hebe-ink/70 dark:text-hebe-champagne/70">
                    {log.contacts_processed.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    {log.new_added.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-violet-600 dark:text-violet-400 font-medium">
                    {log.updated.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {hasErrors ? (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1 text-hebe-red hover:text-hebe-red-dark transition-colors font-medium"
                      >
                        {log.errors}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <span className="text-hebe-ink/25 dark:text-hebe-champagne/25">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-hebe-ink/40 dark:text-hebe-champagne/40">
                    {log.duration_ms}ms
                  </td>
                  <td className="px-4 py-3">{statusBadge(log.status)}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${log.id}-errors`} className="bg-hebe-red/5">
                    <td colSpan={9} className="px-4 py-3">
                      <p className="text-xs font-semibold text-hebe-red mb-2">
                        Error details ({log.error_details.length})
                      </p>
                      <ul className="space-y-1">
                        {log.error_details.map((detail, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-hebe-red/20 bg-white dark:bg-hebe-deep-2 px-3 py-1.5 font-mono text-[11px] text-hebe-red/80 break-all"
                          >
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
