"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Users, Sheet } from "lucide-react";
import type { AudienceStats } from "@/lib/types";

// Sort entries descending by count
function sorted(obj: Record<string, number>): [string, number][] {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]);
}

// Single horizontal bar row
function BarRow({
  label, count, maxCount, total, color,
}: {
  label: string;
  count: number;
  maxCount: number;
  total?: number;
  color: string;
}) {
  const barPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const pct = total && total > 0 ? Math.round((count / total) * 100) : null;
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-40 text-xs text-gray-300 truncate shrink-0" title={label}>
        {label}
      </span>
      <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${color}`} style={{ width: `${barPct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-gray-200 shrink-0">
        {count.toLocaleString()}
      </span>
      {pct !== null && (
        <span className="w-9 text-right text-xs text-gray-500 shrink-0">{pct}%</span>
      )}
    </div>
  );
}

// A collapsible chart section for one tag category
function TagSection({
  title, data, color,
}: {
  title: string;
  data: Record<string, number>;
  color: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const rows = sorted(data);
  const max = rows[0]?.[1] ?? 1;
  const visible = showAll ? rows : rows.slice(0, 5);

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <p className="text-xs font-medium text-gray-400 mb-3">{title}</p>
        <p className="text-xs text-gray-600">No data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-gray-400">{title}</p>
        <span className="text-[10px] text-gray-600">{rows.length} values</span>
      </div>
      <div className="space-y-0.5">
        {visible.map(([label, count]) => (
          <BarRow key={label} label={label} count={count} maxCount={max} color={color} />
        ))}
      </div>
      {rows.length > 5 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
        >
          {showAll ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          {showAll ? "Show less" : `Show ${rows.length - 5} more`}
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
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
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

  const membershipRows = sorted(stats.membership);
  const membershipMax = membershipRows[0]?.[1] ?? 1;

  const modifierRows = sorted(stats.membership_modifier);
  const modifierMax = modifierRows[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      {/* Overview */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-blue-500/10 p-2 shrink-0">
            <Users size={14} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Contacts on Mailchimp</p>
            <p className="text-2xl font-semibold text-white mt-1">{stats.total_mailchimp_members.toLocaleString()}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">Subscribed members</p>
          </div>
        </div>
        <div className="col-span-2 sm:col-span-1 rounded-xl border border-gray-800 bg-gray-900 p-4 flex items-start gap-3">
          <div className="rounded-lg bg-emerald-500/10 p-2 shrink-0">
            <Sheet size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">Contacts in Sheet</p>
            <p className="text-2xl font-semibold text-white mt-1">{stats.total_sheet_contacts.toLocaleString()}</p>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Computed {new Date(stats.computed_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Membership + Modifier */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Membership breakdown */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-medium text-gray-400 mb-3">Membership</p>
          {membershipRows.length === 0 ? (
            <p className="text-xs text-gray-600">No data</p>
          ) : (
            <div className="space-y-0.5">
              {membershipRows.map(([label, count]) => (
                <BarRow
                  key={label}
                  label={label}
                  count={count}
                  maxCount={membershipMax}
                  total={stats.total_sheet_contacts}
                  color="bg-blue-500"
                />
              ))}
            </div>
          )}
        </div>

        {/* Membership Modifier */}
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs font-medium text-gray-400 mb-3">Membership Modifier</p>
          {modifierRows.length === 0 ? (
            <p className="text-xs text-gray-600">No data</p>
          ) : (
            <div className="space-y-0.5">
              {modifierRows.map(([label, count]) => (
                <BarRow
                  key={label}
                  label={label}
                  count={count}
                  maxCount={modifierMax}
                  total={stats.total_sheet_contacts}
                  color="bg-purple-500"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tag breakdown — 2×2 grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TagSection title="Interest" data={stats.tags.interest} color="bg-emerald-500" />
        <TagSection title="Facility" data={stats.tags.facility} color="bg-amber-500" />
        <TagSection title="Skill" data={stats.tags.skill} color="bg-teal-500" />
        <TagSection title="Administrative" data={stats.tags.administrative} color="bg-rose-500" />
      </div>
    </div>
  );
}
