interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2.5">
        <span className="block h-4 w-0.5 rounded-full bg-hebe-red shrink-0" />
        <h2 className="text-sm font-bold tracking-tight text-gray-900 dark:text-white uppercase">
          {title}
        </h2>
      </div>
      {subtitle && (
        <p className="mt-1 ml-3.5 text-xs text-gray-400 dark:text-gray-500">{subtitle}</p>
      )}
    </div>
  );
}
