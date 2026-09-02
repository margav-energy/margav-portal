export interface FilterOption {
  value: string;
  label: string;
  /** Hex colour for a small swatch dot (e.g. a rep's calendar colour) — omit for no swatch. */
  dotColor?: string;
}

export function CalendarFilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const allSelected = options.length > 0 && selected.length === options.length;

  function toggleAll() {
    onChange(allSelected ? [] : options.map((option) => option.value));
  }

  function toggleOne(value: string) {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value],
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={allSelected}
          onChange={toggleAll}
          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
        />
        Select all
      </label>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
        >
          <input
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={() => toggleOne(option.value)}
            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
          />
          {option.dotColor && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.dotColor }} />
          )}
          {option.label}
        </label>
      ))}
    </div>
  );
}
