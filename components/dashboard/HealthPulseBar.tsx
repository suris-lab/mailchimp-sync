"use client";

import { TrendingUp, TrendingDown, Minus, RefreshCw, Zap, AlertTriangle } from "lucide-react";

interface Props {
  trendDelta: number | null;
  lastSync: { status: string; ago: string } | null;
  runningAutomations: number;
  overdueCount: number;
}

const STATUS_STYLE: Record<string, string> = {
  success: "text-gray-700 dark:text-gray-200",
  partial: "text-gray-500 dark:text-gray-400",
  error:   "text-hebe-red",
  skipped: "text-gray-400",
};

export function HealthPulseBar({ trendDelta, lastSync, runningAutomations, overdueCount }: Props) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900
                    grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 dark:divide-gray-800">
      {/* Member trend */}
      <div className="px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Member Trend</p>
        <div className="flex items-center gap-1.5">
          {trendDelta === null ? (
            <span className="text-sm font-bold text-gray-300 dark:text-gray-600">—</span>
          ) : trendDelta > 0 ? (
            <>
              <TrendingUp size={13} className="text-gray-700 dark:text-gray-300" />
              <span className="text-sm font-bold tabular-nums text-gray-700 dark:text-gray-300">+{trendDelta}</span>
            </>
          ) : trendDelta < 0 ? (
            <>
              <TrendingDown size={13} className="text-hebe-red" />
              <span className="text-sm font-bold tabular-nums text-hebe-red">{trendDelta}</span>
            </>
          ) : (
            <>
              <Minus size={13} className="text-gray-400" />
              <span className="text-sm font-bold tabular-nums text-gray-400">0</span>
            </>
          )}
        </div>
      </div>

      {/* Last sync */}
      <div className="px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Last Sync</p>
        {lastSync ? (
          <div className="flex items-center gap-1.5">
            <RefreshCw size={11} className={STATUS_STYLE[lastSync.status] ?? "text-gray-400"} />
            <span className={`text-sm font-bold ${STATUS_STYLE[lastSync.status] ?? "text-gray-400"}`}>
              {lastSync.status === "success" ? "OK" : lastSync.status === "error" ? "Error" : lastSync.status}
            </span>
            <span className="text-[10px] text-gray-400 ml-0.5">{lastSync.ago}</span>
          </div>
        ) : (
          <span className="text-sm font-bold text-gray-300 dark:text-gray-600">—</span>
        )}
      </div>

      {/* Automations */}
      <div className="px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Automations</p>
        <div className="flex items-center gap-1.5">
          <Zap size={11} className={runningAutomations > 0 ? "text-gray-700 dark:text-gray-300" : "text-gray-400"} />
          <span className={`text-sm font-bold tabular-nums ${runningAutomations > 0 ? "text-gray-700 dark:text-gray-300" : "text-gray-400"}`}>
            {runningAutomations} running
          </span>
        </div>
      </div>

      {/* Overdue */}
      <div className="px-4 py-3">
        <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Overdue</p>
        <div className="flex items-center gap-1.5">
          {overdueCount > 0 ? (
            <>
              <AlertTriangle size={11} className="text-hebe-red" />
              <span className="text-sm font-bold tabular-nums text-hebe-red">{overdueCount}</span>
            </>
          ) : (
            <span className="text-sm font-bold text-gray-300 dark:text-gray-600">0</span>
          )}
        </div>
      </div>
    </div>
  );
}
