"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ChevronDown, ChevronUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { useMembershipStats } from "@/hooks/useMembershipStats";
import type { MembershipContact } from "@/lib/types";

// ── Action card with expandable contact table ──────────────────────────────────

interface ActionCardProps {
  label: string;
  windowLabel: string;
  count: number | undefined;
  contacts: MembershipContact[] | undefined;
  isLoading: boolean;
  showEventType?: boolean;
  pastTense?: boolean; // overdue: days shown as "X days ago"
}

function ActionCard({
  label,
  windowLabel,
  count,
  contacts,
  isLoading,
  showEventType = false,
  pastTense = false,
}: ActionCardProps) {
  const [open, setOpen] = useState(false);
  const hasItems = (count ?? 0) > 0;
  const accent = hasItems ? "border-l-hebe-red" : "border-l-gray-200 dark:border-l-gray-800";

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse">
        <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
        <div className="h-8 w-12 rounded bg-gray-100 dark:bg-gray-800 mb-2" />
        <div className="h-3 w-20 rounded bg-gray-100 dark:bg-gray-800" />
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-l-[3px] border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 ${accent}`}>
      <div className="p-5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          {label}
        </p>
        <p className={`mt-2 text-2xl font-bold tabular-nums ${hasItems ? "text-hebe-red" : "text-gray-900 dark:text-white"}`}>
          {count ?? 0}
        </p>
        <div className="mt-1 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-gray-500">{windowLabel}</p>
          {hasItems && (
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-hebe-red dark:hover:text-hebe-red transition-colors"
            >
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {open ? "Hide" : "View"}
            </button>
          )}
        </div>
      </div>

      {open && contacts && contacts.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-800 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Member ID
                </th>
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Full Name
                </th>
                {showEventType && (
                  <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    Event
                  </th>
                )}
                <th className="px-4 py-2 text-left text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Date
                </th>
                <th className="px-4 py-2 text-right text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  {pastTense ? "Days Ago" : "Days Until"}
                </th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr
                  key={`${c.email}-${c.eventType}-${i}`}
                  className="border-b border-gray-50 dark:border-gray-800/60 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-gray-500 dark:text-gray-400">
                    {c.memberId || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300 font-medium">
                    {c.fullName || c.email}
                  </td>
                  {showEventType && (
                    <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400">
                      {c.eventType}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 font-mono">
                    {c.date}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {c.daysUntil === 0 ? (
                      <span className="text-hebe-red font-semibold">Today</span>
                    ) : c.daysUntil > 0 ? (
                      <span className="text-gray-600 dark:text-gray-400">{c.daysUntil}d</span>
                    ) : (
                      <span className="text-hebe-red">{Math.abs(c.daysUntil)}d ago</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MembershipPage() {
  const { data: stats, isLoading } = useMembershipStats();

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">

      {/* ── Header ── */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-2
                         text-gray-400 dark:text-gray-500
                         hover:text-hebe-red dark:hover:text-hebe-red hover:border-hebe-red/30 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <Image src="/logo.png" alt="HHYC" width={30} height={30} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Membership</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">Lifecycle tracking & upcoming actions</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Overview ── */}
        <section>
          <SectionHeader
            title="Overview"
            subtitle="Date coverage across all contact records"
          />
          {isLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 animate-pulse">
                  <div className="h-3 w-24 rounded bg-gray-100 dark:bg-gray-800 mb-3" />
                  <div className="h-8 w-16 rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <KpiCard
                label="Records With Dates"
                value={stats?.totalWithAnyDate?.toLocaleString() ?? "—"}
                sub="at least one date field filled"
              />
              <KpiCard
                label="Complete Core Data"
                value={stats?.totalWithCoreDates?.toLocaleString() ?? "—"}
                sub="bday + all 4 milestones filled"
              />
            </div>
          )}
        </section>

        {/* ── Upcoming Actions ── */}
        <section>
          <SectionHeader
            title="Upcoming Actions"
            subtitle="Member lifecycle events requiring follow-up"
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ActionCard
              label="Birthdays"
              windowLabel="next 30 days"
              count={stats?.upcomingBirthdays30.count}
              contacts={stats?.upcomingBirthdays30.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Age-Tier Conversions"
              windowLabel="next 90 days"
              count={stats?.upcomingAgeTier90.count}
              contacts={stats?.upcomingAgeTier90.contacts}
              isLoading={isLoading}
              showEventType
            />
            <ActionCard
              label="SA → Full Member Eligible"
              windowLabel="next 180 days"
              count={stats?.upcomingSAEligible180.count}
              contacts={stats?.upcomingSAEligible180.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Term Memberships Expiring"
              windowLabel="next 120 days"
              count={stats?.upcomingTermExpiry120.count}
              contacts={stats?.upcomingTermExpiry120.contacts}
              isLoading={isLoading}
            />
            <ActionCard
              label="Overdue Follow-ups"
              windowLabel="passed in last 180 days"
              count={stats?.overdueFollowUps.count}
              contacts={stats?.overdueFollowUps.contacts}
              isLoading={isLoading}
              showEventType
              pastTense
            />
          </div>
        </section>

        {stats && (
          <p className="text-[10px] text-gray-300 dark:text-gray-700 text-right">
            Computed {new Date(stats.computed_at).toLocaleString()} · cached 1 hr
          </p>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-5 px-4 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-600 tracking-widest uppercase">
          Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
