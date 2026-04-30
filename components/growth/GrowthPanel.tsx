"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import type { GrowthStats } from "@/lib/types";
import { useThemeColors } from "@/hooks/useThemeColors";

// ── Types ─────────────────────────────────────────────────────────────────────
type Window = "30" | "60";

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtAxisDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? null : 0; // can't compute % from zero
  return Math.round(((current - previous) / previous) * 100);
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

// ── Delta badge ───────────────────────────────────────────────────────────────
function DeltaBadge({ current, previous, windowDays }: { current: number; previous: number; windowDays: number }) {
  const pct = pctChange(current, previous);
  const isUp = pct !== null && pct > 0;
  const isDown = pct !== null && pct < 0;
  const isFlat = pct === 0;
  const noData = pct === null;

  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

  return (
    <div className="flex flex-col gap-1">
      {/* % change pill */}
      <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold w-fit ${
        isDown
          ? "bg-hebe-red/10 text-hebe-red"
          : isUp
          ? "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
          : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
      }`}>
        <Icon size={12} />
        {noData
          ? "No prior data"
          : isFlat
          ? "No change"
          : `${isUp ? "+" : ""}${pct}%`}
      </div>

      {/* Context line */}
      <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">
        {noData
          ? `No contacts in prev. ${windowDays}d`
          : `vs ${previous.toLocaleString()} in prev. ${windowDays}d`}
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
interface GrowthPanelProps {
  stats: GrowthStats | null | undefined;
  isLoading: boolean;
}

export function GrowthPanel({ stats, isLoading }: GrowthPanelProps) {
  const tc = useThemeColors();
  const [window, setWindow] = useState<Window>("30");

  if (isLoading) {
    return (
      <div className="card p-5 animate-pulse">
        <div className="h-8 w-40 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
        <div className="h-5 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-6" />
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

  const is30 = window === "30";
  const current  = is30 ? stats.last30Days : stats.last60Days;
  const previous = is30 ? stats.prev30Days  : stats.prev60Days;
  const windowDays = is30 ? 30 : 60;

  // Chart series: last N days of the 120-day array
  const series = stats.dailyNew.slice(is30 ? 90 : 60); // last 30 or last 60

  const tickInterval = is30 ? 6 : 9;

  return (
    <div className="card p-5">

      {/* ── Header row: headline + window toggle ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">

        {/* Left: KPI + delta */}
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            New contacts — {windowDays} days
          </p>
          <p className="text-4xl font-bold tabular-nums text-hebe-red leading-none">
            +{current.toLocaleString()}
          </p>
          <DeltaBadge current={current} previous={previous} windowDays={windowDays} />
        </div>

        {/* Right: toggle + previous period summary */}
        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-1">
            {(["30", "60"] as Window[]).map((w) => (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                  window === w
                    ? "bg-hebe-red border-hebe-red text-white"
                    : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-500"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
          {/* Previous period callout */}
          <div className="text-right">
            <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wide">
              Prev. {windowDays}d
            </p>
            <p className="text-xl font-bold tabular-nums text-gray-400 dark:text-gray-500 leading-none mt-0.5">
              +{previous.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-gray-100 dark:border-gray-800 mb-4" />

      {/* ── Trend chart ── */}
      <ResponsiveContainer width="100%" height={tc.mobile ? 140 : 180}>
        <AreaChart data={series} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <defs>
            <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#eb0029" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#eb0029" stopOpacity={0}    />
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

          <Area
            type="monotone"
            dataKey="value"
            stroke="#eb0029"
            strokeWidth={2}
            fill="url(#growthGrad)"
            dot={false}
            activeDot={{ r: 4, fill: "#eb0029", strokeWidth: 0 }}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
