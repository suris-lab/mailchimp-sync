"use client";

import { useState } from "react";
import { Upload, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";
import type { ImportParams, ImportResult } from "@/lib/types";

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; result: ImportResult }
  | { status: "error"; message: string };

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

export function ImportPanel() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<State>({ status: "idle" });

  const [sourceSheetId, setSourceSheetId] = useState("");
  const [sourceRange, setSourceRange]     = useState("Form Responses 1!A:Z");
  const [emailColumn, setEmailColumn]     = useState("Email");
  const [nameColumn, setNameColumn]       = useState("");
  const [phoneColumn, setPhoneColumn]     = useState("");
  const [interestTag, setInterestTag]     = useState("");

  const canSubmit = sourceSheetId.trim() && sourceRange.trim() && emailColumn.trim() && interestTag.trim();

  async function handleImport() {
    if (!canSubmit) return;
    setState({ status: "loading" });

    const params: ImportParams = {
      sourceSheetId: sourceSheetId.trim(),
      sourceRange: sourceRange.trim(),
      emailColumn: emailColumn.trim(),
      nameColumn:  nameColumn.trim()  || undefined,
      phoneColumn: phoneColumn.trim() || undefined,
      interestTag: interestTag.trim(),
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
      }
    } catch (err) {
      setState({ status: "error", message: String(err) });
    }
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
              label="Source Tab / Range"
              value={sourceRange}
              onChange={setSourceRange}
              placeholder="Form Responses 1!A:Z"
              required
            />
            <Field
              label="Email Column Header"
              value={emailColumn}
              onChange={setEmailColumn}
              placeholder="Email"
              required
            />
            <Field
              label="Interest Tag to Apply"
              value={interestTag}
              onChange={setInterestTag}
              placeholder="Racing Day 2026"
              required
            />
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
      )}
    </div>
  );
}
