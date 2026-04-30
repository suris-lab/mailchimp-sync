"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { mutate } from "swr";

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMessage({ text: "Syncing…", ok: true });

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const body = await res.json();

      if (res.status === 409) {
        setMessage({ text: "Sync already in progress — try again in a moment", ok: false });
        return;
      }

      if (!res.ok || body.error) {
        setMessage({ text: `Sync failed: ${body.error ?? res.statusText}`, ok: false });
        return;
      }

      const log = body.log;
      const skipped = log?.status === "skipped";
      const isError = log?.status === "error";

      setMessage({
        text: skipped
          ? "No changes — Mailchimp is already up to date"
          : isError
          ? `Finished with errors — ${log.errors} failed`
          : `Done — ${log?.new_added ?? 0} new, ${log?.updated ?? 0} updated`,
        ok: !isError,
      });

      await mutate("/api/sync-stats");
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/api/sync-logs"),
        undefined,
        { revalidate: true }
      );
      await mutate("/api/audience-stats");
    } catch (err) {
      setMessage({ text: `Could not reach server: ${String(err)}`, ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg bg-hebe-red px-4 py-2 text-sm font-semibold text-white
                   hover:bg-hebe-red-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                   shadow-sm"
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        {loading ? "Syncing…" : "Sync Now"}
      </button>
      {message && (
        <span className={`text-xs font-medium ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-hebe-red"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
