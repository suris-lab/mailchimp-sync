"use client";

import { useState } from "react";
import { Clock, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { useSchedule } from "@/hooks/useSchedule";
import type { ScheduleInterval } from "@/lib/types";

const OPTIONS: { label: string; value: ScheduleInterval; note?: string }[] = [
  { label: "Real-time sync",  value: -1 },
  { label: "Manual only",     value: 0 },
  { label: "Every 30 min",    value: 30,   note: "Vercel Pro" },
  { label: "Every 1 hour",    value: 60 },
  { label: "Every 6 hours",   value: 360 },
  { label: "Every 12 hours",  value: 720 },
  { label: "Every 24 hours",  value: 1440 },
];

function nextSyncLabel(intervalMinutes: number, lastSyncAt: string | null | undefined): string {
  if (intervalMinutes === -1) return "Syncs automatically whenever the sheet is edited";
  if (intervalMinutes === 0)  return "Manual only — use Sync Now or the sheet menu";
  if (!lastSyncAt) return "Will run on next cron tick";
  const nextMs = new Date(lastSyncAt).getTime() + intervalMinutes * 60_000;
  const diff = nextMs - Date.now();
  if (diff <= 0) return "Due — runs on next cron tick";
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `~${mins} min`;
  return `~${Math.round(mins / 60)}h`;
}

const WEBHOOK_URL_PLACEHOLDER = process.env.NEXT_PUBLIC_APP_URL
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhook`
  : "https://your-app.vercel.app/api/webhook";

function AppsScriptGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
      <div className="flex items-start gap-3">
        <Zap size={14} className="text-blue-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-blue-300">Google Apps Script required</p>
          <p className="text-xs text-gray-400 mt-0.5">
            A small script installed on your Google Sheet detects edits and calls this platform instantly (~5 sec delay).
          </p>
          <button
            onClick={() => setOpen((o) => !o)}
            className="mt-2 flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {open ? "Hide setup steps" : "Show setup steps"}
          </button>

          {open && (
            <ol className="mt-3 space-y-2 text-xs text-gray-300 list-decimal list-inside">
              <li>Open your Google Sheet → <strong>Extensions → Apps Script</strong></li>
              <li>
                Paste the script from{" "}
                <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">scripts/apps-script.gs</code>{" "}
                in this project
              </li>
              <li>
                Set <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">WEBHOOK_URL</code> to:
                <div className="mt-1 rounded bg-gray-800 px-2 py-1.5 font-mono text-[11px] text-gray-200 break-all">
                  {WEBHOOK_URL_PLACEHOLDER}
                </div>
              </li>
              <li>
                Set <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">WEBHOOK_SECRET</code> to your{" "}
                <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">WEBHOOK_SECRET</code> env var value
              </li>
              <li>Save → click the clock icon → <strong>Add Trigger</strong></li>
              <li>
                Choose <code className="bg-gray-800 px-1 py-0.5 rounded text-gray-200">onSheetEdit</code>,
                event source: <strong>From spreadsheet</strong>, event type: <strong>On edit</strong> → Save
              </li>
              <li>Repeat with event type: <strong>On change</strong> (catches bulk pastes)</li>
              <li>Grant permissions when prompted — done!</li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

interface SchedulePanelProps {
  lastSyncAt?: string | null;
}

export function SchedulePanel({ lastSyncAt }: SchedulePanelProps) {
  const { data: schedule, mutate } = useSchedule();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [selected, setSelected] = useState<ScheduleInterval | null>(null);

  const current = selected ?? schedule?.interval_minutes ?? 0;

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval_minutes: current }),
      });
      await mutate();
      setSaved(true);
      setSelected(null);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  const isDirty = selected !== null && selected !== schedule?.interval_minutes;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock size={14} className="text-gray-400" />
        <h3 className="text-sm font-medium text-white">Auto-Sync Schedule</h3>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {OPTIONS.map((opt) => {
          const active = current === opt.value;
          const isRealtime = opt.value === -1;
          return (
            <button
              key={opt.value}
              onClick={() => setSelected(opt.value)}
              className={`relative rounded-lg border px-3 py-2 text-xs transition-colors ${
                active && isRealtime
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                  : active
                  ? "border-blue-500 bg-blue-500/10 text-blue-400"
                  : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
              }`}
            >
              {isRealtime && <Zap size={10} className="inline mr-1 mb-0.5" />}
              {opt.label}
              {opt.note && (
                <span className="ml-1 text-[10px] text-gray-500">({opt.note})</span>
              )}
            </button>
          );
        })}
      </div>

      {current === -1 && <AppsScriptGuide />}

      <div className="flex items-center justify-between mt-4">
        <p className="text-xs text-gray-500">
          <span className="text-gray-300">{nextSyncLabel(current, lastSyncAt)}</span>
        </p>

        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-emerald-400">Saved</span>}
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
