"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Sheet } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList,
} from "recharts";
import type { AudienceStats } from "@/lib/types";
import { useThemeColors } from "@/hooks/useThemeColors";

// ── Colours ──────────────────────────────────────────────────────────────────
// All chosen for readability on both white (#fff) and deep-navy (#0f1448) backgrounds.
const PIE_COLORS = [
  "#eb0029", // HHYC red
  "#2563eb", // blue-600
  "#d97706", // amber-600 (brand-gold adjacent)
  "#10b981", // emerald-500
  "#8b5cf6", // violet-500
  "#c40022", // deep red
  "#0891b2", // cyan-600
  "#f97316", // orange-500
  "#6d28d9", // violet-700
  "#0d9488", // teal-600
];

const BAR_COLORS = {
  modifier:       "#2563eb",
  interest:       "#eb0029",
  facility:       "#2563eb",
  skill:          "#d97706",
  administrative: "#8b5cf6",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const RADIAN = Math.PI / 180;

function groupSmallSlices(
  obj: Record<string, number>,
  thresholdPct = 3,
): { name: string; value: number }[] {
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const main: { name: string; value: number }[] = [];
  let others = 0;
  for (const [name, value] of sorted) {
    if (total > 0 && (value / total) * 100 >= thresholdPct) {
      main.push({ name, value });
    } else {
      others += value;
    }
  }
  if (others > 0) main.push({ name: "Others", value: others });
  return main;
}

// ── Shared tooltip ────────────────────────────────────────────────────────────
function ChartTooltip({
  active, payload, totalForPct, tc,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  totalForPct: number;
  tc: ReturnType<typeof useThemeColors>;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload as { name: string; value: number };
  const pct = totalForPct > 0 ? ((value / totalForPct) * 100).toFixed(1) : "–";
  return (
    <div
      style={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}` }}
      className="rounded-lg px-3 py-2 text-xs shadow-xl max-w-[220px]"
    >
      <p style={{ color: tc.tooltipTitle }} className="font-semibold break-words">{name}</p>
      <p style={{ color: tc.tooltipMuted }} className="mt-0.5">{value.toLocaleString()} contacts</p>
      <p style={{ color: tc.tooltipAccent }} className="font-semibold mt-0.5">{pct}% of total</p>
    </div>
  );
}

// ── Membership — donut with visible % labels ──────────────────────────────────
function MembershipPieChart({ data }: { data: Record<string, number> }) {
  const tc = useThemeColors();
  const slices = groupSmallSlices(data);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (slices.length === 0) {
    return <p className="py-10 text-center text-xs text-hebe-ink/30 dark:text-hebe-champagne/30">No data</p>;
  }

  // Render % label outside each slice (skip tiny slices to avoid overlap)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const renderLabel = ({ cx, cy, midAngle, outerRadius, percent }: any) => {
    if (percent < 0.04) return null;
    const r = outerRadius + (tc.mobile ? 18 : 26);
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    return (
      <text
        x={x}
        y={y}
        fill={tc.labelColor}
        textAnchor={x > cx ? "start" : "end"}
        dominantBaseline="central"
        fontSize={tc.mobile ? 9 : 11}
        fontWeight="700"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  const chartH = tc.mobile ? 260 : 320;
  const innerR = tc.mobile ? 45 : 58;
  const outerR = tc.mobile ? 78 : 100;

  return (
    <ResponsiveContainer width="100%" height={chartH}>
      <PieChart>
        <Pie
          data={slices}
          cx="50%"
          cy="44%"
          innerRadius={innerR}
          outerRadius={outerR}
          paddingAngle={2}
          dataKey="value"
          label={renderLabel}
          labelLine={{ stroke: tc.tickColor, strokeWidth: 1 }}
          isAnimationActive
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => (
            <ChartTooltip active={active} payload={payload} totalForPct={total} tc={tc} />
          )}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ paddingTop: 8, fontSize: 11 }}
          formatter={(value: string) => (
            <span style={{ color: tc.labelColor, fontSize: 11 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Bar chart with inline count labels ────────────────────────────────────────
function InteractiveBarSection({
  title, data, color, total,
}: {
  title: string;
  data: Record<string, number>;
  color: string;
  total: number;
}) {
  const tc = useThemeColors();
  const [showAll, setShowAll] = useState(false);

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const visible = (showAll ? sorted : sorted.slice(0, 5)).map(([name, value]) => ({ name, value }));

  if (sorted.length === 0) {
    return (
      <div className="card p-4">
        <p className="text-xs font-semibold text-hebe-ink/50 dark:text-hebe-champagne/50 mb-3">{title}</p>
        <p className="text-xs text-hebe-ink/30 dark:text-hebe-champagne/30">No data</p>
      </div>
    );
  }

  const barH = tc.mobile ? 28 : 34;
  const axisW = tc.mobile ? 88 : 128;
  const chartH = visible.length * barH + 8;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-hebe-ink/60 dark:text-hebe-champagne/60">{title}</p>
        <span className="text-[10px] text-hebe-ink/30 dark:text-hebe-champagne/30">{sorted.length} values</span>
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ top: 0, right: 52, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={axisW}
            tick={{ fontSize: tc.mobile ? 10 : 11, fill: tc.tickColor }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: tc.cursorFill }}
            content={({ active, payload }) => (
              <ChartTooltip active={active} payload={payload} totalForPct={total} tc={tc} />
            )}
          />
          <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} barSize={tc.mobile ? 10 : 13}>
            <LabelList
              dataKey="value"
              position="right"
              style={{ fontSize: tc.mobile ? 9 : 10, fill: tc.labelColor, fontWeight: "600" }}
              formatter={(v: unknown) => (v as number).toLocaleString()}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] text-hebe-ink/40 dark:text-hebe-champagne/40 hover:text-hebe-red transition-colors"
        >
          {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {showAll ? "Show less" : `Show ${sorted.length - 5} more`}
        </button>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface AudienceStatsPanelProps {
  stats: AudienceStats | null | undefined;
  isLoading: boolean;
}

const skeletonCls = "card animate-pulse";

export function AudienceStatsPanel({ stats, isLoading }: AudienceStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className={`h-24 ${skeletonCls}`} />)}
        </div>
        <div className={`h-72 ${skeletonCls}`} />
        <div className={`h-40 ${skeletonCls}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => <div key={i} className={`h-44 ${skeletonCls}`} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-hebe-ink/40 dark:text-hebe-champagne/40">
          No stats yet — run a sync to compute audience insights.
        </p>
      </div>
    );
  }

  const total = stats.total_sheet_contacts;

  return (
    <div className="space-y-5">
      {/* Overview KPI cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card p-4 flex items-start gap-3">
          <div className="rounded-lg bg-hebe-red/10 p-2 shrink-0">
            <Users size={14} className="text-hebe-red" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/50 dark:text-hebe-champagne/50">
              On Mailchimp
            </p>
            <p className="text-xl sm:text-2xl font-bold font-serif text-hebe-ink dark:text-hebe-cream mt-1">
              {stats.total_mailchimp_members.toLocaleString()}
            </p>
            <p className="text-[10px] text-hebe-ink/40 dark:text-hebe-champagne/40 mt-0.5 hidden sm:block">
              Subscribed members
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <div className="rounded-lg bg-hebe-navy/10 p-2 shrink-0">
            <Sheet size={14} className="text-hebe-navy dark:text-hebe-champagne" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/50 dark:text-hebe-champagne/50">
              In Sheet
            </p>
            <p className="text-xl sm:text-2xl font-bold font-serif text-hebe-ink dark:text-hebe-cream mt-1">
              {stats.total_sheet_contacts.toLocaleString()}
            </p>
            <p className="text-[10px] text-hebe-ink/40 dark:text-hebe-champagne/40 mt-0.5 hidden sm:block">
              Computed {new Date(stats.computed_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Membership — donut with % labels visible without hover */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-hebe-ink/60 dark:text-hebe-champagne/60">Membership</p>
        <p className="text-[10px] text-hebe-ink/35 dark:text-hebe-champagne/35 mt-0.5 mb-1">
          % shown on each slice · hover for contact count
        </p>
        <MembershipPieChart data={stats.membership} />
      </div>

      {/* Membership Modifier */}
      <InteractiveBarSection
        title="Membership Modifier — count shown at bar end · hover for %"
        data={stats.membership_modifier}
        color={BAR_COLORS.modifier}
        total={total}
      />

      {/* Tag breakdown 2×2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InteractiveBarSection title="Interest"       data={stats.tags.interest}       color={BAR_COLORS.interest}       total={total} />
        <InteractiveBarSection title="Facility"       data={stats.tags.facility}       color={BAR_COLORS.facility}       total={total} />
        <InteractiveBarSection title="Skill"          data={stats.tags.skill}          color={BAR_COLORS.skill}          total={total} />
        <InteractiveBarSection title="Administrative" data={stats.tags.administrative} color={BAR_COLORS.administrative} total={total} />
      </div>
    </div>
  );
}
