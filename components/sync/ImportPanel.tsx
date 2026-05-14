"use client";

import { useState, useEffect, useCallback } from "react";
import { Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle, RotateCcw, Undo2 } from "lucide-react";
import type { ImportParams, ImportResult, ImportLog } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ImportResult }
  | { status: "error"; message: string };

const ADMIN_OPTIONS = [
  "Committee_Sailing",
  "General_Committee_2026",
  "Committee_FandB",
  "Committee_Racing",
  "Committee_24",
  "Committee_Training",
  "Committee_Finance",
  "Committee_HR",
  "VIP",
  "Sponsor",
  "Unsubscribed",
  "Action_RenewalDue",
  "2backup_contact",
  "3backup_contact",
  "3shared_contact",
  "Cleaned",
  "Test",
  "Reciprocal_Club",
];

const INTEREST_OPTIONS = [
  "Interest_Sailing_Dinghy",
  "Interest_Sailing_Keelboat",
  "Interest_Sailing_Cruising",
  "Interest_Sailing_Racing",
  "Interest_Sailing_Powerboating",
  "Interest_Sailing_Paddling",
  "Interest_Sailing_Training",
  "Interest_FandB",
  "Interest_FandB_Veggie",
  "Interest_FandB_Vegan",
  "Interest_FandB_Seafood",
  "Interest_FandB_Meat",
  "Interest_Social",
  "Interest_Volunteer",
  "event_Sailor",
  "event_24",
  "event_STC",
  "event_Sailing_SocialNight",
];

function Field({
  label, value, onChange, placeholder, required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}{required && <span className="text-hebe-red ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                   px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
                   focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors"
      />
    </div>
  );
}

const inputClass = `w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
  px-3 py-2 text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500
  focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors`;

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) +
    " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function HistoryRow({
  log,
  undoConfirm,
  actionLoading,
  onRerun,
  onUndo,
  onUndoConfirm,
  onRemark,
}: {
  log: ImportLog;
  undoConfirm: string | null;
  actionLoading: string | null;
  onRerun: (log: ImportLog) => void;
  onUndo: (log: ImportLog) => void;
  onUndoConfirm: (id: string | null) => void;
  onRemark: (id: string, remark: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(log.remark);
  const busy = actionLoading === log.id;

  function commitRemark() {
    setEditing(false);
    onRemark(log.id, draft);
  }

  return (
    <div className={`rounded-lg border px-3 py-2.5 text-xs transition-colors ${
      log.undone
        ? "border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 opacity-60"
        : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900"
    }`}>
      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">

        {/* Date */}
        <span className="text-gray-400 shrink-0 w-[88px] tabular-nums">{fmtDate(log.timestamp)}</span>

        {/* Tag */}
        <span className="font-mono text-[10px] text-gray-600 dark:text-gray-300 truncate max-w-[200px]" title={log.params.interestTag}>
          {log.params.interestTag}
        </span>

        {/* Counts */}
        <span className="shrink-0 whitespace-nowrap text-gray-500 tabular-nums">
          <span className="text-hebe-red font-medium">{log.tagged}↑</span>
          {" · "}
          <span className="text-green-600 font-medium">{log.inserted}+</span>
          {" · "}
          <span>{log.skipped}—</span>
        </span>

        {/* Remark */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              autoFocus
              className="w-full rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800
                         px-2 py-0.5 text-xs focus:outline-none focus:border-hebe-red transition-colors"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitRemark}
              onKeyDown={e => {
                if (e.key === "Enter") commitRemark();
                if (e.key === "Escape") setEditing(false);
              }}
            />
          ) : (
            <button
              className="text-gray-400 dark:text-gray-500 italic hover:text-gray-600 dark:hover:text-gray-300
                         transition-colors text-left truncate w-full max-w-full"
              onClick={() => { setDraft(log.remark); setEditing(true); }}
            >
              {log.remark || "Add remark…"}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {busy && <span className="text-gray-400 text-[10px]">…</span>}

          {!log.undone && !busy && (
            <>
              <button
                title="Re-run this import"
                onClick={() => onRerun(log)}
                className="flex items-center gap-1 text-gray-500 hover:text-hebe-red transition-colors"
              >
                <RotateCcw size={11} />
                <span>Re-run</span>
              </button>

              {undoConfirm === log.id ? (
                <button
                  onClick={() => onUndo(log)}
                  className="text-hebe-red font-medium animate-pulse"
                >
                  Confirm?
                </button>
              ) : (
                <button
                  title="Reverse this import"
                  onClick={() => onUndoConfirm(log.id)}
                  className="flex items-center gap-1 text-gray-500 hover:text-hebe-red transition-colors"
                >
                  <Undo2 size={11} />
                  <span>Undo</span>
                </button>
              )}
            </>
          )}

          {log.undone && !busy && (
            <span className="text-gray-400 text-[10px] italic">Undone</span>
          )}
        </div>
      </div>

      {log.errors.length > 0 && (
        <p className="mt-1 text-red-500 text-[10px] pl-[96px]">{log.errors.join(" · ")}</p>
      )}
    </div>
  );
}

export function ImportPanel() {
  const [open, setOpen]   = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  const [sourceSheetId, setSourceSheetId] = useState("");
  const [sourceTab, setSourceTab]         = useState("Sheet1");
  const [emailColumn, setEmailColumn]     = useState("Email");
  const [nameColumn, setNameColumn]       = useState("");
  const [phoneColumn, setPhoneColumn]     = useState("");
  const [tagSelection, setTagSelection]   = useState("");
  const [customTag, setCustomTag]         = useState("");
  const interestTag = tagSelection === "Other" ? customTag.trim() : tagSelection;

  const [adminTags, setAdminTags]           = useState<string[]>([]);
  const [customAdminInput, setCustomAdminInput] = useState("");

  function toggleAdmin(tag: string) {
    setAdminTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  }
  function addCustomAdmin() {
    const val = customAdminInput.trim();
    if (val && !adminTags.includes(val)) {
      setAdminTags(prev => [...prev, val]);
      setCustomAdminInput("");
    }
  }

  const [history, setHistory]           = useState<ImportLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [actionLoading, setActionLoading]   = useState<string | null>(null);
  const [undoConfirm, setUndoConfirm]       = useState<string | null>(null);

  const canSubmit = sourceSheetId.trim() && sourceTab.trim() && emailColumn.trim() && interestTag;

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch("/api/import-logs");
      if (res.ok) setHistory(await res.json());
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) loadHistory();
  }, [open, loadHistory]);

  // Dismiss undo confirm on outside click
  useEffect(() => {
    if (!undoConfirm) return;
    const dismiss = () => setUndoConfirm(null);
    window.addEventListener("click", dismiss, { once: true });
    return () => window.removeEventListener("click", dismiss);
  }, [undoConfirm]);

  async function handleImport() {
    if (!canSubmit) return;
    setState({ status: "loading" });

    const params: ImportParams = {
      sourceSheetId: sourceSheetId.trim(),
      sourceRange:   `${sourceTab.trim()}!A:Z`,
      emailColumn:   emailColumn.trim(),
      nameColumn:    nameColumn.trim()  || undefined,
      phoneColumn:   phoneColumn.trim() || undefined,
      interestTag,
      administrativeTags: adminTags.length > 0 ? adminTags : undefined,
    };

    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ status: "error", message: data.error ?? "Import failed" });
      } else {
        setState({ status: "success", result: data as ImportResult });
        loadHistory();
      }
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
  }

  async function handleRerun(log: ImportLog) {
    setActionLoading(log.id);
    try {
      const res = await fetch(`/api/import-logs/${log.id}/rerun`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setState({ status: "success", result: data.result as ImportResult });
        await loadHistory();
      } else {
        setState({ status: "error", message: data.error ?? "Re-run failed" });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleUndo(log: ImportLog) {
    setUndoConfirm(null);
    setActionLoading(log.id);
    try {
      const res = await fetch(`/api/import-logs/${log.id}/undo`, { method: "POST" });
      if (res.ok) {
        await loadHistory();
      } else {
        const data = await res.json();
        setState({ status: "error", message: data.error ?? "Undo failed" });
      }
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRemark(id: string, remark: string) {
    setHistory(h => h.map(l => l.id === id ? { ...l, remark } : l));
    await fetch(`/api/import-logs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remark }),
    });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <Upload size={14} className="text-gray-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">Import from External Sheet</p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              WPForms, event registrations — merge into main contact list
            </p>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <>
          {/* ── Form ── */}
          <div className="px-5 pb-5 space-y-4 border-t border-gray-100 dark:border-gray-800 pt-4">
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Existing emails → Interest tag added only. New emails → full row inserted. Runs against the main sheet.
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label="Source Sheet ID"
                value={sourceSheetId}
                onChange={setSourceSheetId}
                placeholder="Paste the ID from the sheet URL"
                required
              />
              <Field
                label="Source Tab Name"
                value={sourceTab}
                onChange={setSourceTab}
                placeholder="Sheet1"
                required
              />
              <Field
                label="Email Column Header"
                value={emailColumn}
                onChange={setEmailColumn}
                placeholder="Email"
                required
              />

              {/* Interest tag dropdown */}
              <div className="sm:col-span-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Interest Tag to Apply<span className="text-hebe-red ml-0.5">*</span>
                </label>
                <select
                  value={tagSelection}
                  onChange={e => { setTagSelection(e.target.value); setCustomTag(""); }}
                  className={inputClass}
                >
                  <option value="">— select a tag —</option>
                  {INTEREST_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                  <option value="Other">Other (type below)…</option>
                </select>
                {tagSelection === "Other" && (
                  <input
                    type="text"
                    value={customTag}
                    onChange={e => setCustomTag(e.target.value)}
                    placeholder="Type new tag name"
                    className={`mt-2 ${inputClass}`}
                  />
                )}
              </div>

              <Field
                label="Name Column Header (optional)"
                value={nameColumn}
                onChange={setNameColumn}
                placeholder="Full Name"
              />
              <Field
                label="Phone Column Header (optional)"
                value={phoneColumn}
                onChange={setPhoneColumn}
                placeholder="Phone"
              />

              {/* Administrative tags — multi-select chips */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Administrative Tags{" "}
                  <span className="text-gray-400 font-normal">(optional — appended to Administrative column)</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {ADMIN_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggleAdmin(opt)}
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium border transition-colors ${
                        adminTags.includes(opt)
                          ? "bg-hebe-red text-white border-hebe-red"
                          : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-hebe-red hover:text-hebe-red"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                {/* Custom tag input */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customAdminInput}
                    onChange={e => setCustomAdminInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomAdmin(); } }}
                    placeholder="Add custom administrative tag…"
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={addCustomAdmin}
                    disabled={!customAdminInput.trim()}
                    className="rounded-lg px-3 py-2 text-xs border border-gray-200 dark:border-gray-700
                               text-gray-600 dark:text-gray-300 hover:border-hebe-red hover:text-hebe-red
                               disabled:opacity-40 transition-colors shrink-0"
                  >
                    Add
                  </button>
                </div>
                {/* Show selected custom tags (not in the preset list) */}
                {adminTags.filter(t => !ADMIN_OPTIONS.includes(t)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {adminTags.filter(t => !ADMIN_OPTIONS.includes(t)).map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium bg-hebe-red text-white"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => setAdminTags(prev => prev.filter(t => t !== tag))}
                          className="hover:opacity-70 leading-none"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleImport}
                disabled={!canSubmit || state.status === "loading"}
                className="rounded-lg bg-hebe-red px-4 py-2 text-xs font-medium text-white
                           hover:bg-hebe-red-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {state.status === "loading" ? "Importing…" : "Import Contacts"}
              </button>

              {state.status === "success" && (
                <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                  <CheckCircle size={13} className="text-green-500 shrink-0" />
                  <span>
                    <strong>{state.result.tagged}</strong> tagged ·{" "}
                    <strong>{state.result.inserted}</strong> inserted ·{" "}
                    <strong>{state.result.skipped}</strong> skipped
                  </span>
                </div>
              )}

              {state.status === "error" && (
                <div className="flex items-start gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0 mt-0.5" />
                  <span className="break-all">{state.message}</span>
                </div>
              )}
            </div>

            {state.status === "success" && state.result.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
                {state.result.errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}

            <p className="text-[10px] text-gray-400 dark:text-gray-500">
              After import the main sheet is modified — the next scheduled sync will push changes to Mailchimp automatically.
              Run a manual sync immediately from the dashboard if needed.
            </p>
          </div>

          {/* ── Import History ── */}
          <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-2">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Import History</p>

            {historyLoading ? (
              <p className="text-[11px] text-gray-400">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-[11px] text-gray-400">No imports yet.</p>
            ) : (
              <div className="space-y-1.5">
                {history.map(log => (
                  <HistoryRow
                    key={log.id}
                    log={log}
                    undoConfirm={undoConfirm}
                    actionLoading={actionLoading}
                    onRerun={handleRerun}
                    onUndo={handleUndo}
                    onUndoConfirm={setUndoConfirm}
                    onRemark={handleRemark}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
