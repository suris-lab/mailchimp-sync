"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ContentStudio } from "@/components/studio/ContentStudio";
import { DraftManager } from "@/components/studio/DraftManager";
import { useStudioDrafts } from "@/hooks/useStudioDrafts";
import type { StudioDraft } from "@/lib/types";

export default function StudioPage() {
  const { drafts, trash, isLoading, mutate } = useStudioDrafts();

  // Which draft is loaded in the editor. Changing studioKey fully resets ContentStudio.
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [loadedInput,   setLoadedInput]   = useState<StudioDraft["input"] | null>(null);
  const [studioKey,     setStudioKey]     = useState(0);

  function loadDraft(draft: StudioDraft) {
    setActiveDraftId(draft.id);
    setLoadedInput(draft.input);
    setStudioKey((k) => k + 1);
    // Scroll to editor
    document.getElementById("studio-editor")?.scrollIntoView({ behavior: "smooth" });
  }

  function startNew() {
    setActiveDraftId(null);
    setLoadedInput(null);
    setStudioKey((k) => k + 1);
  }

  function handleSaved(draft: StudioDraft) {
    setActiveDraftId(draft.id);
    mutate(); // refresh draft list
  }

  function handleDiscard() {
    setActiveDraftId(null);
    mutate();
  }

  return (
    <div className="min-h-full bg-hebe-cream dark:bg-gray-950">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6 py-3 sticky top-0 z-10">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-lg border border-gray-200 dark:border-gray-800 p-2
                         text-gray-400 dark:text-gray-500
                         hover:text-hebe-red dark:hover:text-hebe-red hover:border-hebe-red/30 transition-colors"
            >
              <ArrowLeft size={14} />
            </Link>
            <Image src="/logo.png" alt="HHYC" width={30} height={30} className="object-contain" />
            <div>
              <p className="text-sm font-bold text-gray-900 dark:text-white">Content Studio</p>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">AI-powered weekly EDM draft generation</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-8">
        {/* Context hint */}
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-hebe-red/20 bg-hebe-red/5 dark:bg-hebe-red/10 px-4 py-3">
          <Sparkles size={14} className="text-hebe-red mt-0.5 shrink-0" />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Describe this week&apos;s events and the AI will read your live audience data — open rates, lifecycle stages, member interests — to craft a personalised email draft, ready to send from Mailchimp.
          </p>
        </div>

        {/* Draft manager — collapsible, above the editor */}
        <DraftManager
          drafts={drafts}
          trash={trash}
          isLoading={isLoading}
          activeDraftId={activeDraftId}
          mutate={mutate}
          onLoad={loadDraft}
          onNew={startNew}
        />

        {/* Editor — key resets the component when a new draft is loaded */}
        <div id="studio-editor">
          <ContentStudio
            key={studioKey}
            initialDraftId={activeDraftId}
            initialInput={loadedInput}
            onSaved={handleSaved}
            onDiscard={handleDiscard}
          />
        </div>
      </main>

      <footer className="mt-12 border-t border-gray-200 dark:border-gray-800 py-5 px-4 text-center">
        <p className="text-[10px] text-gray-400 dark:text-gray-600 tracking-widest uppercase">
          Hebe Haven Yacht Club · Est. 1963 · Pak Sha Wan, Sai Kung
        </p>
      </footer>
    </div>
  );
}
