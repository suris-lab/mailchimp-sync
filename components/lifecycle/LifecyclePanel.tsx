"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";
import type { LifecycleStats, LifecycleStageCounts, LifecycleHistoryEntry } from "@/lib/types";
import { KpiCard } from "@/components/ui/KpiCard";
import { useThemeColors } from "@/hooks/useThemeColors";

type Window = "30" | "60" | "90";

const STAGE_COLORS = {
  new:    "#05308C",  // navy
  active: "#eb0029",  // red
  cold:   "#7B5E3A",  // brown
  dead:   "#9ca3af",  // gray-400
} as const;

const STAGE_LABELS = {
  new:    "New",
  active: "Active",
  cold:   "Cold",
  dead:   "Dead",
} as const;

const STAGES = ["active", "new", "cold", "dead"] as const;

function healthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "Good",     color: "#eb0029" };
  if (score >= 60) return { label: "Fair",     color: "#7B5E3A" };
  if (score >= 40) return { label: "At Risk",  color: "#6b7280" };
  return              { label: "Critical", color: "#9ca3af" };
}

function pct(n: number, total: number): string {
  return total > 0 ? `${((n / total) * 100).toFixed(1)}%` : "–";
}

function fmtAxisDate(d: string): string {
  const parts = d.split("-");
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

// ── Health Score ──────────────────────────────────────────────────────────────
function HealthScoreDisplay({ score }: { score: number }) {
  const { label, color } = healthLabel(score);
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        Database Health Score
      </p>
      <div className="flex items-end gap-3 mt-2">
        <p className="text-6xl font-bold tabular-nums leading-none" style={{ color }}>
          {score}
        </p>
        <div className="mb-1.5">
          <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">/100</p>
          <p className="text-sm font-semibold mt-1" style={{ color }}>{label}</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ── Stage Cards ───────────────────────────────────────────────────────────────
function StageCardGrid({ current }: { current: LifecycleStageCounts }) {
  const { total } = current;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard
        label="New"
        value={current.new.toLocaleString()}
        sub={`${pct(current.new, total)} · joined ≤7d`}
        accent="navy"
      />
      <KpiCard
        label="Active"
        value={current.active.toLocaleString()}
        sub={`${pct(current.active, total)} · opened ≤30d`}
        accent="red"
      />
      <KpiCard
        label="Cold"
        value={current.cold.toLocaleString()}
        sub={`${pct(current.cold, total)} · 30–90d inactive`}
        accent="brown"
      />
      <KpiCard
        label="Dead"
        value={current.dead.toLocaleString()}
        sub={`${pct(current.dead, total)} · 90d+ or never`}
        accent="neutral"
      />
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function LifecycleTooltip({
  active, payload, label, tc,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  label?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tc: any;
}) {
  if (!active || !payload?.length) return null;
  const vals: Record<string, number> = {};
  for (const p of payload) vals[p.dataKey as string] = p.value ?? 0;

  return (
    <div
      style={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}` }}
      className="rounded-lg px-3 py-2 text-xs shadow-xl min-w-[140px]"
    >
      <p style={{ color: tc.tooltipMuted }} className="mb-2 font-semibold">{label}</p>
      {STAGES.map((s) => (
        <div key={s} className="flex items-center gap-1.5 mb-0.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ background: STAGE_COLORS[s] }} />
          <span style={{ color: tc.tooltipTitle }}>{STAGE_LABELS[s]}</span>
          <span style={{ color: tc.tooltipMuted }} className="ml-auto pl-4 tabular-nums">
            {(vals[s] ?? 0).toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Stacked area chart ────────────────────────────────────────────────────────
function LifecycleChart({
  history, window: win,
}: {
  history: LifecycleHistoryEntry[];
  window: Window;
}) {
  const tc = useThemeColors();
  const days = parseInt(win);

  const series = history.slice(-days).map((h) => {
    const t = h.stages.total;
    return {
      date:   h.date,
      new:    t > 0 ? (h.stages.new    / t) * 100 : 0,
      active: t > 0 ? (h.stages.active / t) * 100 : 0,
      cold:   t > 0 ? (h.stages.cold   / t) * 100 : 0,
      dead:   t > 0 ? (h.stages.dead   / t) * 100 : 0,
    };
  });

  const chartH = tc.mobile ? 200 : 240;

  if (series.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-gray-300 dark:text-gray-600">
        No history yet — data appears after the first sync.
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <AreaChart data={series} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          {(["dead", "cold", "active", "new"] as const).map((s) => (
            <linearGradient key={s} id={`lc-${s}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={STAGE_COLORS[s]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={STAGE_COLORS[s]} stopOpacity={0.05} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid vertical={false} stroke={tc.dark ? "#1f2937" : "#f3f4f6"} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10, fill: tc.tickColor }}
          tickLine={false}
          axisLine={false}
          tickFormatter={fmtAxisDate}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 10, fill: tc.tickColor }}
          tickLine={false}
          axisLine={false}
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          width={36}
        />
        <Tooltip content={({ active, payload, label }) => (
          <LifecycleTooltip active={active} payload={payload as any[]} label={String(label ?? "")} tc={tc} />
        )} />
        {/* Render order: dead (bottom) → cold → active → new (top) */}
        <Area type="monotone" dataKey="dead"   stackId="1" stroke={STAGE_COLORS.dead}   fill={`url(#lc-dead)`}   strokeWidth={1.5} />
        <Area type="monotone" dataKey="cold"   stackId="1" stroke={STAGE_COLORS.cold}   fill={`url(#lc-cold)`}   strokeWidth={1.5} />
        <Area type="monotone" dataKey="active" stackId="1" stroke={STAGE_COLORS.active} fill={`url(#lc-active)`} strokeWidth={1.5} />
        <Area type="monotone" dataKey="new"    stackId="1" stroke={STAGE_COLORS.new}    fill={`url(#lc-new)`}    strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface LifecyclePanelProps {
  stats: LifecycleStats | null | undefined;
  isLoading: boolean;
}

const skeletonCls = "card animate-pulse";

export function LifecyclePanel({ stats, isLoading }: LifecyclePanelProps) {
  const [win, setWin] = useState<Window>("30");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className={`h-28 ${skeletonCls}`} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className={`h-24 ${skeletonCls}`} />)}
        </div>
        <div className={`h-64 ${skeletonCls}`} />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No lifecycle data yet — run a sync to compute stages.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <HealthScoreDisplay score={stats.healthScore} />
      </div>

      <StageCardGrid current={stats.current} />

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-400 dark:text-gray-500">Stage distribution over time</p>
          <div className="flex gap-1">
            {(["30", "60", "90"] as Window[]).map((w) => (
              <button
                key={w}
                onClick={() => setWin(w)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  win === w
                    ? "bg-hebe-red text-white"
                    : "text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {w}d
              </button>
            ))}
          </div>
        </div>

        <LifecycleChart history={stats.history} window={win} />

        <div className="flex flex-wrap gap-4 mt-4">
          {STAGES.map((s) => (
            <span key={s} className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-gray-500">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[s] }} />
              {STAGE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
