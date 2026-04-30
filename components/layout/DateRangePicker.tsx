"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: "7 days",  days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const inputCls = `rounded-lg border border-hebe-ink/15 bg-white dark:bg-hebe-deep-2 dark:border-hebe-deep-3
  px-3 py-1.5 text-xs text-hebe-ink dark:text-hebe-cream
  focus:border-hebe-red dark:focus:border-hebe-red focus:outline-none transition-colors`;

export function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange(daysAgo(p.days - 1), today)}
          className="rounded-lg border border-hebe-ink/15 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2
                     px-3 py-1.5 text-xs text-hebe-ink/70 dark:text-hebe-champagne/70
                     hover:border-hebe-red dark:hover:border-hebe-red hover:text-hebe-red transition-colors"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-1">
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => onChange(e.target.value, end)}
          className={inputCls}
        />
        <span className="text-hebe-ink/30 dark:text-hebe-champagne/30 text-xs">→</span>
        <input
          type="date"
          value={end}
          min={start}
          max={today}
          onChange={(e) => onChange(start, e.target.value)}
          className={inputCls}
        />
      </div>
    </div>
  );
}
