"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { DateRangePicker } from "@/components/layout/DateRangePicker";
import { useCampaigns } from "@/hooks/useCampaigns";
import { useThemeColors } from "@/hooks/useThemeColors";
import type { CampaignRecord, CampaignCategory } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────
const CATEGORIES: CampaignCategory[] = ["Weekly What's On", "Member Notice", "Standalone EDM"];

const CAT_COLOR: Record<CampaignCategory, string> = {
  "Weekly What's On": "#eb0029",
  "Member Notice":    "#05308C",
  "Standalone EDM":   "#6b7280",
};

const CAT_DOT: Record<CampaignCategory, string> = {
  "Weekly What's On": "bg-hebe-red",
  "Member Notice":    "bg-hebe-navy",
  "Standalone EDM":   "bg-gray-400",
};

type Metric = "count" | "sent" | "open_rate" | "ctr";

const METRICS: { key: Metric; label: string; sub: string }[] = [
  { key: "count",     label: "Campaigns",     sub: "in range"          },
  { key: "sent",      label: "Total Sent",    sub: "emails delivered"  },
  { key: "open_rate", label: "Avg Open Rate", sub: "unique opens"      },
  { key: "ctr",       label: "Avg CTR",       sub: "click-through rate" },
];

type SortKey = keyof Pick<CampaignRecord,
  "sent_time" | "emails_sent" | "opens" | "open_rate" | "clicks" | "click_rate" | "unsubscribes"
>;

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}

function fmtAxisDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtPct(v: number) { return `${(v * 100).toFixed(1)}%`; }
function fmtNum(v: number) { return v.toLocaleString(); }

function metricValue(c: CampaignRecord, m: Metric): number {
  if (m === "count")     return 1;
  if (m === "sent")      return c.emails_sent;
  if (m === "open_rate") return c.open_rate;
  if (m === "ctr")       return c.click_rate;
  return 0;
}

function fmtMetric(v: number, m: Metric) {
  return m === "open_rate" || m === "ctr" ? fmtPct(v) : fmtNum(v);
}

// ── Trend data builder ────────────────────────────────────────────────────────
type ChartRow = { date: string } & Partial<Record<CampaignCategory, number>>;

function buildChartData(campaigns: CampaignRecord[], metric: Metric): ChartRow[] {
  // Accumulate per date + category
  const dateMap: Record<string, Record<CampaignCategory, { sum: number; count: number }>> = {};

  for (const c of campaigns) {
    const date = c.sent_time.slice(0, 10);
    if (!dateMap[date]) {
      dateMap[date] = {
        "Weekly What's On": { sum: 0, count: 0 },
        "Member Notice":    { sum: 0, count: 0 },
        "Standalone EDM":   { sum: 0, count: 0 },
      };
    }
    dateMap[date][c.category].sum   += metricValue(c, metric);
    dateMap[date][c.category].count += 1;
  }

  return Object.entries(dateMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cats]) => {
      const row: ChartRow = { date };
      for (const cat of CATEGORIES) {
        if (cats[cat].count > 0) {
          // average for rates, sum for counts
          row[cat] = (metric === "open_rate" || metric === "ctr")
            ? cats[cat].sum / cats[cat].count
            : cats[cat].sum;
        }
      }
      return row;
    });
}

// ── Custom chart tooltip ───────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label, metric, tc }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{ background: tc.tooltipBg, border: `1px solid ${tc.tooltipBorder}` }}
      className="rounded-lg px-3 py-2.5 text-xs shadow-xl space-y-1.5 min-w-[160px]"
    >
      <p style={{ color: tc.tooltipMuted }} className="mb-2">{fmtAxisDate(label)}</p>
      {payload.map((p: { dataKey: string; value: number; stroke: string }) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <span style={{ background: p.stroke }} className="inline-block w-2 h-2 rounded-full shrink-0" />
            <span style={{ color: tc.tooltipMuted }}>{p.dataKey}</span>
          </div>
          <span style={{ color: tc.tooltipTitle }} className="font-bold tabular-nums">
            {fmtMetric(p.value, metric)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Metric KPI tile ───────────────────────────────────────────────────────────
function MetricTile({
  metric, label, sub, value, active, onClick,
}: {
  metric: Metric; label: string; sub: string;
  value: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 min-w-0 text-left rounded-xl border px-4 py-3.5 transition-all ${
        active
          ? "border-t-2 border-t-hebe-red border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm"
          : "border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700"
      }`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1.5 ${
        active ? "text-hebe-red" : "text-gray-400 dark:text-gray-500"
      }`}>
        {label}
      </p>
      <p className={`text-xl font-bold tabular-nums leading-none ${
        active ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"
      }`}>
        {value}
      </p>
      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">{sub}</p>
    </button>
  );
}

// ── Table sort header ─────────────────────────────────────────────────────────
function TH({
  label, sortKey: sk, current, dir, onSort, right,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void; right?: boolean;
}) {
  const active = current === sk;
  return (
    <th
      onClick={() => onSort(sk)}
      className={`px-3 py-3 text-[10px] font-semibold uppercase tracking-widest cursor-pointer select-none
                  hover:text-gray-900 dark:hover:text-white transition-colors
                  ${active ? "text-gray-700 dark:text-gray-200" : "text-gray-400 dark:text-gray-500"}
                  ${right ? "text-right" : "text-left"}`}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active && (dir === "asc" ? <ChevronUp size={10} /> : <ChevronDown size={10} />)}
      </span>
    </th>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
export function CampaignPanel() {
  const [start, setStart]   = useState(daysAgo(29));
  const [end, setEnd]       = useState(today());
  const [metric, setMetric] = useState<Metric>("open_rate");
  const [sortKey, setSortKey] = useState<SortKey>("sent_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const tc = useThemeColors();
  const { data, isLoading } = useCampaigns(start, end);

  const campaigns = data?.campaigns ?? [];
  const totals    = data?.totals;

  // Preset buttons
  const PRESETS = [
    { label: "7d",  days: 6  },
    { label: "30d", days: 29 },
    { label: "90d", days: 89 },
  ];

  function applyPreset(days: number) {
    setStart(daysAgo(days));
    setEnd(today());
  }

  // Chart data
  const chartData = useMemo(() => buildChartData(campaigns, metric), [campaigns, metric]);

  // Table sort
  function toggleSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir("desc"); }
  }

  const sorted = useMemo(() => {
    return [...campaigns].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === "string"
        ? (av as string).localeCompare(bv as string)
        : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [campaigns, sortKey, sortDir]);

  // KPI values
  function kpiValue(m: Metric): string {
    if (!totals) return "—";
    if (m === "count")     return fmtNum(totals.count);
    if (m === "sent")      return fmtNum(totals.total_sent);
    if (m === "open_rate") return fmtPct(totals.avg_open_rate);
    if (m === "ctr")       return fmtPct(totals.avg_ctr);
    return "—";
  }

  if (isLoading) {
    return (
      <div className="card p-5 space-y-4 animate-pulse">
        <div className="flex gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex-1 h-20 rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
        <div className="h-56 rounded-xl bg-gray-100 dark:bg-gray-800" />
        <div className="h-48 rounded-xl bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── Date controls ── */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p.days)}
              className={`rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                start === daysAgo(p.days) && end === today()
                  ? "bg-hebe-red border-hebe-red text-white"
                  : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <DateRangePicker start={start} end={end} onChange={(s, e) => { setStart(s); setEnd(e); }} />
      </div>

      {/* ── Metric tiles (GA-style selector) ── */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {METRICS.map((m) => (
          <MetricTile
            key={m.key}
            metric={m.key}
            label={m.label}
            sub={m.sub}
            value={kpiValue(m.key)}
            active={metric === m.key}
            onClick={() => setMetric(m.key)}
          />
        ))}
      </div>

      {/* ── Trend chart ── */}
      <div className="card p-4">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
          {METRICS.find((m) => m.key === metric)?.label} over time · by category
        </p>

        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-xs text-gray-300 dark:text-gray-600">
            No campaigns in this date range
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={tc.mobile ? 180 : 220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
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
                tickFormatter={fmtAxisDate}
              />
              <YAxis
                tick={{ fontSize: 10, fill: tc.tickColor }}
                tickLine={false}
                axisLine={false}
                allowDecimals={metric === "open_rate" || metric === "ctr"}
                tickFormatter={(v) => metric === "open_rate" || metric === "ctr" ? fmtPct(v) : fmtNum(v)}
              />
              <Tooltip
                cursor={{ stroke: tc.tooltipBorder, strokeWidth: 1, strokeDasharray: "3 3" }}
                content={(props) => <ChartTooltip {...props} metric={metric} tc={tc} />}
              />
              <Legend
                iconType="circle"
                iconSize={7}
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                formatter={(val: string) => (
                  <span style={{ color: tc.labelColor, fontSize: 11 }}>{val}</span>
                )}
              />
              {CATEGORIES.map((cat) => (
                <Line
                  key={cat}
                  dataKey={cat}
                  name={cat}
                  stroke={CAT_COLOR[cat]}
                  strokeWidth={2}
                  dot={{ r: 4, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  connectNulls={false}
                  type="monotone"
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Campaign table ── */}
      <div className="card overflow-hidden">
        {/* Mobile cards */}
        <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
          {sorted.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-400 dark:text-gray-500">No campaigns in range</p>
          ) : sorted.map((c) => (
            <div key={c.id} className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${CAT_DOT[c.category]}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-900 dark:text-white leading-snug break-words">{c.subject}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{fmtDate(c.sent_time)}</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center text-[11px]">
                <div><p className="font-semibold text-gray-900 dark:text-white">{fmtNum(c.emails_sent)}</p><p className="text-gray-400">Sent</p></div>
                <div><p className="font-semibold text-gray-900 dark:text-white">{fmtPct(c.open_rate)}</p><p className="text-gray-400">Open%</p></div>
                <div><p className="font-semibold text-gray-900 dark:text-white">{fmtPct(c.click_rate)}</p><p className="text-gray-400">CTR</p></div>
                <div><p className="font-semibold text-gray-900 dark:text-white">{fmtNum(c.unsubscribes)}</p><p className="text-gray-400">Unsubs</p></div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
                <th className="px-3 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Subject
                </th>
                <TH label="Sent"    sortKey="sent_time"    current={sortKey} dir={sortDir} onSort={toggleSort} />
                <TH label="Sent #"  sortKey="emails_sent"  current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <TH label="Opens"   sortKey="opens"        current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <TH label="Open %"  sortKey="open_rate"    current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <TH label="Clicks"  sortKey="clicks"       current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <TH label="CTR"     sortKey="click_rate"   current={sortKey} dir={sortDir} onSort={toggleSort} right />
                <TH label="Unsubs"  sortKey="unsubscribes" current={sortKey} dir={sortDir} onSort={toggleSort} right />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-950">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                    No campaigns in this date range
                  </td>
                </tr>
              ) : sorted.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors">
                  {/* Subject + category dot */}
                  <td className="px-3 py-3 max-w-xs">
                    <div className="flex items-start gap-2">
                      <span
                        className={`mt-1 w-2 h-2 rounded-full shrink-0 ${CAT_DOT[c.category]}`}
                        title={c.category}
                      />
                      <span className="text-xs text-gray-900 dark:text-white leading-snug line-clamp-2" title={c.subject}>
                        {c.subject}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                    {fmtDate(c.sent_time)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-600 dark:text-gray-300 tabular-nums">
                    {fmtNum(c.emails_sent)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-600 dark:text-gray-300 tabular-nums">
                    {fmtNum(c.opens)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmtPct(c.open_rate)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-600 dark:text-gray-300 tabular-nums">
                    {fmtNum(c.clicks)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs font-semibold text-gray-900 dark:text-white tabular-nums">
                    {fmtPct(c.click_rate)}
                  </td>
                  <td className="px-3 py-3 text-right text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                    {fmtNum(c.unsubscribes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        {campaigns.length > 0 && (
          <div className="flex flex-wrap gap-4 px-4 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/30">
            {CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${CAT_DOT[cat]}`} />
                <span className="text-[10px] text-gray-400 dark:text-gray-500">{cat}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
