"use client";

import { useState } from "react";
import { FileText, Trash2, RotateCcw, Plus, ChevronDown, ChevronUp, AlertTriangle, Loader2 } from "lucide-react";
import type { StudioDraft } from "@/lib/types";

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function daysLeft(deletedAt: string): number {
  return Math.max(0, 7 - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86_400_000));
}

interface DraftManagerProps {
  drafts: StudioDraft[];
  trash: StudioDraft[];
  isLoading: boolean;
  activeDraftId: string | null;
  mutate: () => void;
  onLoad: (draft: StudioDraft) => void;
  onNew: () => void;
}

export function DraftManager({
  drafts, trash, isLoading, activeDraftId, mutate, onLoad, onNew,
}: DraftManagerProps) {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState<"drafts" | "trash">("drafts");
  const [busy, setBusy]     = useState<string | null>(null); // id of item being acted on

  const totalCount = drafts.length + trash.length;

  async function moveToTrash(id: string) {
    setBusy(id);
    await fetch(`/api/studio/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "trash" }),
    });
    mutate();
    setBusy(null);
  }

  async function restore(id: string) {
    setBusy(id);
    await fetch(`/api/studio/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "draft" }),
    });
    mutate();
    setBusy(null);
  }

  async function deletePermanently(id: string) {
    setBusy(id);
    await fetch(`/api/studio/drafts/${id}`, { method: "DELETE" });
    mutate();
    setBusy(null);
  }

  const tabCls = (t: "drafts" | "trash") =>
    `px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${
      tab === t
        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
        : "text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300"
    }`;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden mb-6">
      {/* Header — always visible */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText size={13} className="text-gray-400 dark:text-gray-600" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
            Saved Drafts
          </span>
          {totalCount > 0 && (
            <span className="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:text-gray-400">
              {drafts.length} draft{drafts.length !== 1 ? "s" : ""}
              {trash.length > 0 ? ` · ${trash.length} in trash` : ""}
            </span>
          )}
        </div>
        {open ? <ChevronUp size={13} className="text-gray-400" /> : <ChevronDown size={13} className="text-gray-400" />}
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-gray-100 dark:border-gray-800">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-4 py-2.5 gap-2">
            <div className="flex gap-1">
              <button className={tabCls("drafts")} onClick={() => setTab("drafts")}>
                Drafts{drafts.length > 0 ? ` (${drafts.length})` : ""}
              </button>
              <button className={tabCls("trash")} onClick={() => setTab("trash")}>
                Trash{trash.length > 0 ? ` (${trash.length})` : ""}
              </button>
            </div>
            <button
              onClick={onNew}
              className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-[11px] text-gray-500 dark:text-gray-400 hover:border-hebe-red hover:text-hebe-red transition-colors"
            >
              <Plus size={11} /> New Draft
            </button>
          </div>

          {/* Draft list */}
          {tab === "drafts" && (
            <div className="px-4 pb-3 space-y-1.5">
              {isLoading && (
                <div className="flex items-center gap-2 py-4 text-xs text-gray-400 dark:text-gray-600">
                  <Loader2 size={12} className="animate-spin" /> Loading…
                </div>
              )}
              {!isLoading && drafts.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-300 dark:text-gray-700">
                  No saved drafts — start typing to auto-save.
                </p>
              )}
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                    d.id === activeDraftId
                      ? "bg-hebe-red/5 dark:bg-hebe-red/10 border border-hebe-red/20"
                      : "bg-gray-50 dark:bg-gray-800/60 border border-transparent"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{d.title}</p>
                    <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">
                      {d.id === activeDraftId ? "Current · " : ""}Saved {timeAgo(d.updatedAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.id !== activeDraftId && (
                      <button
                        onClick={() => onLoad(d)}
                        className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:border-hebe-red hover:text-hebe-red transition-colors"
                      >
                        Load
                      </button>
                    )}
                    <button
                      onClick={() => moveToTrash(d.id)}
                      disabled={busy === d.id}
                      title="Move to trash"
                      className="rounded-md p-1.5 text-gray-300 dark:text-gray-700 hover:text-hebe-red hover:bg-hebe-red/5 transition-colors disabled:opacity-40"
                    >
                      {busy === d.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Trash list */}
          {tab === "trash" && (
            <div className="px-4 pb-3 space-y-1.5">
              {trash.length === 0 && (
                <p className="py-4 text-center text-xs text-gray-300 dark:text-gray-700">
                  Trash is empty.
                </p>
              )}
              {trash.map((d) => {
                const days = daysLeft(d.deletedAt ?? d.updatedAt);
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-gray-50 dark:bg-gray-800/60"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-500 truncate line-through">
                        {d.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <AlertTriangle size={9} className="text-amber-400 shrink-0" />
                        <p className="text-[10px] text-amber-500 dark:text-amber-400">
                          Deletes in {days} day{days !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => restore(d.id)}
                        disabled={busy === d.id}
                        title="Restore draft"
                        className="rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:border-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors disabled:opacity-40"
                      >
                        {busy === d.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                      </button>
                      <button
                        onClick={() => deletePermanently(d.id)}
                        disabled={busy === d.id}
                        title="Delete permanently"
                        className="rounded-md border border-red-200 dark:border-red-900/50 px-2 py-1 text-[10px] font-semibold text-hebe-red hover:bg-hebe-red hover:text-white transition-colors disabled:opacity-40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
