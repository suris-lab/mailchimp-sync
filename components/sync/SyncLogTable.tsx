"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { SyncLog } from "@/lib/types";

interface SyncLogTableProps {
  logs: SyncLog[];
  isLoading: boolean;
}

function statusBadge(status: SyncLog["status"]) {
  const map = {
    success: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    partial: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    error: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${map[status]}`}>
      {status}
    </span>
  );
}

function triggeredByBadge(by: SyncLog["triggered_by"]) {
  const map = {
    webhook: "text-blue-400",
    cron: "text-purple-400",
    manual: "text-teal-400",
  };
  return <span className={`text-xs ${map[by]}`}>{by}</span>;
}

export function SyncLogTable({ logs, isLoading }: SyncLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 rounded-lg bg-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center text-sm text-gray-500">
        No sync runs in this date range. Run a sync to see logs here.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Time</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Trigger</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Total</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Processed</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">New</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Updated</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Errors</th>
            <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-400">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-400">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800 bg-gray-950">
          {logs.map((log) => {
            const hasErrors = log.errors > 0 && log.error_details.length > 0;
            const isExpanded = expandedId === log.id;
            return (
              <>
                <tr
                  key={log.id}
                  className="hover:bg-gray-900 transition-colors"
                >
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-300">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{triggeredByBadge(log.triggered_by)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{(log.total_contacts ?? "—").toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{log.contacts_processed.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-emerald-400">{log.new_added.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-purple-400">{log.updated.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right">
                    {hasErrors ? (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 transition-colors"
                      >
                        {log.errors}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <span className="text-gray-600">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">{log.duration_ms}ms</td>
                  <td className="px-4 py-3">{statusBadge(log.status)}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${log.id}-errors`} className="bg-red-950/20">
                    <td colSpan={9} className="px-4 py-3">
                      <p className="text-xs font-medium text-red-400 mb-2">Error details ({log.error_details.length})</p>
                      <ul className="space-y-1">
                        {log.error_details.map((detail, i) => (
                          <li
                            key={i}
                            className="rounded bg-gray-900 px-3 py-1.5 font-mono text-[11px] text-red-300 break-all"
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
