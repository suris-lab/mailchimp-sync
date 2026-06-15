"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, RefreshCw, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell,
  PieChart, Pie, Legend,
} from "recharts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useSurveyInsights } from "@/hooks/useSurveyInsights";
import type { SurveyInsights, SurveyAreaStat } from "@/lib/types";

// ── Constants ────────────────────────────────────────────────────────────────

const HEBE_RED  = "#EB0029";
const DARK_GREY = "#53565A";

// ── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const ms  = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1)  return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)  return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function fmt1(n: number): string { return n.toFixed(1); }
function fmtPct(n: number): string { return `${Math.round(n)}%`; }

function npsColor(score: number): string {
  if (score < 0)  return HEBE_RED;
  if (score < 30) return "#ca8a04";   // amber-600
  return "#16a34a";                   // green-600
}

function satColor(avg: number): string {
  if (avg >= 4)   return "#16a34a";
  if (avg >= 3)   return "#ca8a04";
  return HEBE_RED;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function LowSampleBadge() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full border border-amber-300 dark:border-amber-700
                     px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
      <AlertTriangle size={9} /> Low sample
    </span>
  );
}

function KpiCard({ label, value, sub, accent = false }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`text-3xl font-black tabular-nums leading-none mt-2 ${accent ? "text-hebe-red" : "text-gray-900 dark:text-white"}`}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-sm font-bold text-gray-900 dark:text-white tracking-tight">{label}</h2>
      {sub && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 ${className}`}>
      {children}
    </div>
  );
}

// ── Section 1: Executive Summary / Data Quality ───────────────────────────────

function ExecutiveSummary({ data, onRefresh, refreshing }: { data: SurveyInsights; onRefresh: () => void; refreshing: boolean }) {
  const [dqOpen, setDqOpen] = useState(false);
  const dq = data.data_quality;

  return (
    <section>
      {/* Dark header bar */}
      <div className="rounded-t-2xl bg-gray-900 dark:bg-black border border-gray-800 px-5 py-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] font-black tracking-[0.28em] uppercase text-white">Executive Summary</p>
          <p className="text-[9px] text-gray-500 tracking-widest uppercase mt-0.5">
            {data.total_responses} responses · Updated {timeAgo(data.computed_at)}
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5
                     text-[10px] text-gray-400 hover:text-white hover:border-gray-500 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="border-x border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900
                      grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100 dark:divide-gray-800">
        {[
          { label: "Responses",      value: String(data.total_responses) },
          { label: "Avg Satisfaction", value: `${fmt1(data.avg_satisfaction)}/5` },
          { label: "NPS Score",      value: String(data.nps_score), color: npsColor(data.nps_score) },
          { label: "% Satisfied",    value: fmtPct(data.pct_satisfied) },
          { label: "Top Priority",   value: data.top_priorities[0]?.label ?? "—", small: true },
          { label: "Top Theme",      value: data.comment_themes[0]?.theme ?? "—", small: true },
        ].map(({ label, value, color, small }) => (
          <div key={label} className="px-4 py-4 text-center">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-1">{label}</p>
            <p
              className={`font-black tabular-nums leading-none ${small ? "text-sm" : "text-2xl"} ${color ? "" : "text-gray-900 dark:text-white"}`}
              style={color ? { color } : {}}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Data quality panel (always visible, collapsible detail) */}
      <div className="rounded-b-2xl border border-t-0 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <button
          onClick={() => setDqOpen((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            {(dq.unmatched_r1 > 0 || dq.missing_fields.length > 0) && (
              <AlertTriangle size={11} className="text-amber-500" />
            )}
            <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Data Quality
            </span>
            <span className="text-[10px] text-gray-400">
              {dq.matched_complete} complete · {dq.r1_rows} in Response · {dq.r2_rows} in Response2
            </span>
          </div>
          {dqOpen ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
        </button>
        {dqOpen && (
          <div className="px-5 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs border-t border-gray-100 dark:border-gray-800 pt-3">
            {[
              { label: "Response sheet rows",   value: String(dq.r1_rows) },
              { label: "Response2 sheet rows",  value: String(dq.r2_rows) },
              { label: "Matched complete",       value: String(dq.matched_complete) },
              { label: "Unmatched (R1 only)",    value: String(dq.unmatched_r1), warn: dq.unmatched_r1 > 0 },
              { label: "Unmatched (R2 only)",    value: String(dq.unmatched_r2), warn: dq.unmatched_r2 > 0 },
              { label: "Join method",            value: dq.join_method },
            ].map(({ label, value, warn }) => (
              <div key={label}>
                <p className="text-[9px] uppercase tracking-widest text-gray-400">{label}</p>
                <p className={`font-semibold mt-0.5 ${warn ? "text-amber-600 dark:text-amber-400" : "text-gray-700 dark:text-gray-300"}`}>{value}</p>
              </div>
            ))}
            {dq.missing_fields.length > 0 && (
              <div className="col-span-full">
                <p className="text-[9px] uppercase tracking-widest text-gray-400">Missing fields</p>
                <p className="text-amber-600 dark:text-amber-400 font-semibold mt-0.5">{dq.missing_fields.join(" · ")}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Section 2: Overall Satisfaction ──────────────────────────────────────────

function SatisfactionSection({ data }: { data: SurveyInsights }) {
  const distData = [5, 4, 3, 2, 1].map((n) => ({
    label: `${n}★`, count: data.satisfaction_dist[String(n)] ?? 0,
  }));
  const areaData = [...data.area_stats]
    .filter((a) => a.satisfaction > 0)
    .sort((a, b) => b.satisfaction - a.satisfaction);

  return (
    <section>
      <SectionTitle label="Satisfaction Overview" sub="Overall score · Distribution · By club area" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Big score */}
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">Overall Satisfaction</p>
          <p className="text-6xl font-black tabular-nums mt-3" style={{ color: satColor(data.avg_satisfaction) }}>
            {fmt1(data.avg_satisfaction)}
          </p>
          <p className="text-sm text-gray-400 mt-1">out of 5</p>
          <div className="flex gap-4 mt-4 text-center">
            <div>
              <p className="text-xl font-black text-emerald-600">{fmtPct(data.pct_satisfied)}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Satisfied</p>
            </div>
            <div>
              <p className="text-xl font-black text-hebe-red">{fmtPct(data.pct_dissatisfied)}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Dissatisfied</p>
            </div>
          </div>
        </Card>

        {/* Distribution */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Score Distribution</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={distData} layout="vertical" margin={{ left: 4, right: 8, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: DARK_GREY }} width={28} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v) => [v, "Responses"]} />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {distData.map((d) => (
                  <Cell key={d.label} fill={d.label.startsWith("4") || d.label.startsWith("5") ? "#16a34a" : d.label.startsWith("3") ? "#ca8a04" : HEBE_RED} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* By area */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">By Club Area</p>
          {areaData.length === 0 ? (
            <p className="text-xs text-gray-400">No area data yet</p>
          ) : (
            <div className="space-y-2">
              {areaData.slice(0, 8).map((a) => (
                <div key={a.label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-gray-600 dark:text-gray-400 truncate max-w-[65%]">{a.label}</span>
                    <span className="text-[10px] font-semibold tabular-nums" style={{ color: satColor(a.satisfaction) }}>
                      {fmt1(a.satisfaction)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${(a.satisfaction / 5) * 100}%`, backgroundColor: satColor(a.satisfaction) }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}

// ── Section 3: NPS ────────────────────────────────────────────────────────────

function NpsSection({ data }: { data: SurveyInsights }) {
  const { nps_score, nps_dist, avg_nps_raw, by_membership_category } = data;
  const total = nps_dist.promoters + nps_dist.passives + nps_dist.detractors || 1;

  return (
    <section>
      <SectionTitle label="NPS & Recommendation" sub="Net Promoter Score · Promoters / Passives / Detractors" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* NPS score */}
        <Card className="flex flex-col items-center justify-center text-center">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">NPS Score</p>
          <p className="text-6xl font-black tabular-nums mt-3" style={{ color: npsColor(nps_score) }}>
            {nps_score > 0 ? `+${nps_score}` : nps_score}
          </p>
          <p className="text-[10px] text-gray-400 mt-1">Avg recommendation: {fmt1(avg_nps_raw)}/10</p>
          <div className="mt-4 flex gap-3 text-center text-xs">
            {[
              { label: "Promoters",  n: nps_dist.promoters,  color: "#16a34a" },
              { label: "Passives",   n: nps_dist.passives,   color: "#ca8a04" },
              { label: "Detractors", n: nps_dist.detractors, color: HEBE_RED  },
            ].map(({ label, n, color }) => (
              <div key={label}>
                <p className="text-lg font-black" style={{ color }}>{fmtPct((n / total) * 100)}</p>
                <p className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Stacked bar */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Response Split</p>
          <div className="flex h-8 rounded-lg overflow-hidden">
            {[
              { n: nps_dist.promoters,  color: "#16a34a" },
              { n: nps_dist.passives,   color: "#ca8a04" },
              { n: nps_dist.detractors, color: HEBE_RED  },
            ].map(({ n, color }, i) => (
              <div
                key={i}
                style={{ flex: n || 0, backgroundColor: color, minWidth: n > 0 ? 2 : 0 }}
                title={`${n} responses`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[9px] text-gray-400">
            <span>Detractors (0–6)</span>
            <span>Passives (7–8)</span>
            <span>Promoters (9–10)</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-4 uppercase tracking-widest font-semibold">NPS by Membership Category</p>
          <div className="mt-2 space-y-1">
            {Object.entries(by_membership_category).map(([seg, stat]) => (
              <div key={seg} className="flex items-center justify-between text-xs">
                <span className="text-gray-600 dark:text-gray-400 truncate max-w-[60%]">{seg}</span>
                <div className="flex items-center gap-2">
                  {stat.low_sample && <LowSampleBadge />}
                  <span className="font-semibold tabular-nums" style={{ color: npsColor(stat.nps_score) }}>
                    {stat.nps_score > 0 ? `+${stat.nps_score}` : stat.nps_score}
                  </span>
                  <span className="text-gray-400 text-[10px]">(n={stat.count})</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* NPS bar chart */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Satisfaction by NPS Group</p>
          <div className="space-y-2 mt-2">
            {Object.entries(data.by_nps_group).map(([grp, stat]) => (
              <div key={grp}>
                <div className="flex justify-between mb-0.5">
                  <span className="text-[10px] text-gray-600 dark:text-gray-400">{grp} (n={stat.count})</span>
                  <span className="text-[10px] font-semibold tabular-nums" style={{ color: satColor(stat.avg_satisfaction) }}>
                    {fmt1(stat.avg_satisfaction)}/5
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ width: `${(stat.avg_satisfaction / 5) * 100}%`, backgroundColor: satColor(stat.avg_satisfaction) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ── Section 4: Membership & Benefits ─────────────────────────────────────────

const PRIVILEGE_ORDER = ["Not valuable", "Slightly valuable", "Moderately valuable", "Valuable", "Very valuable"];

function MembershipBenefitsSection({ data }: { data: SurveyInsights }) {
  const { referral_aware, avg_referral_attractive, referral_attractive_dist, avg_privilege_value, privilege_value_dist, privilege_not_aware_n } = data;
  const totalReferral = referral_aware.yes + referral_aware.no || 1;
  const maxPriv = Math.max(...Object.values(privilege_value_dist), 1);
  const attrEntries = Object.entries(referral_attractive_dist).sort((a, b) => b[1] - a[1]);
  const maxAttr = Math.max(...attrEntries.map(([, n]) => n), 1);

  return (
    <section>
      <SectionTitle
        label="Membership & Benefits"
        sub="Referral programme awareness (Q23) · Attractiveness (Q23a) · Member privilege value (Q25)"
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Referral awareness */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Referral Programme Awareness
          </p>
          <div className="flex items-end gap-4 mb-4">
            <div>
              <p className="text-5xl font-black tabular-nums" style={{ color: referral_aware.pct_aware >= 50 ? "#16a34a" : HEBE_RED }}>
                {referral_aware.pct_aware}%
              </p>
              <p className="text-[10px] text-gray-400 mt-1">aware of the programme</p>
            </div>
            <div className="text-xs text-gray-400 pb-1">
              <p>{referral_aware.yes} yes · {referral_aware.no} no</p>
              {(referral_aware.yes + referral_aware.no) === 0 && (
                <p className="text-amber-500 mt-1">No responses yet</p>
              )}
            </div>
          </div>
          {/* Yes / No split bar */}
          <div className="flex h-5 rounded-lg overflow-hidden">
            <div style={{ flex: referral_aware.yes, backgroundColor: "#16a34a", minWidth: referral_aware.yes > 0 ? 2 : 0 }}
              title={`${referral_aware.yes} Yes`} />
            <div style={{ flex: referral_aware.no, backgroundColor: HEBE_RED, minWidth: referral_aware.no > 0 ? 2 : 0 }}
              title={`${referral_aware.no} No`} />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />Yes</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: HEBE_RED }} />No</span>
          </div>
          {/* Q23a attractiveness rating — only shown to members who said Yes */}
          <div className="mt-3 border-t border-gray-100 dark:border-gray-800 pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
              Attractiveness Rating (Q23a · Yes respondents only)
            </p>
            {attrEntries.length === 0 ? (
              <p className="text-[10px] text-amber-500">No responses yet</p>
            ) : (
              <div className="space-y-1.5">
                {attrEntries.map(([label, count]) => (
                  <div key={label}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[10px] text-gray-600 dark:text-gray-400">{label}</span>
                      <span className="text-[10px] tabular-nums text-gray-400">{count}</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${(count / maxAttr) * 100}%` }} />
                    </div>
                  </div>
                ))}
                {avg_referral_attractive > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">Avg: {avg_referral_attractive.toFixed(1)} / 5</p>
                )}
              </div>
            )}
            <p className="text-[10px] text-gray-400 mt-2">
              Q24 (open): improvement comments included in Comment Themes.
            </p>
          </div>
        </Card>

        {/* Privilege value */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Member Privilege Value
          </p>
          <div className="flex items-end gap-3 mb-4">
            <div>
              <p className="text-5xl font-black tabular-nums" style={{ color: satColor(avg_privilege_value) }}>
                {avg_privilege_value > 0 ? fmt1(avg_privilege_value) : "—"}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">out of 5</p>
            </div>
            {privilege_not_aware_n > 0 && (
              <p className="text-[10px] text-gray-400 pb-1">{privilege_not_aware_n} not aware of privileges (excluded)</p>
            )}
          </div>
          <div className="space-y-2">
            {PRIVILEGE_ORDER.map((label, idx) => {
              const count = privilege_value_dist[label] ?? 0;
              const score = idx + 1;
              return (
                <div key={label}>
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[10px] text-gray-600 dark:text-gray-400">{label}</span>
                    <span className="text-[10px] tabular-nums text-gray-400">{count}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: `${(count / maxPriv) * 100}%`,
                        backgroundColor: score >= 4 ? "#16a34a" : score === 3 ? "#ca8a04" : HEBE_RED,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </section>
  );
}

// ── Section 5 (was 4): Importance vs Satisfaction Matrix ──────────────────────

function MatrixSection({ data }: { data: SurveyInsights }) {
  const [hovered, setHovered] = useState<number | null>(null);
  // Only plot areas with actual satisfaction data — count=0 means avg()=0 which lands
  // falsely at the far-left edge of the chart as if satisfaction were 0/5.
  const areas = data.area_stats.filter((a) => a.count > 0);
  const midSat = 3.0;
  const midImp = 0.5;

  const quadrantColor = (a: SurveyAreaStat): string => {
    const hiSat = a.satisfaction >= midSat;
    const hiImp = a.importance >= midImp;
    if (hiImp && !hiSat) return HEBE_RED;
    if (hiImp && hiSat)  return "#16a34a";
    if (!hiImp && hiSat) return "#6b7280";
    return "#9ca3af";
  };

  // SVG coordinate system — viewBox makes this fully responsive, no overflow
  const W = 560, H = 320;
  const PAD = { top: 24, right: 20, bottom: 40, left: 48 };
  const cW = W - PAD.left - PAD.right;
  const cH = H - PAD.top - PAD.bottom;
  const toX = (sat: number) => PAD.left + (sat / 5) * cW;
  const toY = (imp: number) => PAD.top + (1 - imp) * cH;
  const refX = toX(midSat);
  const refY = toY(midImp);

  return (
    <section>
      <SectionTitle
        label="Importance vs Satisfaction Matrix"
        sub="Importance = priority selection frequency (Q15+Q16) · Satisfaction = sub-category avg"
      />
      <Card>
        {/* Quadrant legend */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 text-[10px]">
          {[
            { color: HEBE_RED,   label: "Immediate Priority",  desc: "High importance · Low satisfaction"  },
            { color: "#16a34a",  label: "Protect & Maintain",  desc: "High importance · High satisfaction" },
            { color: "#6b7280",  label: "Nice to Have",        desc: "Low importance · High satisfaction"  },
            { color: "#9ca3af",  label: "Lower Priority",      desc: "Low importance · Low satisfaction"   },
          ].map(({ color, label, desc }) => (
            <div key={label} className="flex items-start gap-1.5">
              <span className="mt-0.5 w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
              <div>
                <p className="font-semibold text-gray-700 dark:text-gray-300">{label}</p>
                <p className="text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {areas.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">Not enough data yet to plot the matrix</p>
        ) : (
          <>
            {/* Pure SVG chart — numbered dots, labels in grid below — no in-chart text overlap */}
            <div className="overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-auto"
              aria-label="Importance vs Satisfaction scatter matrix"
            >
              {/* Quadrant background fills — colour identifies quadrant without needing text labels */}
              <rect x={PAD.left} y={PAD.top}  width={refX - PAD.left}      height={refY - PAD.top}      fill={HEBE_RED}  fillOpacity={0.04} />
              <rect x={refX}     y={PAD.top}  width={PAD.left + cW - refX} height={refY - PAD.top}      fill="#16a34a"   fillOpacity={0.04} />
              <rect x={PAD.left} y={refY}     width={refX - PAD.left}      height={PAD.top + cH - refY} fill="#9ca3af"   fillOpacity={0.06} />
              <rect x={refX}     y={refY}     width={PAD.left + cW - refX} height={PAD.top + cH - refY} fill="#6b7280"   fillOpacity={0.04} />

              {/* Light grid */}
              {[1, 2, 3, 4].map((v) => (
                <line key={`gx${v}`} x1={toX(v)} y1={PAD.top} x2={toX(v)} y2={PAD.top + cH} stroke="#e5e7eb" strokeWidth={0.5} />
              ))}
              {[0.25, 0.75].map((v) => (
                <line key={`gy${v}`} x1={PAD.left} y1={toY(v)} x2={PAD.left + cW} y2={toY(v)} stroke="#e5e7eb" strokeWidth={0.5} />
              ))}

              {/* Quadrant dividers */}
              <line x1={refX} y1={PAD.top} x2={refX} y2={PAD.top + cH} stroke="#9ca3af" strokeWidth={1} strokeDasharray="5 4" />
              <line x1={PAD.left} y1={refY} x2={PAD.left + cW} y2={refY} stroke="#9ca3af" strokeWidth={1} strokeDasharray="5 4" />

              {/* Y axis ticks + title */}
              {[0, 0.25, 0.5, 0.75, 1].map((v) => (
                <text key={`yt${v}`} x={PAD.left - 6} y={toY(v) + 4} textAnchor="end" fontSize={8} fill={DARK_GREY}>
                  {`${Math.round(v * 100)}%`}
                </text>
              ))}
              <text
                x={12} y={PAD.top + cH / 2}
                textAnchor="middle" fontSize={9} fill={DARK_GREY}
                transform={`rotate(-90, 12, ${PAD.top + cH / 2})`}
              >
                Importance
              </text>

              {/* X axis ticks + title */}
              {[0, 1, 2, 3, 4, 5].map((v) => (
                <text key={`xt${v}`} x={toX(v)} y={PAD.top + cH + 14} textAnchor="middle" fontSize={8} fill={DARK_GREY}>
                  {v}
                </text>
              ))}
              <text x={PAD.left + cW / 2} y={H - 2} textAnchor="middle" fontSize={9} fill={DARK_GREY}>
                Satisfaction (avg / 5)
              </text>

              {/* Numbered dots — full labels are in the grid below, nothing to overlap here */}
              {areas.map((a, i) => {
                const cx = toX(a.satisfaction);
                const cy = toY(a.importance);
                const color = quadrantColor(a);
                const isHovered = hovered === i;
                return (
                  <g key={a.label} onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                    style={{ cursor: "default" }}>
                    <title>{a.label} — Sat: {fmt1(a.satisfaction)}/5 · Imp: {fmtPct(a.importance * 100)}{a.count < 10 ? ` · ⚠ Low sample (n=${a.count})` : ""}</title>
                    <circle cx={cx} cy={cy} r={isHovered ? 12 : 10} fill={color} fillOpacity={isHovered ? 1 : 0.88} stroke="white" strokeWidth={isHovered ? 2 : 1} />
                    <text x={cx} y={cy + 4} textAnchor="middle" fontSize={isHovered ? 8 : 7}
                      fontWeight="bold" fill="white" style={{ pointerEvents: "none" }}>
                      {i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
            </div>

            {/* Numbered legend grid — full area names, no overlap possible */}
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800
                            grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2">
              {areas.map((a, i) => {
                const color = quadrantColor(a);
                return (
                  <div
                    key={a.label}
                    className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors cursor-default ${
                      hovered === i ? "bg-gray-100 dark:bg-gray-800" : ""
                    }`}
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center
                                     text-[8px] font-bold text-white"
                      style={{ backgroundColor: color }}>
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-700 dark:text-gray-300 leading-tight">{a.label}</p>
                      <p className="text-[9px] text-gray-400 tabular-nums">
                        {fmt1(a.satisfaction)}/5 · {fmtPct(a.importance * 100)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <p className="text-[10px] text-gray-400 mt-3">
          Note: Importance is derived from priority selection frequency (Q15+Q16), not a direct importance rating.
        </p>
      </Card>
    </section>
  );
}

// ── Section 5: Segment Analysis ───────────────────────────────────────────────

type SegmentFilter = "membership_category" | "tenure" | "visit_freq" | "usage_type" | "nps_group";

function SegmentSection({ data }: { data: SurveyInsights }) {
  const [filter, setFilter] = useState<SegmentFilter>("membership_category");

  const segmentData: Record<SegmentFilter, Record<string, import("@/lib/types").SurveySegmentStat>> = {
    membership_category: data.by_membership_category,
    tenure:              data.by_tenure,
    visit_freq:          data.by_visit_freq,
    usage_type:          data.by_usage_type,
    nps_group:           data.by_nps_group,
  };

  const FILTER_LABELS: Record<SegmentFilter, string> = {
    membership_category: "Membership Category",
    tenure:              "Length of Membership",
    visit_freq:          "Visit Frequency",
    usage_type:          "Main Usage Type",
    nps_group:           "NPS Group",
  };

  const current = segmentData[filter];
  const chartData = Object.entries(current).map(([seg, s]) => ({
    seg: seg.length > 20 ? seg.slice(0, 18) + "…" : seg,
    fullSeg: seg,
    satisfaction: s.avg_satisfaction,
    nps: s.nps_score,
    count: s.count,
    low: s.low_sample,
  }));

  return (
    <section>
      <SectionTitle label="Segment Analysis" />
      {/* Filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {(Object.keys(FILTER_LABELS) as SegmentFilter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
              filter === f
                ? "bg-hebe-red border-hebe-red text-white"
                : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-400"
            }`}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Satisfaction bar */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Avg Satisfaction by {FILTER_LABELS[filter]}</p>
          {chartData.length === 0 ? <p className="text-xs text-gray-400">No data</p> : (
            <ResponsiveContainer width="100%" height={Math.max(160, chartData.length * 32)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                <XAxis type="number" domain={[0, 5]} hide />
                <YAxis type="category" dataKey="seg" tick={{ fontSize: 10, fill: DARK_GREY }} width={100} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`${fmt1(Number(v))}/5`, "Satisfaction"]} />
                <ReferenceLine x={3.5} stroke="#d1d5db" strokeDasharray="3 3" />
                <Bar dataKey="satisfaction" radius={[0, 4, 4, 0]}>
                  {chartData.map((d) => (
                    <Cell key={d.seg} fill={satColor(d.satisfaction)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Summary table */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">Segment Summary</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  {["Segment", "n", "Sat.", "NPS", "Top Priority"].map((h, i) => (
                    <th key={h} className={`py-1.5 text-[9px] font-semibold uppercase tracking-widest text-gray-400 ${i === 0 ? "text-left" : "text-right"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {Object.entries(current).map(([seg, stat]) => (
                  <tr key={seg} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                    <td className="py-1.5 text-gray-700 dark:text-gray-300 max-w-[120px] truncate">
                      {seg}
                      {stat.low_sample && <LowSampleBadge />}
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-gray-500">{stat.count}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: satColor(stat.avg_satisfaction) }}>
                      {fmt1(stat.avg_satisfaction)}
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: npsColor(stat.nps_score) }}>
                      {stat.nps_score > 0 ? `+${stat.nps_score}` : stat.nps_score}
                    </td>
                    <td className="py-1.5 text-right text-gray-400 max-w-[100px] truncate text-[10px]">
                      {stat.top_priorities[0] ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </section>
  );
}

// ── Section 6: Priority Areas ─────────────────────────────────────────────────

function PrioritySection({ data }: { data: SurveyInsights }) {
  const priorities = data.top_priorities.slice(0, 12);
  const max = priorities[0]?.count || 1;

  return (
    <section>
      <SectionTitle label="Priority Improvement Areas" sub="Combined frequency from Q15 (most important) and Q16 (priority improvement)" />
      <Card>
        <div className="space-y-2.5">
          {priorities.length === 0 ? (
            <p className="text-sm text-gray-400">No priority data yet</p>
          ) : priorities.map((p, i) => (
            <div key={p.label} className="flex items-center gap-3">
              <span className={`text-[10px] font-bold tabular-nums w-4 shrink-0 ${i < 3 ? "text-hebe-red" : "text-gray-400"}`}>{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{p.label}</span>
                  <span className="text-[10px] tabular-nums text-gray-400 ml-2 shrink-0">{p.count} · {fmtPct(p.pct)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${(p.count / max) * 100}%`,
                      backgroundColor: i < 3 ? HEBE_RED : "#6b7280",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

// ── Section 7: Comment Themes ─────────────────────────────────────────────────

function CommentSection({ data }: { data: SurveyInsights }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <section>
      <SectionTitle
        label="Comment Themes"
        sub={`${data.comment_count} comment extracts · keyword-rule sentiment coding`}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Theme frequency + sentiment */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-4">Theme Frequency & Sentiment</p>
          {data.comment_themes.length === 0 ? (
            <p className="text-sm text-gray-400">No comments yet</p>
          ) : (
            <div className="space-y-2.5">
              {data.comment_themes.map((t) => {
                const total = t.count || 1;
                return (
                  <div key={t.theme}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] text-gray-700 dark:text-gray-300">{t.theme}</span>
                      <span className="text-[10px] tabular-nums text-gray-400">{t.count}</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden">
                      <div style={{ flex: t.sentiment.positive, backgroundColor: "#16a34a" }} title={`${t.sentiment.positive} positive`} />
                      <div style={{ flex: t.sentiment.neutral,  backgroundColor: "#d1d5db" }} title={`${t.sentiment.neutral} neutral`} />
                      <div style={{ flex: t.sentiment.negative, backgroundColor: HEBE_RED  }} title={`${t.sentiment.negative} negative`} />
                    </div>
                  </div>
                );
              })}
              <div className="flex gap-4 mt-2 text-[9px] text-gray-400">
                {[{ c: "#16a34a", l: "Positive" }, { c: "#d1d5db", l: "Neutral" }, { c: HEBE_RED, l: "Negative" }].map(({ c, l }) => (
                  <div key={l} className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />{l}</div>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Comment explorer */}
        <Card>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-3">
            Comment Explorer
            {data.comment_count > 200 && (
              <span className="ml-2 normal-case font-normal text-gray-400">Showing 200 of {data.comment_count}</span>
            )}
          </p>
          <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
            {data.comments.length === 0 ? (
              <p className="text-xs text-gray-400">No comments yet</p>
            ) : data.comments.map((c, i) => (
              <div key={i} className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-3 py-2">
                {c.segment && (
                  <span className="inline-block mb-1 rounded-full border border-gray-200 dark:border-gray-700 px-2 py-0.5 text-[9px] font-semibold text-gray-500 dark:text-gray-400">
                    {c.segment}
                  </span>
                )}
                {c.lang === "zh" && (
                  <span className="inline-block mb-1 ml-1 rounded-full border border-blue-200 dark:border-blue-700 px-2 py-0.5 text-[9px] font-semibold text-blue-500 dark:text-blue-400">
                    中文
                  </span>
                )}
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">{c.text}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Theme examples */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {data.comment_themes.slice(0, 6).map((t) => (
          <div key={t.theme} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{t.theme}</span>
              <button
                onClick={() => setExpanded(expanded === t.theme ? null : t.theme)}
                className="text-[10px] text-gray-400 hover:text-hebe-red transition-colors"
              >
                {expanded === t.theme ? "Collapse" : `${t.examples.length} example${t.examples.length !== 1 ? "s" : ""}`}
              </button>
            </div>
            <div className="flex gap-2 text-[10px]">
              <span className="text-emerald-600">{t.sentiment.positive} pos</span>
              <span className="text-gray-400">{t.sentiment.neutral} neu</span>
              <span style={{ color: HEBE_RED }}>{t.sentiment.negative} neg</span>
            </div>
            {expanded === t.theme && (
              <div className="mt-2 space-y-1.5">
                {t.examples.map((ex, i) => (
                  <p key={i} className="text-[11px] text-gray-500 dark:text-gray-400 italic border-l-2 border-gray-200 dark:border-gray-700 pl-2">
                    "{ex.slice(0, 150)}{ex.length > 150 ? "…" : ""}"
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section 8: Member Profile ─────────────────────────────────────────────────

const PIE_COLORS = ["#53565A", "#EB0029", "#6b7280", "#9ca3af", "#d1d5db", "#1f2937", "#374151"];

function ProfileSection({ data }: { data: SurveyInsights }) {
  const makePie = (dist: Record<string, number>) =>
    Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

  return (
    <section>
      <SectionTitle label="Member Profile" sub="Visit frequency · Tenure · Membership category" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Visit Frequency",          data: makePie(data.visit_freq_dist) },
          { label: "Length of Membership",      data: makePie(data.tenure_dist) },
          { label: "Membership Category",       data: makePie(data.membership_category_dist) },
        ].map(({ label, data: pieData }) => (
          <Card key={label}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-2">{label}</p>
            {pieData.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={30}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Legend
                    formatter={(value: unknown) => {
                      const s = String(value ?? "");
                      return <span style={{ fontSize: 9, color: DARK_GREY }}>{s.length > 22 ? s.slice(0, 20) + "…" : s}</span>;
                    }}
                    iconSize={8}
                  />
                  <Tooltip formatter={(v, name) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

// ── Section 9: Action Priority List ──────────────────────────────────────────

const TIMING_ORDER: Record<string, number> = { "0–3m": 0, "3–6m": 1, "6–12m": 2, "Long-term": 3 };

function ActionSection({ data }: { data: SurveyInsights }) {
  return (
    <section>
      <SectionTitle
        label="Action Priority List"
        sub={`Priority Score = importance (40%) + low satisfaction (35%) + negative comment frequency (25%)`}
      />
      <Card>
        {data.action_items.length === 0 ? (
          <p className="text-sm text-gray-400">Not enough data yet to generate action items</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  {["#", "Issue", "Evidence", "Recommended Action", "Owner", "Timing"].map((h, i) => (
                    <th key={h} className={`py-2 text-[9px] font-semibold uppercase tracking-widest text-gray-400 ${i === 0 ? "text-center w-8" : "text-left pr-4"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800/50">
                {[...data.action_items].sort((a, b) => (TIMING_ORDER[a.timing] ?? 4) - (TIMING_ORDER[b.timing] ?? 4) || b.priority_score - a.priority_score).map((item) => (
                  <tr key={item.issue} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 align-top">
                    <td className="py-2.5 text-center">
                      <span
                        className="inline-flex w-6 h-6 items-center justify-center rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: item.priority_rank <= 3 ? HEBE_RED : "#6b7280" }}
                      >
                        {item.priority_rank}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-gray-800 dark:text-gray-200 whitespace-nowrap">{item.issue}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 max-w-[180px]">{item.evidence}</td>
                    <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300 max-w-[200px]">{item.recommended_action}</td>
                    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">{item.owner}</td>
                    <td className="py-2.5">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold border ${
                        item.timing === "0–3m"
                          ? "border-hebe-red/40 bg-hebe-red/10 text-hebe-red"
                          : item.timing === "3–6m"
                          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400"
                          : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400"
                      }`}>
                        {item.timing}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

// ── Empty / Error states ──────────────────────────────────────────────────────

function EmptyState({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-12 text-center">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">No survey responses yet</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">The Google Sheet is connected. Data will appear here once responses come in.</p>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5
                   text-xs text-gray-500 hover:text-hebe-red hover:border-hebe-red transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        Check for responses
      </button>
    </div>
  );
}

function ErrorState({ message, onRefresh, refreshing }: { message: string; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-12 text-center">
      <AlertTriangle size={20} className="text-amber-500 mx-auto mb-3" />
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Could not load survey data</p>
      <p className="text-xs text-gray-400 mt-1 mb-4">{message}</p>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 dark:border-amber-700 px-3 py-1.5
                   text-xs text-gray-600 dark:text-gray-400 hover:text-hebe-red hover:border-hebe-red transition-colors disabled:opacity-50"
      >
        <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        Retry
      </button>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SurveyPage() {
  const { data, error, isLoading, refresh } = useSurveyInsights();
  const [refreshing, setRefreshing] = useState(false);
  // Avoid hydration mismatch: don't render charts until client is mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  // data has a valid shape only when total_responses is a number
  const dataReady = !!data && typeof data.total_responses === "number";

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">

      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-2 text-gray-400 dark:text-gray-500
                         hover:text-hebe-red dark:hover:text-hebe-red hover:border-hebe-red/30 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <Image src="/logo.png" alt="HHYC" width={30} height={30} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Member Survey Insights 2026</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                2026 Member Experience &amp; Priorities Survey · Live data
                {data && <span className="ml-2">· Updated {timeAgo(data.computed_at)}</span>}
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-8">

        {!mounted || isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <ErrorState
            message={error instanceof Error ? error.message : "Unable to reach the survey data API"}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
        ) : !dataReady || data!.total_responses === 0 ? (
          <EmptyState onRefresh={handleRefresh} refreshing={refreshing} />
        ) : (
          <>
            <ExecutiveSummary data={data!} onRefresh={handleRefresh} refreshing={refreshing} />
            <SatisfactionSection data={data!} />
            <NpsSection data={data!} />
            <MembershipBenefitsSection data={data!} />
            <MatrixSection data={data!} />
            <SegmentSection data={data!} />
            <PrioritySection data={data!} />
            <CommentSection data={data!} />
            <ProfileSection data={data!} />
            <ActionSection data={data!} />
          </>
        )}
      </main>

      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-5 px-4 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-600 tracking-widest uppercase">
          Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
