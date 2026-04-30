interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5">
        <span className="block h-4 w-0.5 rounded-full bg-hebe-red shrink-0" />
        <h2 className="font-serif text-base font-semibold tracking-wide text-hebe-ink dark:text-hebe-cream">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="mt-1 ml-3.5 text-xs text-hebe-ink/50 dark:text-hebe-champagne/60">{subtitle}</p>
      )}
    </div>
  );
}
