"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { mutate } from "swr";

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setMessage({ text: `Done — ${data.log.new_added} new, ${data.log.updated} updated`, ok: true });
        await mutate("/api/sync-stats");
        // Mutate all sync-logs keys (date-range agnostic)
        await mutate((key) => typeof key === "string" && key.startsWith("/api/sync-logs"), undefined, { revalidate: true });
      } else {
        setMessage({ text: data.error ?? "Sync failed", ok: false });
      }
    } catch (err) {
      setMessage({ text: `Request failed: ${String(err)}`, ok: false });
    } finally {
      setLoading(false);
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
