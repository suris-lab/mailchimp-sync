"use client";

import { ChevronDown, ChevronUp } from "lucide-react";

interface CollapsibleProps {
  isOpen: boolean;
  onToggle: () => void;
  summary?: string;
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  collapsible?: CollapsibleProps;
}

export function SectionHeader({ title, subtitle, collapsible }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="block h-4 w-0.5 rounded-full bg-hebe-red shrink-0" />
          <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white uppercase">
            {title}
          </h2>
        </div>
        {collapsible && (
          <button
            onClick={collapsible.onToggle}
            className="flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700
                       px-2.5 py-1.5 text-[11px] text-gray-400 dark:text-gray-500
                       hover:border-gray-400 dark:hover:border-gray-500 transition-colors shrink-0"
          >
            {collapsible.isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {collapsible.isOpen ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      {subtitle && (
        <p className="mt-1 pl-[13px] text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      )}
      {collapsible?.summary && !collapsible.isOpen && (
        <p className="mt-1 pl-[13px] text-xs text-gray-400 dark:text-gray-500">{collapsible.summary}</p>
      )}
    </div>
  );
}
