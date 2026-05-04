"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, ExternalLink, RotateCcw, Sparkles } from "lucide-react";
import type { StudioEvent, ContentObjective, StudioOutput } from "@/lib/types";

// ── Objective config ──────────────────────────────────────────────────────────
const OBJECTIVES: { value: ContentObjective; label: string; desc: string }[] = [
  { value: "open_rate",  label: "Maximise Opens",   desc: "Curiosity-driven subject, warm tone" },
  { value: "click_rate", label: "Maximise Clicks",  desc: "Action-focused CTAs per event" },
  { value: "re_engage",  label: "Re-engage Cold",   desc: "Invite lapsed members back" },
];

const EMPTY_EVENT: StudioEvent = { title: "", datetime: "", details: "" };

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({
  event, index, onChange, onRemove, canRemove,
}: {
  event: StudioEvent;
  index: number;
  onChange: (e: StudioEvent) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors";

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
          Event {index + 1}
        </span>
        {canRemove && (
          <button
            onClick={onRemove}
            className="text-gray-300 dark:text-gray-700 hover:text-hebe-red dark:hover:text-hebe-red transition-colors"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
      <input
        type="text"
        placeholder="Event title (e.g. Racing Day, AGM, Pool Party)"
        value={event.title}
        onChange={e => onChange({ ...event, title: e.target.value })}
        className={inputCls}
      />
      <input
        type="text"
        placeholder="Date & time (e.g. Saturday 10 May, 10:00am)"
        value={event.datetime}
        onChange={e => onChange({ ...event, datetime: e.target.value })}
        className={inputCls}
      />
      <textarea
        placeholder="Details, notes, anything you want the AI to include…"
        value={event.details}
        onChange={e => onChange({ ...event, details: e.target.value })}
        rows={2}
        className={`${inputCls} resize-none`}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
type Stage = "idle" | "generating" | "preview" | "creating" | "done";

export function ContentStudio() {
  const [objective, setObjective] = useState<ContentObjective>("open_rate");
  const [events, setEvents]       = useState<StudioEvent[]>([{ ...EMPTY_EVENT }]);
  const [notes, setNotes]         = useState("");
  const [stage, setStage]         = useState<Stage>("idle");
  const [output, setOutput]       = useState<StudioOutput | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [error, setError]         = useState<string | null>(null);

  function addEvent() {
    if (events.length < 6) setEvents(prev => [...prev, { ...EMPTY_EVENT }]);
  }

  function updateEvent(i: number, e: StudioEvent) {
    setEvents(prev => prev.map((v, idx) => idx === i ? e : v));
  }

  function removeEvent(i: number) {
    setEvents(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerate() {
    setStage("generating");
    setError(null);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, events, additionalNotes: notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setOutput({ subject: data.subject, html: data.html });
      setEditSubject(data.subject);
      setStage("preview");
    } catch (err) {
      setError(String(err));
      setStage("idle");
    }
  }

  async function handleCreateDraft() {
    if (!output) return;
    setStage("creating");
    setError(null);
    try {
      const res = await fetch("/api/studio/create-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: editSubject, html: output.html }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Draft creation failed");
      setOutput(prev => prev ? { ...prev, campaignUrl: data.url } : prev);
      setStage("done");
    } catch (err) {
      setError(String(err));
      setStage("preview");
    }
  }

  function reset() {
    setStage("idle");
    setOutput(null);
    setEditSubject("");
    setError(null);
    setEvents([{ ...EMPTY_EVENT }]);
    setNotes("");
    setObjective("open_rate");
  }

  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors resize-none";

  // ── Done state ──────────────────────────────────────────────────────────────
  if (stage === "done" && output?.campaignUrl) {
    return (
      <div className="card p-6 text-center space-y-4">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-hebe-red/10 mx-auto">
          <Sparkles size={18} className="text-hebe-red" />
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">Draft created in Mailchimp</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Review and send from the Mailchimp editor</p>
        </div>
        <div className="flex gap-2 justify-center">
          <a
            href={output.campaignUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-hebe-red px-4 py-2 text-xs font-semibold text-white hover:bg-hebe-red-dark transition-colors"
          >
            Open in Mailchimp <ExternalLink size={12} />
          </a>
          <button
            onClick={reset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors"
          >
            <RotateCcw size={12} /> Start Over
          </button>
        </div>
      </div>
    );
  }

  // ── Preview state ───────────────────────────────────────────────────────────
  if ((stage === "preview" || stage === "creating") && output) {
    return (
      <div className="space-y-4">
        {/* Subject line */}
        <div className="card p-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            Subject Line
          </p>
          <input
            type="text"
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-hebe-red transition-colors"
          />
          <p className="text-[10px] text-gray-400 dark:text-gray-600">{editSubject.length}/60 chars</p>
        </div>

        {/* HTML preview */}
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Email Preview
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">Merge tags (*|FNAME|*) will be replaced at send time</p>
          </div>
          <iframe
            srcDoc={output.html}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ height: 480 }}
            title="Email preview"
          />
        </div>

        {error && (
          <p className="text-xs text-hebe-red px-1">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleCreateDraft}
            disabled={stage === "creating"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-hebe-red px-4 py-2.5 text-xs font-semibold text-white hover:bg-hebe-red-dark disabled:opacity-60 transition-colors"
          >
            {stage === "creating" ? (
              <><Loader2 size={13} className="animate-spin" /> Creating draft…</>
            ) : (
              "Create Mailchimp Draft"
            )}
          </button>
          <button
            onClick={() => setStage("idle")}
            disabled={stage === "creating"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-60"
          >
            <RotateCcw size={12} /> Regenerate
          </button>
        </div>
      </div>
    );
  }

  // ── Generating state ────────────────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <div className="card p-12 flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin text-hebe-red" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Analysing your audience data…</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Reading campaign history, lifecycle stats and crafting your email</p>
      </div>
    );
  }

  // ── Idle (form) state ───────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Objective selector */}
      <div className="card p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Content Objective
        </p>
        <div className="flex flex-wrap gap-2">
          {OBJECTIVES.map(o => (
            <button
              key={o.value}
              onClick={() => setObjective(o.value)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors text-left ${
                objective === o.value
                  ? "bg-hebe-red text-white"
                  : "bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700"
              }`}
            >
              <span className="block">{o.label}</span>
              <span className={`block text-[10px] font-normal mt-0.5 ${objective === o.value ? "text-white/70" : "text-gray-400 dark:text-gray-600"}`}>
                {o.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Events */}
      <div className="space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 px-1">
          This Week's Events
        </p>
        {events.map((e, i) => (
          <EventCard
            key={i}
            event={e}
            index={i}
            onChange={ev => updateEvent(i, ev)}
            onRemove={() => removeEvent(i)}
            canRemove={events.length > 1}
          />
        ))}
        {events.length < 6 && (
          <button
            onClick={addEvent}
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-hebe-red dark:hover:text-hebe-red transition-colors px-1"
          >
            <Plus size={13} /> Add another event
          </button>
        )}
      </div>

      {/* Additional notes */}
      <div className="card p-4 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Additional Notes
        </p>
        <textarea
          placeholder="Anything else to include — tone guidance, special announcements, sponsor mentions…"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className={inputCls}
        />
      </div>

      {error && (
        <p className="text-xs text-hebe-red px-1">{error}</p>
      )}

      <button
        onClick={handleGenerate}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-hebe-red px-4 py-3 text-sm font-semibold text-white hover:bg-hebe-red-dark transition-colors"
      >
        <Sparkles size={15} />
        Analyse &amp; Generate Draft
      </button>
    </div>
  );
}
