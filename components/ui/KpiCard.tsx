interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
  badge?: string;
}

const accentStyles: Record<string, { card: string; value: string; badge: string }> = {
  red:    { card: "border-hebe-red/30 bg-hebe-red/5 dark:border-hebe-red/25 dark:bg-hebe-red/10",       value: "text-hebe-red",      badge: "bg-hebe-red/10 text-hebe-red" },
  blue:   { card: "border-hebe-navy/30 bg-hebe-navy/5 dark:border-hebe-navy/40 dark:bg-hebe-navy/15",   value: "text-hebe-navy dark:text-hebe-champagne", badge: "bg-hebe-navy/10 dark:bg-hebe-deep-3 text-hebe-navy dark:text-hebe-champagne" },
  green:  { card: "border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-500/10",                      value: "text-emerald-600 dark:text-emerald-400", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  purple: { card: "border-violet-500/25 bg-violet-500/5 dark:bg-violet-500/10",                         value: "text-violet-600 dark:text-violet-400",   badge: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  amber:  { card: "border-amber-500/25 bg-amber-500/5 dark:bg-amber-500/10",                            value: "text-amber-600 dark:text-amber-400",     badge: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  pink:   { card: "border-rose-500/25 bg-rose-500/5 dark:bg-rose-500/10",                               value: "text-rose-600 dark:text-rose-400",       badge: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
  gold:   { card: "border-hebe-champagne/40 bg-hebe-champagne/10 dark:bg-hebe-champagne/10",            value: "text-hebe-ink dark:text-hebe-champagne", badge: "bg-hebe-champagne/20 text-hebe-ink dark:text-hebe-champagne" },
};

export function KpiCard({ label, value, sub, accent = "blue", badge }: KpiCardProps) {
  const s = accentStyles[accent] ?? accentStyles.blue;
  return (
    <div className={`rounded-xl border p-5 ${s.card}`}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-hebe-ink/50 dark:text-hebe-champagne/50">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold font-serif ${s.value}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-hebe-ink/40 dark:text-hebe-champagne/40">{sub}</p>}
      {badge && (
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${s.badge}`}>
          {badge}
        </span>
      )}
    </div>
  );
}
