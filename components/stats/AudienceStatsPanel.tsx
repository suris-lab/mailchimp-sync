"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Sheet } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, LabelList,
} from "recharts";
import type { AudienceStats } from "@/lib/types";
import { useThemeColors } from "@/hooks/useThemeColors";

// ── Colours ───────────────────────────────────────────────────────────────────
const PIE_COLORS = [
  "#eb0029", // HHYC red — primary slice
  "#6b7280", // gray-500
  "#374151", // gray-700
  "#9ca3af", // gray-400
  "#4b5563", // gray-600
  "#d1d5db", // gray-300
  "#c40022", // dark red
  "#05308C", // HHYC navy
  "#7B5E3A", // HHYC brown
  "#1f2937", // gray-800
];

const BAR_COLORS = {
  interest:       "#eb0029", // red — differentiates from other bars
  modifier:       "#6b7280",
  facility:       "#374151",
  skill:          "#7B5E3A",
  administrative: "#05308C",
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

// ── Shared pie tooltip ────────────────────────────────────────────────────────
function PieTooltip({
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

// Shared bar tooltip
function BarTooltip({
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

// ── Shared pie label renderer — name line + % line ────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makePieLabel(tc: ReturnType<typeof useThemeColors>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function PieLabel({ cx, cy, midAngle, outerRadius, percent, name }: any) {
    if (percent < 0.05) return null; // skip tiny slices to avoid crowding
    const r = outerRadius + (tc.mobile ? 22 : 30);
    const x = cx + r * Math.cos(-midAngle * RADIAN);
    const y = cy + r * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? "start" : "end";
    // Truncate long names so labels don't overflow
    const short = name.length > 15 ? name.slice(0, 14) + "…" : name;
    return (
      <g>
        <text
          x={x} y={y - 6}
          fill={tc.labelColor}
          textAnchor={anchor}
          fontSize={tc.mobile ? 8 : 9}
          fontWeight="500"
        >
          {short}
        </text>
        <text
          x={x} y={y + 7}
          fill={tc.labelColor}
          textAnchor={anchor}
          fontSize={tc.mobile ? 9 : 11}
          fontWeight="700"
        >
          {`${(percent * 100).toFixed(0)}%`}
        </text>
      </g>
    );
  };
}

// ── Generic pie/donut chart ───────────────────────────────────────────────────
function TagPieChart({ data }: { data: Record<string, number> }) {
  const tc = useThemeColors();
  const slices = groupSmallSlices(data);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const renderLabel = makePieLabel(tc);

  if (slices.length === 0) {
    return <p className="py-10 text-center text-xs text-gray-300 dark:text-gray-600">No data</p>;
  }

  const chartH = tc.mobile ? 260 : 320;
  const innerR = tc.mobile ? 42 : 55;
  const outerR = tc.mobile ? 72 : 92;

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
            <PieTooltip active={active} payload={payload} totalForPct={total} tc={tc} />
          )}
        />
        <Legend
          iconType="circle"
          iconSize={6}
          wrapperStyle={{ paddingTop: 8, fontSize: 10 }}
          formatter={(value: string) => (
            <span style={{ color: tc.labelColor, fontSize: 10 }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Membership donut — with non-member toggle (default: hidden) ───────────────
function MembershipPieChart({ data }: { data: Record<string, number> }) {
  const tc = useThemeColors();
  // Non-members excluded by default
  const [excludeNonMembers, setExcludeNonMembers] = useState(true);

  const filteredData = excludeNonMembers
    ? Object.fromEntries(Object.entries(data).filter(([k]) => !k.toLowerCase().includes("non")))
    : data;

  const slices = groupSmallSlices(filteredData);
  const total = slices.reduce((s, d) => s + d.value, 0);
  const renderLabel = makePieLabel(tc);

  const toggleBtn = (
    <button
      onClick={() => setExcludeNonMembers((v) => !v)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
        excludeNonMembers
          ? "bg-hebe-red text-white"
          : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 hover:text-hebe-red dark:hover:text-hebe-red"
      }`}
    >
      {excludeNonMembers ? "Non-members hidden" : "Include non-members"}
    </button>
  );

  if (slices.length === 0) {
    return (
      <div>
        <div className="mb-3">{toggleBtn}</div>
        <p className="py-10 text-center text-xs text-gray-300 dark:text-gray-600">No data</p>
      </div>
    );
  }

  const chartH = tc.mobile ? 260 : 320;
  const innerR = tc.mobile ? 42 : 55;
  const outerR = tc.mobile ? 72 : 92;

  return (
    <div>
      <div className="mb-3">{toggleBtn}</div>
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
              <PieTooltip active={active} payload={payload} totalForPct={total} tc={tc} />
            )}
          />
          <Legend
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ paddingTop: 8, fontSize: 10 }}
            formatter={(value: string) => (
              <span style={{ color: tc.labelColor, fontSize: 10 }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Bar chart with inline count labels ────────────────────────────────────────
function InteractiveBarSection({
  title, data, color, total, bare = false,
}: {
  title: string;
  data: Record<string, number>;
  color: string;
  total: number;
  bare?: boolean; // when true: no card wrapper (caller owns the card)
}) {
  const tc = useThemeColors();
  const [showAll, setShowAll] = useState(false);

  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const visible = (showAll ? sorted : sorted.slice(0, 5)).map(([name, value]) => ({ name, value }));

  if (sorted.length === 0) {
    return (
      <div className={bare ? "" : "card p-4"}>
        <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 mb-3">{title}</p>
        <p className="text-xs text-gray-300 dark:text-gray-600">No data</p>
      </div>
    );
  }

  const barH = tc.mobile ? 28 : 34;
  const axisW = tc.mobile ? 88 : 128;
  const chartH = visible.length * barH + 8;

  return (
    <div className={bare ? "" : "card p-4"}>
      {!bare && (
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">{title}</p>
          <span className="text-[10px] text-gray-300 dark:text-gray-600">{sorted.length} values</span>
        </div>
      )}
      {bare && (
        <div className="flex justify-end mb-2">
          <span className="text-[10px] text-gray-300 dark:text-gray-600">{sorted.length} values</span>
        </div>
      )}
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
              <BarTooltip active={active} payload={payload} totalForPct={total} tc={tc} />
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
          className="mt-2 flex items-center gap-1 text-[11px] text-gray-400 dark:text-gray-500 hover:text-hebe-red transition-colors"
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
        <div className={`h-72 ${skeletonCls}`} />
        <div className={`h-40 ${skeletonCls}`} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[...Array(3)].map((_, i) => <div key={i} className={`h-44 ${skeletonCls}`} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="card p-8 text-center">
        <p className="text-sm text-gray-400 dark:text-gray-500">
          No stats yet — run a sync to compute audience insights.
        </p>
      </div>
    );
  }

  const total = stats.total_sheet_contacts;

  return (
    <div className="space-y-5">

      {/* ── Overview KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div className="card p-4 flex items-start gap-3">
          <div className="rounded-lg bg-hebe-red/10 p-2 shrink-0">
            <Users size={14} className="text-hebe-red" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              On Mailchimp
            </p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.total_mailchimp_members.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
              Subscribed members
            </p>
          </div>
        </div>
        <div className="card p-4 flex items-start gap-3">
          <div className="rounded-lg bg-gray-100 dark:bg-gray-800 p-2 shrink-0">
            <Sheet size={14} className="text-gray-500 dark:text-gray-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              In Sheet
            </p>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stats.total_sheet_contacts.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 hidden sm:block">
              Computed {new Date(stats.computed_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* ── Membership — donut, non-members hidden by default ── */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Membership</p>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 mb-1">
          Name and % on each slice · hover for contact count
        </p>
        <MembershipPieChart data={stats.membership} />
      </div>

      {/* ── Interest — full-width bar chart (red, differentiated) ── */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="inline-block w-2 h-2 rounded-full bg-hebe-red" />
          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">Interest</p>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3">
          Count at bar end · hover for % of total · "Blank" = contacts with no interest recorded
        </p>
        <InteractiveBarSection
          title=""
          bare
          data={stats.tags.interest}
          color={BAR_COLORS.interest}
          total={total}
        />
      </div>

      {/* ── Membership Modifier ── */}
      <InteractiveBarSection
        title="Membership Modifier"
        data={stats.membership_modifier}
        color={BAR_COLORS.modifier}
        total={total}
      />

      {/* ── Facility, Skill, Administrative — 3-column grid ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InteractiveBarSection title="Facility"       data={stats.tags.facility}       color={BAR_COLORS.facility}       total={total} />
        <InteractiveBarSection title="Skill"          data={stats.tags.skill}          color={BAR_COLORS.skill}          total={total} />
        <InteractiveBarSection title="Administrative" data={stats.tags.administrative} color={BAR_COLORS.administrative} total={total} />
      </div>
    </div>
  );
}
