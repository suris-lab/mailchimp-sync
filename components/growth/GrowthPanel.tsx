"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from "recharts";
import type { GrowthStats } from "@/lib/types";
import { useThemeColors } from "@/hooks/useThemeColors";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function GrowthTooltip({ active, payload, label, tc }: any) {
  if (!active || !payload?.length) return null;
  const value: number = payload[0]?.value ?? 0;
  return (
    <div
      style={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}` }}
      className="rounded-lg px-3 py-2 text-xs shadow-xl"
    >
      <p style={{ color: tc.tooltipMuted }}>{fmtAxisDate(label)}</p>
      <p style={{ color: "#eb0029" }} className="font-bold mt-0.5 text-sm">
        +{value.toLocaleString()} new
      </p>
    </div>
  );
}

// ── Window toggle ─────────────────────────────────────────────────────────────
type Window = "30" | "60";

// ── Main component ────────────────────────────────────────────────────────────
interface GrowthPanelProps {
  stats: GrowthStats | null | undefined;
  isLoading: boolean;
}

export function GrowthPanel({ stats, isLoading }: GrowthPanelProps) {
  const tc = useThemeColors();
  const [window, setWindow] = useState<Window>("60");

  if (isLoading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="flex gap-6 mb-6">
          <div className="h-14 w-28 rounded-lg bg-gray-100 dark:bg-gray-800" />
          <div className="h-14 w-28 rounded-lg bg-gray-100 dark:bg-gray-800" />
        </div>
        <div className="h-48 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        No growth data yet — run a sync first.
      </div>
    );
  }

  const series = window === "30" ? stats.dailyNew.slice(-30) : stats.dailyNew;
  const total = window === "30" ? stats.last30Days : stats.last60Days;
  const hasData = series.some((d) => d.value > 0);

  // Show a tick every ~7 days (roughly 4-8 ticks across the chart)
  const tickInterval = window === "30" ? 6 : 9;

  // Gradient id — unique so multiple charts don't clash
  const gradientId = "growthGradient";

  return (
    <div className="card p-5">
      {/* ── KPI row ── */}
      <div className="flex flex-wrap items-end gap-6 sm:gap-10 mb-5">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            New contacts — 30 days
          </p>
          <p className="text-3xl font-bold tabular-nums text-hebe-red leading-none">
            +{stats.last30Days.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">
            New contacts — 60 days
          </p>
          <p className="text-3xl font-bold tabular-nums text-gray-900 dark:text-white leading-none">
            +{stats.last60Days.toLocaleString()}
          </p>
        </div>

        {/* Window toggle — right-aligned on desktop */}
        <div className="ml-auto flex items-center gap-1 self-start sm:self-auto">
          {(["30", "60"] as Window[]).map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                window === w
                  ? "bg-hebe-red border-hebe-red text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {/* ── Trend chart ── */}
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600">
          No new contacts recorded in this window
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={tc.mobile ? 160 : 200}>
          <AreaChart data={series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#eb0029" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#eb0029" stopOpacity={0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              vertical={false}
              stroke={tc.dark ? "#1f2937" : "#f3f4f6"}
              strokeDasharray="3 3"
            />

            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: tc.tickColor }}
              tickLine={false}
              axisLine={false}
              interval={tickInterval}
              tickFormatter={fmtAxisDate}
            />

            <YAxis
              tick={{ fontSize: 10, fill: tc.tickColor }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />

            <Tooltip
              cursor={{ stroke: tc.tooltipBorder, strokeWidth: 1, strokeDasharray: "3 3" }}
              content={(props) => <GrowthTooltip {...props} tc={tc} />}
            />

            {/* Highlight today */}
            <ReferenceLine
              x={new Date().toISOString().slice(0, 10)}
              stroke={tc.tickColor}
              strokeDasharray="3 3"
              strokeWidth={1}
            />

            <Area
              type="monotone"
              dataKey="value"
              stroke="#eb0029"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, fill: "#eb0029", strokeWidth: 0 }}
              isAnimationActive
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* ── Sub-caption ── */}
      <p className="mt-3 text-[10px] text-gray-400 dark:text-gray-600">
        {total.toLocaleString()} new contacts added in the past {window} days · sourced from sync logs
      </p>
    </div>
  );
}
