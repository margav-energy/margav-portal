import { Search } from "lucide-react";

export function TableSearchInput({
  value,
  onChange,
  placeholder = "Search..",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 sm:max-w-xs">
      <Search className="h-4 w-4 shrink-0" />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
      />
    </label>
  );
}
