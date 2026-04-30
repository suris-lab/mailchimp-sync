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
      const body = await res.json();

      if (res.status === 409) {
        setMessage({ text: "Already syncing — try again shortly", ok: false });
        return;
      }
      if (!res.ok || body.error) {
        setMessage({ text: body.error ?? res.statusText, ok: false });
        return;
      }

      const log = body.log;
      const skipped = log?.status === "skipped";
      const isError = log?.status === "error";

      setMessage({
        text: skipped
          ? "No changes"
          : isError
          ? `${log.errors} error(s)`
          : `+${log?.new_added ?? 0} new, ${log?.updated ?? 0} updated`,
        ok: !isError,
      });

      await mutate("/api/sync-stats");
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/api/sync-logs"),
        undefined,
        { revalidate: true },
      );
      await mutate("/api/audience-stats");
    } catch (err) {
      setMessage({ text: String(err), ok: false });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className="flex items-center gap-1.5 rounded-lg bg-hebe-red px-3 sm:px-4 py-2 text-xs sm:text-sm
                   font-semibold text-white hover:bg-hebe-red-dark
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
      >
        <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        <span className="hidden xs:inline sm:inline">{loading ? "Syncing…" : "Sync Now"}</span>
      </button>
      {/* Message shown below header on mobile — overlapping is ugly */}
      {message && (
        <span className={`hidden sm:inline text-xs font-medium ${message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-hebe-red"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
