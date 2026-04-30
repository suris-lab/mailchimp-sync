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

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444",
  "#06b6d4", "#f97316", "#a3e635", "#ec4899", "#6366f1",
];

// Group slices below threshold% into "Others"
function groupSmallSlices(
  obj: Record<string, number>,
  thresholdPct = 3
): { name: string; value: number }[] {
  const sorted = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((s, [, v]) => s + v, 0);
  const main: { name: string; value: number }[] = [];
  let others = 0;

  for (const [name, value] of sorted) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    if (pct >= thresholdPct) {
      main.push({ name, value });
    } else {
      others += value;
    }
  }
  if (others > 0) main.push({ name: "Others", value: others });
  return main;
}

// Custom tooltip shared by pie and bar charts
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
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-white">{name}</p>
      <p className="text-gray-300">{value.toLocaleString()} contacts</p>
      <p className="text-gray-400">{pct}%</p>
    </div>
  );
}

// Donut / pie chart for Membership
function MembershipPieChart({ data }: { data: Record<string, number> }) {
  const slices = groupSmallSlices(data);
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (slices.length === 0) {
    return <p className="text-xs text-gray-600 py-8 text-center">No data</p>;
  }

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
            <Cell
              key={i}
              fill={PIE_COLORS[i % PIE_COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => (
            <ChartTooltip
              active={active}
              payload={payload}
              totalForPct={total}
            />
          )}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// Interactive horizontal bar chart for modifier + tag sections
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
  const visible = (showAll ? sorted : sorted.slice(0, 5)).map(([name, value]) => ({
    name,
    value,
  }));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-xs font-medium text-gray-400 mb-3">{title}</p>
        <p className="text-xs text-gray-600">No data</p>
      </div>
    );
  }

  const chartHeight = visible.length * 36 + 8;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400">{title}</p>
        <span className="text-[10px] text-gray-600">{sorted.length} values</span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
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
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
            content={({ active, payload }) => (
              <ChartTooltip
                active={active}
                payload={payload}
                totalForPct={total}
              />
            )}
          />
          <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
      {sorted.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
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

export function AudienceStatsPanel({ stats, isLoading }: AudienceStatsPanelProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-24 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-xl border border-gray-800 bg-gray-900 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="text-sm text-gray-500">No stats yet — run a sync to compute audience insights.</p>
      </div>
    );
  }

  const total = stats.total_sheet_contacts;

  return (
    <div className="space-y-6">
      {/* Overview KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 shrink-0">
            <Users size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Contacts on Mailchimp</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {stats.total_mailchimp_members.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">Subscribed members</p>
          </div>
        </div>
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
            <Sheet size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Contacts in Sheet</p>
            <p className="text-2xl font-semibold text-white mt-1">
              {stats.total_sheet_contacts.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Computed {new Date(stats.computed_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Membership — full-width pie chart */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-xs font-medium text-gray-400 mb-1">Membership</p>
        <p className="text-[10px] text-gray-600 mb-3">
          Hover a slice for details · slices &lt; 3% grouped into Others
        </p>
        <MembershipPieChart data={stats.membership} />
      </div>

      {/* Membership Modifier */}
      <InteractiveBarSection
        title="Membership Modifier"
        data={stats.membership_modifier}
        color="#8b5cf6"
        total={total}
      />

      {/* Tag breakdown — 2×2 grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <InteractiveBarSection title="Interest"       data={stats.tags.interest}       color="#10b981" total={total} />
        <InteractiveBarSection title="Facility"       data={stats.tags.facility}       color="#f59e0b" total={total} />
        <InteractiveBarSection title="Skill"          data={stats.tags.skill}          color="#06b6d4" total={total} />
        <InteractiveBarSection title="Administrative" data={stats.tags.administrative} color="#f43f5e" total={total} />
      </div>
    </div>
  );
}
