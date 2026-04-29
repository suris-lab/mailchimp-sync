interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-gray-400">{subtitle}</p>}
    </div>
  );
}
