"use client";

import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from "recharts";
import type { SyncLog } from "@/lib/types";

interface Props {
  logs: SyncLog[];
}

export function SyncErrorSparkline({ logs }: Props) {
  if (logs.length < 2) return null;

  const data = [...logs].reverse().map((l) => ({
    label: new Date(l.timestamp).toLocaleString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    errors: l.errors,
    duration: Math.round(l.duration_ms / 1000),
  }));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 mb-3">
      <p className="text-[9px] font-semibold uppercase tracking-widest text-gray-400 mb-2">
        Error &amp; Duration — last {logs.length} syncs
      </p>
      <ResponsiveContainer width="100%" height={60}>
        <AreaChart data={data} margin={{ top: 2, right: 4, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gradErr" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EB0029" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#EB0029" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" hide />
          <YAxis yAxisId="errors" hide />
          <YAxis yAxisId="duration" orientation="right" hide />
          <Tooltip
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 11 }}
            labelStyle={{ color: "#6b7280", fontSize: 10 }}
          />
          <Area
            yAxisId="errors" type="monotone" dataKey="errors" name="Errors"
            stroke="#EB0029" strokeWidth={1.5} fill="url(#gradErr)" dot={false}
          />
          <Area
            yAxisId="duration" type="monotone" dataKey="duration" name="Duration (s)"
            stroke="#9ca3af" strokeWidth={1} fill="none" dot={false}
            strokeDasharray="3 2"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
