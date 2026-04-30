"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: "7 d",  days: 7 },
  { label: "30 d", days: 30 },
  { label: "90 d", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const inputCls =
  "rounded-lg border border-hebe-ink/15 bg-white dark:bg-hebe-deep-2 dark:border-hebe-deep-3 " +
  "px-2.5 py-1.5 text-xs text-hebe-ink dark:text-hebe-cream w-full " +
  "focus:border-hebe-red dark:focus:border-hebe-red focus:outline-none transition-colors";

const presetCls =
  "rounded-lg border border-hebe-ink/15 dark:border-hebe-deep-3 bg-white dark:bg-hebe-deep-2 " +
  "px-2.5 py-1.5 text-xs text-hebe-ink/60 dark:text-hebe-champagne/60 " +
  "hover:border-hebe-red hover:text-hebe-red transition-colors";

export function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Preset buttons */}
      <div className="flex gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => onChange(daysAgo(p.days - 1), today)}
            className={presetCls}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => onChange(e.target.value, end)}
          className={inputCls}
        />
        <span className="shrink-0 text-hebe-ink/30 dark:text-hebe-champagne/30 text-xs">→</span>
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
