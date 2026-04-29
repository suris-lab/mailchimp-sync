"use client";

interface DateRangePickerProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: "Last 7 days",  days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function DateRangePicker({ start, end, onChange }: DateRangePickerProps) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <button
          key={p.days}
          onClick={() => onChange(daysAgo(p.days - 1), today)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 hover:border-blue-500 hover:text-white transition-colors"
        >
          {p.label}
        </button>
      ))}
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={start}
          max={end}
          onChange={(e) => onChange(e.target.value, end)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
        />
        <span className="text-gray-500 text-xs">→</span>
        <input
          type="date"
          value={end}
          min={start}
          max={today}
          onChange={(e) => onChange(start, e.target.value)}
          className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs text-gray-300 focus:border-blue-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
