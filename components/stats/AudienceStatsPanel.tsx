"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Sheet } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
} from "recharts";
import type { AudienceStats } from "@/lib/types";

// HHYC brand palette for charts
const PIE_COLORS = [
  "#eb0029", // hebe-red
  "#05308C", // hebe-navy
  "#D6CB93", // hebe-champagne
  "#0a0a3a", // hebe-deep
  "#ffce00", // hebe-gold
  "#3d5aa0", // mid-navy
  "#c40022", // dark red
  "#6b8fd4", // light navy
  "#a8996e", // muted champagne
  "#eb6b00", // warm orange
];

function groupSmallSlices(
  obj: Record<string, number>,
  thresholdPct = 3
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

function ChartTooltip({
  active,
  payload,
  totalForPct,
}: {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: readonly any[];
  totalForPct: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0].payload as { name: string; value: number };
  const pct = totalForPct > 0 ? ((value / totalForPct) * 100).toFixed(1) : "–";
  return (
    <div className="rounded-lg border border-hebe-champagne/30 bg-white dark:bg-hebe-deep-2 dark:border-hebe-deep-3 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-hebe-ink dark:text-hebe-cream">{name}</p>
      <p className="text-hebe-ink/70 dark:text-hebe-champagne/70">{value.toLocaleString()} contacts</p>
      <p className="text-hebe-red font-medium">{pct}%</p>
    </div>
  );
}

function MembershipPieChart({ data }: { data: Record<string, number> }) {
  const slices = groupSmallSlices(data);
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (slices.length === 0) return <p className="text-xs text-hebe-ink/30 dark:text-hebe-champagne/30 py-8 text-center">No data</p>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={slices}
          cx="50%"
          cy="46%"
          innerRadius={68}
          outerRadius={110}
          paddingAngle={2}
          dataKey="value"
          isAnimationActive
        >
          {slices.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => (
            <ChartTooltip active={active} payload={payload} totalForPct={total} />
          )}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 11, color: "currentColor" }} className="text-hebe-ink dark:text-hebe-champagne">
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function InteractiveBarSection({
  title,
  data,
  color,
  total,
}: {
  title: string;
  data: Record<string, number>;
  color: string;
  total: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const visible = (showAll ? sorted : sorted.slice(0, 5)).map(([name, value]) => ({ name, value }));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-4">
        <p className="text-xs font-semibold text-hebe-ink/50 dark:text-hebe-champagne/50 mb-3">{title}</p>
        <p className="text-xs text-hebe-ink/30 dark:text-hebe-champagne/30">No data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-hebe-ink/60 dark:text-hebe-champagne/60">{title}</p>
        <span className="text-[10px] text-hebe-ink/30 dark:text-hebe-champagne/30">{sorted.length} values</span>
      </div>
      <ResponsiveContainer width="100%" height={visible.length * 36 + 8}>
        <BarChart
          data={visible}
          layout="vertical"
          margin={{ top: 0, right: 44, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={130}
            tick={{ fontSize: 11, fill: "currentColor" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(5,48,140,0.06)" }}
            content={({ active, payload }) => (
              <ChartTooltip active={active} payload={payload} totalForPct={total} />
            )}
          />
          <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} barSize={14} />
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

interface AudienceStatsPanelProps {
  stats: AudienceStats | null | undefined;
  isLoading: boolean;
}

const skeletonCls = "rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 animate-pulse";

export function AudienceStatsPanel({ stats, isLoading }: AudienceStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => <div key={i} className={`h-24 ${skeletonCls}`} />)}
        </div>
        <div className={`h-72 ${skeletonCls}`} />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className={`h-48 ${skeletonCls}`} />)}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-8 text-center">
        <p className="text-sm text-hebe-ink/40 dark:text-hebe-champagne/40">
          No stats yet — run a sync to compute audience insights.
        </p>
      </div>
    );
  }

  const total = stats.total_sheet_contacts;
  const cardCls = "rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-4 flex items-start gap-3";

  return (
    <div className="space-y-6">
      {/* Overview KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className={cardCls}>
          <div className="rounded-lg bg-hebe-red/10 p-2 shrink-0">
            <Users size={14} className="text-hebe-red" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/50 dark:text-hebe-champagne/50">
              Contacts on Mailchimp
            </p>
            <p className="text-2xl font-bold font-serif text-hebe-ink dark:text-hebe-cream mt-1">
              {stats.total_mailchimp_members.toLocaleString()}
            </p>
            <p className="text-[10px] text-hebe-ink/40 dark:text-hebe-champagne/40 mt-0.5">Subscribed members</p>
          </div>
        </div>
        <div className={cardCls}>
          <div className="rounded-lg bg-hebe-navy/10 p-2 shrink-0">
            <Sheet size={14} className="text-hebe-navy dark:text-hebe-champagne" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/50 dark:text-hebe-champagne/50">
              Contacts in Sheet
            </p>
            <p className="text-2xl font-bold font-serif text-hebe-ink dark:text-hebe-cream mt-1">
              {stats.total_sheet_contacts.toLocaleString()}
            </p>
            <p className="text-[10px] text-hebe-ink/40 dark:text-hebe-champagne/40 mt-0.5">
              Computed {new Date(stats.computed_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Membership — full-width donut chart */}
      <div className="rounded-xl border border-hebe-champagne/20 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 p-4">
        <p className="text-xs font-semibold text-hebe-ink/60 dark:text-hebe-champagne/60 mb-0.5">Membership</p>
        <p className="text-[10px] text-hebe-ink/30 dark:text-hebe-champagne/30 mb-3">
          Hover a slice for details · slices &lt; 3% grouped into Others
        </p>
        <MembershipPieChart data={stats.membership} />
      </div>

      {/* Membership Modifier */}
      <InteractiveBarSection
        title="Membership Modifier"
        data={stats.membership_modifier}
        color="#05308C"
        total={total}
      />

      {/* Tag breakdown 2×2 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InteractiveBarSection title="Interest"       data={stats.tags.interest}       color="#eb0029" total={total} />
        <InteractiveBarSection title="Facility"       data={stats.tags.facility}       color="#05308C" total={total} />
        <InteractiveBarSection title="Skill"          data={stats.tags.skill}          color="#D6CB93" total={total} />
        <InteractiveBarSection title="Administrative" data={stats.tags.administrative} color="#0a0a3a" total={total} />
      </div>
    </div>
  );
}
