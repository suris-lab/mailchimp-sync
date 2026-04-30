interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "neutral" | "navy" | "brown";
  badge?: string;
  badgeVariant?: "success" | "partial" | "error" | "never" | "skipped";
}

const badgeStyles: Record<string, string> = {
  success: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700",
  partial: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 border border-gray-200 dark:border-gray-700",
  error:   "bg-hebe-red/10 text-hebe-red border border-hebe-red/30",
  never:   "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700",
  skipped: "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700",
};

export function KpiCard({ label, value, sub, accent = "neutral", badge, badgeVariant }: KpiCardProps) {
  const valueColor =
    accent === "red"    ? "text-hebe-red" :
    accent === "navy"   ? "text-hebe-navy dark:text-gray-300" :
    accent === "brown"  ? "text-hebe-brown dark:text-gray-300" :
                          "text-gray-900 dark:text-white";

  const bVariant = badgeVariant ?? (badge as keyof typeof badgeStyles);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueColor}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
      {badge && (
        <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeStyles[bVariant] ?? badgeStyles.never}`}>
          {badge}
        </span>
      )}
    </div>
  );
}
