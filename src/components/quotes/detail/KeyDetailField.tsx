export function KeyDetailField({
  label,
  value,
  valueClassName = "text-slate-900",
}: {
  label: string;
  value: React.ReactNode;
  /** Overrides the value's color — e.g. green for a Profit/Margin row. Defaults to the usual dark neutral. */
  valueClassName?: string;
}) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${valueClassName}`}>{value}</span>
    </div>
  );
}
