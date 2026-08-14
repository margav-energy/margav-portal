import { Search } from "lucide-react";

// Visual-only search input for v1 — no results wired up yet.
export function SearchBar() {
  return (
    <label className="hidden min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 sm:flex sm:max-w-xs">
      <Search className="h-4 w-4 shrink-0" />
      <input
        type="search"
        placeholder="Search"
        className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
      />
      <kbd className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
        Ctrl K
      </kbd>
    </label>
  );
}
