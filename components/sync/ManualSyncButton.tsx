"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { mutate } from "swr";

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage({ text: "Starting…", ok: true });

    try {
      // Snapshot the current sync time so we know when a new one completes
      const statsBefore = await fetch("/api/sync-stats")
        .then((r) => r.json())
        .catch(() => null);
      const prevSyncAt: string | null = statsBefore?.last_sync_at ?? null;

      // Trigger sync — returns 202 immediately, runs in background
      const res = await fetch("/api/sync", { method: "POST" });

      if (res.status === 409) {
        setMessage({ text: "Sync already in progress — wait a moment", ok: false });
        setLoading(false);
        return;
      }

      setMessage({ text: "Syncing…", ok: true });

      // Poll /api/sync-stats every 3 s until last_sync_at changes
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        if (attempts > 100) {
          // 5 minutes max — give up polling
          clearInterval(interval);
          setLoading(false);
          setMessage({ text: "Sync is running — check stats in a moment", ok: true });
          return;
        }

        try {
          const stats = await fetch("/api/sync-stats").then((r) => r.json());
          if (stats.last_sync_at && stats.last_sync_at !== prevSyncAt) {
            clearInterval(interval);
            setLoading(false);
            const ok = stats.last_sync_status !== "error";
            setMessage({
              text: ok
                ? `Done — ${stats.last_new_added} new, ${stats.last_updated} updated`
                : `Finished with errors — ${stats.last_errors} failed`,
              ok,
            });
            await mutate("/api/sync-stats");
            await mutate(
              (key) => typeof key === "string" && key.startsWith("/api/sync-logs"),
              undefined,
              { revalidate: true }
            );
          }
        } catch {
          // ignore transient poll failures
        }
      }, 3000);
    } catch (err) {
      setLoading(false);
      setMessage({ text: `Could not start sync: ${String(err)}`, ok: false });
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
        {loading ? "Syncing…" : "Sync Now"}
      </button>
      {message && (
        <span className={`text-xs ${message.ok ? "text-emerald-400" : "text-red-400"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
