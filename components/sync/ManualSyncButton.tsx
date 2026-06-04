"use client";

import { useState, useRef } from "react";
import { RefreshCw, CheckCircle, XCircle } from "lucide-react";
import { mutate } from "swr";
import type { SyncProgress } from "@/lib/types";

export function ManualSyncButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);

  function startPolling() {
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sync-progress");
        const data: SyncProgress | null = await res.json();
        if (data) setProgress(data);
      } catch {
        // ignore poll errors silently
      }
    }, 800);
  }

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setProgress(null);
  }

  function barPercent(): number {
    if (!progress || progress.phase === "fetching" || progress.total === 0) return 18;
    return Math.max(18, Math.round((progress.processed / progress.total) * 100));
  }

  const progressLabel = progress
    ? progress.phase === "fetching"
      ? "Fetching contacts…"
      : progress.total > 0
      ? `${progress.processed.toLocaleString()} / ${(progress.sheet_total ?? progress.total).toLocaleString()} contacts`
      : "Preparing…"
    : "Starting…";

  async function handleSync() {
    setLoading(true);
    setMessage(null);
    setProgress(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);

    const pollTimer = setTimeout(startPolling, 1000);

    try {
      const res = await fetch("/api/sync", { method: "POST" });
      clearTimeout(pollTimer);
      stopPolling();

      if (res.status === 409) {
        showToast("Already syncing — try again shortly", false);
        return;
      }

      const contentType = res.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        showToast(`Sync failed (HTTP ${res.status})`, false);
        return;
      }

      const body = await res.json();
      if (!res.ok || body.error) {
        showToast(body.error ?? res.statusText, false);
        return;
      }

      const log = body.log;
      const skipped = log?.status === "skipped";
      const isError = log?.status === "error";

      showToast(
        skipped
          ? "No changes"
          : isError
          ? `${log.errors} error(s)`
          : `+${log?.new_added ?? 0} new · ${log?.updated ?? 0} updated`,
        !isError,
      );

      await mutate("/api/sync-stats");
      await mutate(
        (key) => typeof key === "string" && key.startsWith("/api/sync-logs"),
        undefined,
        { revalidate: true },
      );
      await mutate("/api/audience-stats");
      await mutate("/api/growth-stats");
    } catch (err) {
      clearTimeout(pollTimer);
      stopPolling();
      showToast(String(err), false);
    } finally {
      setLoading(false);
    }
  }

  function showToast(text: string, ok: boolean) {
    setMessage({ text, ok });
    toastTimer.current = setTimeout(() => setMessage(null), 5000);
  }

  return (
    <>
      {/* ── Full-width progress bar — top of viewport ── */}
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-[3px] bg-gray-200/60 dark:bg-gray-800/60 overflow-hidden">
          {/* Filled portion */}
          <div
            className="relative h-full bg-hebe-red transition-[width] duration-500 ease-out overflow-hidden"
            style={{ width: `${barPercent()}%` }}
          >
            {/* Shimmer sweep */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent
                            animate-[shimmer_1.2s_ease-in-out_infinite] -translate-x-full" />
          </div>
        </div>
      )}

      {/* ── Progress label — top-right corner, tucked under bar ── */}
      {loading && (
        <div className="fixed top-[3px] right-3 z-[60]
                        text-[10px] font-mono text-white bg-hebe-red
                        px-2 py-0.5 rounded-b-md shadow-sm">
          {progressLabel}
        </div>
      )}

      {/* ── Result toast — bottom-right, auto-dismisses in 5s ── */}
      {!loading && message && (
        <div
          className={`fixed bottom-6 right-6 z-[60]
                      flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-xl
                      text-sm font-medium
                      animate-[toast-in_0.2s_ease-out_forwards]
                      ${message.ok
                        ? "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                        : "bg-white dark:bg-gray-900 border-hebe-red/40 text-hebe-red"}`}
        >
          {message.ok
            ? <CheckCircle size={15} className="text-gray-400 shrink-0" />
            : <XCircle size={15} className="text-hebe-red shrink-0" />}
          {message.text}
        </div>
      )}

      {/* ── The button — clean, no inline status ── */}
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
    </>
  );
}
