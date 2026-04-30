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
    success: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700",
    partial: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700",
    error:   "bg-hebe-red/10 text-hebe-red border-hebe-red/30",
    skipped: "bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-transparent",
  };
  return (
    <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

function triggeredByLabel(by: SyncLog["triggered_by"]) {
  const map: Record<string, string> = {
    webhook: "text-hebe-navy dark:text-gray-300",
    cron:    "text-gray-500 dark:text-gray-400",
    manual:  "text-hebe-red",
  };
  return <span className={`text-xs font-medium ${map[by] ?? ""}`}>{by}</span>;
}

const thBase = "px-3 py-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500";

export function SyncLogTable({ logs, isLoading }: SyncLogTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-10 rounded-xl bg-gray-100 dark:bg-gray-900 animate-pulse" />
        ))}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        No sync runs in this date range.
      </div>
    );
  }

  // ── Mobile: card list ────────────────────────────────────────────────────────
  const MobileCards = () => (
    <div className="space-y-2 sm:hidden">
      {logs.map((log) => {
        const hasErrors = log.errors > 0 && log.error_details.length > 0;
        const isExpanded = expandedId === log.id;
        return (
          <div key={log.id} className="card px-4 py-3 space-y-2">
            <div className="flex items-center justify-between">
              {statusBadge(log.status)}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-base font-bold text-gray-900 dark:text-white">{log.new_added}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">New</p>
              </div>
              <div>
                <p className="text-base font-bold text-gray-600 dark:text-gray-400">{log.updated}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Updated</p>
              </div>
              <div>
                {hasErrors ? (
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    className="w-full"
                  >
                    <p className="text-base font-bold text-hebe-red flex items-center justify-center gap-0.5">
                      {log.errors}
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </p>
                    <p className="text-[10px] text-hebe-red/70">Errors</p>
                  </button>
                ) : (
                  <>
                    <p className="text-base font-bold text-gray-300 dark:text-gray-600">—</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500">Errors</p>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
              {triggeredByLabel(log.triggered_by)}
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                {log.duration_ms}ms · {log.total_contacts ?? 0} contacts
              </span>
            </div>
            {isExpanded && hasErrors && (
              <div className="mt-1 rounded-lg bg-hebe-red/5 p-3">
                <p className="text-xs font-semibold text-hebe-red mb-2">
                  Error details ({log.error_details.length})
                </p>
                <ul className="space-y-1">
                  {log.error_details.map((d, i) => (
                    <li key={i} className="rounded-md border border-hebe-red/20 bg-white dark:bg-gray-900 px-2 py-1 font-mono text-[10px] text-hebe-red/80 break-all">
                      {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ── Desktop: full table ──────────────────────────────────────────────────────
  const DesktopTable = () => (
    <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
            <th className={`${thBase} text-left`}>Time</th>
            <th className={`${thBase} text-left`}>Trigger</th>
            <th className={`${thBase} text-right`}>Total</th>
            <th className={`${thBase} text-right`}>Processed</th>
            <th className={`${thBase} text-right`}>New</th>
            <th className={`${thBase} text-right`}>Updated</th>
            <th className={`${thBase} text-right`}>Errors</th>
            <th className={`${thBase} text-right`}>Duration</th>
            <th className={`${thBase} text-left`}>Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
          {logs.map((log) => {
            const hasErrors = log.errors > 0 && log.error_details.length > 0;
            const isExpanded = expandedId === log.id;
            return (
              <>
                <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-3 py-3">{triggeredByLabel(log.triggered_by)}</td>
                  <td className="px-3 py-3 text-right text-xs text-gray-400 dark:text-gray-500">
                    {(log.total_contacts ?? "—").toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-500 dark:text-gray-400">
                    {log.contacts_processed.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-900 dark:text-white">
                    {log.new_added.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {log.updated.toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-xs">
                    {hasErrors ? (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                        className="inline-flex items-center gap-1 text-hebe-red hover:text-hebe-red-dark font-semibold transition-colors"
                      >
                        {log.errors}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-700">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-400 dark:text-gray-500">
                    {log.duration_ms}ms
                  </td>
                  <td className="px-3 py-3">{statusBadge(log.status)}</td>
                </tr>
                {isExpanded && (
                  <tr key={`${log.id}-err`} className="bg-hebe-red/5">
                    <td colSpan={9} className="px-3 py-3">
                      <p className="text-xs font-semibold text-hebe-red mb-2">
                        Error details ({log.error_details.length})
                      </p>
                      <ul className="space-y-1">
                        {log.error_details.map((d, i) => (
                          <li key={i} className="rounded-lg border border-hebe-red/20 bg-white dark:bg-gray-900 px-3 py-1.5 font-mono text-[11px] text-hebe-red/80 break-all">
                            {d}
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

  return (
    <>
      <MobileCards />
      <DesktopTable />
    </>
  );
}
