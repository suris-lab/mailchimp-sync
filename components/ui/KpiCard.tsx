interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  badge?: string;
}

export function KpiCard({ label, value, sub, accent = "blue", badge }: KpiCardProps) {
  const accentMap: Record<string, string> = {
    blue:   "border-blue-500/30 bg-blue-500/5",
    green:  "border-emerald-500/30 bg-emerald-500/5",
    purple: "border-purple-500/30 bg-purple-500/5",
    amber:  "border-amber-500/30 bg-amber-500/5",
    pink:   "border-pink-500/30 bg-pink-500/5",
    teal:   "border-teal-500/30 bg-teal-500/5",
  };
  const valueMap: Record<string, string> = {
    blue:   "text-blue-400",
    green:  "text-emerald-400",
    purple: "text-purple-400",
    amber:  "text-amber-400",
    pink:   "text-pink-400",
    teal:   "text-teal-400",
  };

  return (
    <div className={`rounded-xl border p-5 ${accentMap[accent] ?? accentMap.blue}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-gray-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueMap[accent] ?? valueMap.blue}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
      {badge && (
        <span className="mt-2 inline-block rounded-full bg-gray-800 px-2 py-0.5 text-[10px] text-gray-400">
          {badge}
        </span>
      )}
    </div>
  );
}
