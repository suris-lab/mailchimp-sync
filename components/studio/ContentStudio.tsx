"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, ExternalLink, RotateCcw, Sparkles, ChevronRight, ChevronLeft, RefreshCw, Wand2 } from "lucide-react";
import type { StudioEvent, ContentObjective, StudioOutput, StudioDraft } from "@/lib/types";

// ── Category config ───────────────────────────────────────────────────────────
const CATEGORIES: Record<string, { types: string[] }> = {
  "F&B": {
    types: ["New Menu Release", "Restaurant Events", "Promotions", "Crazy Friday", "Seminars", "Workshops"],
  },
  "Sailing Event": {
    types: ["Yacht Racing", "Dinghy Racing", "Crew Board", "Race", "Sailing Centre", "Hebe Dragons", "Trainings & Camps"],
  },
  "Club News": {
    types: ["GMM", "AGM", "Maintenance", "Festival Greetings"],
  },
  "Marine": {
    types: ["Marine Facilities", "Weather", "Car Park", "HebeOne"],
  },
};

const CATEGORY_KEYS = Object.keys(CATEGORIES);

const OBJECTIVES: { value: ContentObjective; label: string; desc: string }[] = [
  { value: "open_rate",  label: "Maximise Opens",  desc: "Curiosity-driven subject, warm personal tone" },
  { value: "click_rate", label: "Maximise Clicks", desc: "Action-focused CTAs, event-by-event urgency" },
  { value: "re_engage",  label: "Re-engage Cold",  desc: "Warm invite for lapsed members to return" },
];

const EMPTY_EVENT: StudioEvent = {
  title: "", datetime: "", details: "",
  eventCategory: "", eventType: "",
  ctaUrl: "", ctaLabel: "",
};

type Stage = "idle" | "generating" | "preview" | "creating" | "done";
type WizardStep = 1 | 2 | 3;
type SaveStatus = "idle" | "dirty" | "saving" | "saved";

// ── Step indicator ────────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: WizardStep }) {
  const steps = ["Objective", "Events", "Notes"];
  return (
    <div className="flex items-center">
      {steps.map((label, i) => {
        const step = (i + 1) as WizardStep;
        const done = current > step;
        const active = current === step;
        return (
          <div key={step} className="flex items-center">
            <div className={`flex items-center gap-1.5 ${active || done ? "text-hebe-red" : "text-gray-400 dark:text-gray-600"}`}>
              <span className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold border transition-colors ${
                active || done
                  ? "border-hebe-red bg-hebe-red text-white"
                  : "border-gray-300 dark:border-gray-700 text-gray-400"
              }`}>{step}</span>
              <span className={`text-xs font-medium hidden sm:inline ${active ? "text-gray-900 dark:text-white" : ""}`}>{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`mx-2 h-px w-8 transition-colors ${done ? "bg-hebe-red" : "bg-gray-200 dark:bg-gray-800"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Event card ────────────────────────────────────────────────────────────────
function EventCard({
  event, index, onChange, onRemove, canRemove, onGenerateCta, generatingCta,
}: {
  event: StudioEvent;
  index: number;
  onChange: (e: StudioEvent) => void;
  onRemove: () => void;
  canRemove: boolean;
  onGenerateCta: () => void;
  generatingCta: boolean;
}) {
  const predefined = event.eventCategory ? (CATEGORIES[event.eventCategory]?.types ?? []) : [];
  const isCustom = !!event.eventCategory && !!event.eventType && !predefined.includes(event.eventType);
  const [showCustomInput, setShowCustomInput] = useState(isCustom);

  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors";

  function selectCategory(cat: string) {
    setShowCustomInput(false);
    onChange({ ...event, eventCategory: cat, eventType: "" });
  }

  function selectType(type: string) {
    setShowCustomInput(false);
    onChange({ ...event, eventType: type });
  }

  function selectCustom() {
    setShowCustomInput(true);
    onChange({ ...event, eventType: "" });
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600">
          Event {index + 1}
        </span>
        {canRemove && (
          <button onClick={onRemove} className="text-gray-300 dark:text-gray-700 hover:text-hebe-red transition-colors">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      {/* Category selector */}
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1.5">Category</p>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_KEYS.map(cat => (
            <button
              key={cat}
              onClick={() => selectCategory(cat)}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors border ${
                event.eventCategory === cat
                  ? "bg-hebe-red border-hebe-red text-white"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Type chips — shown once a category is picked */}
      {event.eventCategory && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-1.5">Type</p>
          <div className="flex flex-wrap gap-1.5">
            {predefined.map(type => (
              <button
                key={type}
                onClick={() => selectType(type)}
                className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors border ${
                  event.eventType === type && !showCustomInput
                    ? "bg-hebe-red/10 border-hebe-red/40 text-hebe-red"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {type}
              </button>
            ))}
            <button
              onClick={selectCustom}
              className={`rounded-md px-2 py-1 text-[10px] font-medium transition-colors border ${
                showCustomInput
                  ? "bg-hebe-red/10 border-hebe-red/40 text-hebe-red"
                  : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              Custom
            </button>
          </div>
          {showCustomInput && (
            <input
              type="text"
              placeholder="Describe the event type…"
              value={event.eventType}
              onChange={e => onChange({ ...event, eventType: e.target.value })}
              className={`${inputCls} mt-2`}
              autoFocus
            />
          )}
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        placeholder="Event title"
        value={event.title}
        onChange={e => onChange({ ...event, title: e.target.value })}
        className={inputCls}
      />

      {/* Date & time */}
      <input
        type="text"
        placeholder="Date & time (e.g. Saturday 10 May, 10:00am)"
        value={event.datetime}
        onChange={e => onChange({ ...event, datetime: e.target.value })}
        className={inputCls}
      />

      {/* Details */}
      <textarea
        placeholder="Details, notes, anything you want the AI to include…"
        value={event.details}
        onChange={e => onChange({ ...event, details: e.target.value })}
        rows={2}
        className={`${inputCls} resize-none`}
      />

      {/* CTA row */}
      <div className="space-y-2">
        <input
          type="url"
          placeholder="CTA URL (https://…)"
          value={event.ctaUrl}
          onChange={e => onChange({ ...event, ctaUrl: e.target.value })}
          className={inputCls}
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Button label (Register Now…)"
            value={event.ctaLabel}
            onChange={e => onChange({ ...event, ctaLabel: e.target.value })}
            className={inputCls}
          />
          <button
            onClick={onGenerateCta}
            disabled={generatingCta}
            title="AI suggest button label"
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 hover:border-hebe-red hover:text-hebe-red dark:hover:border-hebe-red dark:hover:text-hebe-red transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            {generatingCta
              ? <Loader2 size={11} className="animate-spin" />
              : <Wand2 size={11} />
            }
            {generatingCta ? "…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface ContentStudioProps {
  initialDraftId?: string | null;
  initialInput?: StudioDraft["input"] | null;
  onSaved?: (draft: StudioDraft) => void;
  onDiscard?: () => void;
}

// ── Main component ────────────────────────────────────────────────────────────
export function ContentStudio({
  initialDraftId = null,
  initialInput = null,
  onSaved,
  onDiscard,
}: ContentStudioProps) {
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [objective, setObjective] = useState<ContentObjective>(initialInput?.objective ?? "open_rate");
  const [events, setEvents]       = useState<StudioEvent[]>(initialInput?.events?.length ? initialInput.events : [{ ...EMPTY_EVENT }]);
  const [notes, setNotes]         = useState(initialInput?.additionalNotes ?? "");
  const [stage, setStage]         = useState<Stage>("idle");
  const [output, setOutput]       = useState<StudioOutput | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [error, setError]         = useState<string | null>(null);
  const [regeneratingSubject, setRegeneratingSubject] = useState(false);
  const [generatingCtaFor, setGeneratingCtaFor] = useState<number | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Stable refs — avoid stale closures inside doSave without re-creating the callback
  const draftIdRef  = useRef<string | null>(initialDraftId);
  const inputRef    = useRef({ objective, events, notes, output });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { inputRef.current = { objective, events, notes, output }; }, [objective, events, notes, output]);

  // ── Auto-save (debounced 2 s) ─────────────────────────────────────────────
  const doSave = useCallback(async () => {
    const { objective: obj, events: evs, notes: nts, output: out } = inputRef.current;
    setSaveStatus("saving");
    try {
      const body = {
        id: draftIdRef.current,
        input: { objective: obj, events: evs, additionalNotes: nts },
        ...(out ? { output: { subject: out.subject, html: out.html, campaignUrl: out.campaignUrl } } : {}),
      };
      const res = await fetch("/api/studio/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const draft: StudioDraft = await res.json();
        draftIdRef.current = draft.id;
        onSaved?.(draft);
        setSaveStatus("saved");
      } else {
        setSaveStatus("dirty");
      }
    } catch {
      setSaveStatus("dirty");
    }
  }, [onSaved]);

  // Trigger auto-save whenever form input changes
  useEffect(() => {
    const hasContent = events.some((e) => e.title.trim() || e.details.trim()) || notes.trim();
    if (!hasContent) return;

    setSaveStatus("dirty");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(doSave, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [objective, events, notes, doSave]);

  // Also save immediately when AI output is generated
  useEffect(() => {
    if (!output) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    doSave();
  }, [output, doSave]);

  // ── Form helpers ──────────────────────────────────────────────────────────
  function addEvent() {
    if (events.length < 6) setEvents(prev => [...prev, { ...EMPTY_EVENT }]);
  }
  function updateEvent(i: number, e: StudioEvent) {
    setEvents(prev => prev.map((v, idx) => idx === i ? e : v));
  }
  function removeEvent(i: number) {
    setEvents(prev => prev.filter((_, idx) => idx !== i));
  }

  async function handleGenerateCta(i: number) {
    setGeneratingCtaFor(i);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, events, additionalNotes: notes, ctaLabelOnly: true, ctaLabelEventIndex: i }),
      });
      const data = await res.json();
      if (res.ok && data.ctaLabel) updateEvent(i, { ...events[i], ctaLabel: data.ctaLabel });
    } catch { /* silent */ } finally {
      setGeneratingCtaFor(null);
    }
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
      setWizardStep(3);
    }
  }

  async function handleRegenerateSubject() {
    setRegeneratingSubject(true);
    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective, events, additionalNotes: notes, subjectOnly: true }),
      });
      const data = await res.json();
      if (res.ok && data.subject) setEditSubject(data.subject);
    } catch { /* silent */ } finally {
      setRegeneratingSubject(false);
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
    setWizardStep(1);
    setOutput(null);
    setEditSubject("");
    setError(null);
    setEvents([{ ...EMPTY_EVENT }]);
    setNotes("");
    setObjective("open_rate");
    setSaveStatus("idle");
    draftIdRef.current = null;
    onDiscard?.();
  }

  const inputCls = "w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-hebe-red dark:focus:border-hebe-red transition-colors resize-none";

  // ── Save status badge ─────────────────────────────────────────────────────
  const saveBadge = (
    <span className="text-[10px] text-gray-400 dark:text-gray-600 shrink-0 ml-auto pl-4">
      {saveStatus === "dirty"  && "Unsaved…"}
      {saveStatus === "saving" && <span className="flex items-center gap-1"><Loader2 size={9} className="animate-spin" />Saving…</span>}
      {saveStatus === "saved"  && "✓ Saved"}
    </span>
  );

  // ── Done ──────────────────────────────────────────────────────────────────
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

  // ── Preview / Creating ────────────────────────────────────────────────────
  if ((stage === "preview" || stage === "creating") && output) {
    return (
      <div className="space-y-4">
        <div className="card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Subject Line
            </p>
            <button
              onClick={handleRegenerateSubject}
              disabled={regeneratingSubject || stage === "creating"}
              className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500 hover:text-hebe-red transition-colors disabled:opacity-40"
            >
              <RefreshCw size={11} className={regeneratingSubject ? "animate-spin" : ""} />
              {regeneratingSubject ? "Regenerating…" : "New subject"}
            </button>
          </div>
          <input
            type="text"
            value={editSubject}
            onChange={e => setEditSubject(e.target.value)}
            className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:outline-none focus:border-hebe-red transition-colors"
          />
          <p className={`text-[10px] ${editSubject.length > 60 ? "text-hebe-red" : "text-gray-400 dark:text-gray-600"}`}>
            {editSubject.length}/60 chars
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Email Preview
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-600">*|FNAME|* and *|UNSUB|* replaced at send time</p>
          </div>
          <iframe
            srcDoc={output.html}
            sandbox="allow-same-origin"
            className="w-full border-0"
            style={{ height: 560 }}
            title="Email preview"
          />
        </div>

        {error && <p className="text-xs text-hebe-red px-1">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleCreateDraft}
            disabled={stage === "creating"}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-hebe-red px-4 py-2.5 text-xs font-semibold text-white hover:bg-hebe-red-dark disabled:opacity-60 transition-colors"
          >
            {stage === "creating"
              ? <><Loader2 size={13} className="animate-spin" /> Creating draft…</>
              : "Create Mailchimp Draft"}
          </button>
          <button
            onClick={() => { setStage("idle"); setWizardStep(3); }}
            disabled={stage === "creating"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors disabled:opacity-60"
          >
            <RotateCcw size={12} /> Edit
          </button>
        </div>
      </div>
    );
  }

  // ── Generating ────────────────────────────────────────────────────────────
  if (stage === "generating") {
    return (
      <div className="card p-12 flex flex-col items-center gap-3">
        <Loader2 size={24} className="animate-spin text-hebe-red" />
        <p className="text-sm font-semibold text-gray-900 dark:text-white">Analysing your audience data…</p>
        <p className="text-xs text-gray-400 dark:text-gray-500">Reading campaign history, lifecycle stats and crafting your email</p>
      </div>
    );
  }

  // ── Idle — wizard ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Step indicator + save status */}
      <div className="flex items-center mb-6">
        <StepIndicator current={wizardStep} />
        {saveBadge}
      </div>

      {/* Step 1 — Objective */}
      {wizardStep === 1 && (
        <div className="space-y-4">
          <div className="card p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">What&apos;s the goal of this email?</p>
            <div className="flex flex-col gap-2">
              {OBJECTIVES.map(o => (
                <button
                  key={o.value}
                  onClick={() => setObjective(o.value)}
                  className={`rounded-lg px-4 py-3 text-left transition-colors border ${
                    objective === o.value
                      ? "bg-hebe-red border-hebe-red text-white"
                      : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className={`block text-[11px] mt-0.5 ${objective === o.value ? "text-white/70" : "text-gray-400 dark:text-gray-600"}`}>
                    {o.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => setWizardStep(2)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-hebe-red px-4 py-3 text-sm font-semibold text-white hover:bg-hebe-red-dark transition-colors"
          >
            Next: Add Events <ChevronRight size={15} />
          </button>
        </div>
      )}

      {/* Step 2 — Events */}
      {wizardStep === 2 && (
        <div className="space-y-3">
          {events.map((e, i) => (
            <EventCard
              key={i}
              event={e}
              index={i}
              onChange={ev => updateEvent(i, ev)}
              onRemove={() => removeEvent(i)}
              canRemove={events.length > 1}
              onGenerateCta={() => handleGenerateCta(i)}
              generatingCta={generatingCtaFor === i}
            />
          ))}
          {events.length < 6 && (
            <button
              onClick={addEvent}
              className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-hebe-red transition-colors px-1"
            >
              <Plus size={13} /> Add another event
            </button>
          )}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => setWizardStep(1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors"
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={() => setWizardStep(3)}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-hebe-red px-4 py-3 text-sm font-semibold text-white hover:bg-hebe-red-dark transition-colors"
            >
              Next: Notes <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Notes & Generate */}
      {wizardStep === 3 && (
        <div className="space-y-4">
          <div className="card p-4 space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Additional Notes
            </p>
            <textarea
              placeholder="Tone guidance, special announcements, sponsor mentions…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={4}
              className={inputCls}
            />
          </div>

          {error && <p className="text-xs text-hebe-red px-1">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => setWizardStep(2)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm text-gray-500 dark:text-gray-400 hover:border-gray-400 transition-colors"
            >
              <ChevronLeft size={15} /> Back
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-hebe-red px-4 py-3 text-sm font-semibold text-white hover:bg-hebe-red-dark transition-colors"
            >
              <Sparkles size={15} /> Analyse &amp; Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
