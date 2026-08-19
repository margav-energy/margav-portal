"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { searchPortal, type SearchResult } from "@/components/layout/search-actions";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    setIsOpen(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const found = await searchPortal(value);
        setResults(found);
      });
    }, 250);
  }

  function handleSelect(result: SearchResult) {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    router.push(result.href);
  }

  return (
    <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-xs" ref={containerRef}>
      <label className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 focus-within:border-brand-blue focus-within:bg-white focus-within:ring-1 focus-within:ring-brand-blue">
        <Search className="h-4 w-4 shrink-0" />
        <input
          ref={inputRef}
          type="search"
          placeholder="Search quotes"
          value={query}
          onChange={(event) => handleChange(event.target.value)}
          onFocus={() => setIsOpen(true)}
          className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
        />
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400" />
        ) : (
          <kbd className="shrink-0 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
            Ctrl K
          </kbd>
        )}
      </label>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {results.length === 0 && !isPending && (
            <p className="px-3.5 py-3 text-sm text-slate-400">No quotes match &ldquo;{query}&rdquo;.</p>
          )}
          {results.map((result) => (
            <button
              key={result.id}
              type="button"
              onClick={() => handleSelect(result)}
              className="block w-full px-3.5 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="block font-medium text-slate-900">{result.title}</span>
              {result.subtitle && <span className="block text-xs text-slate-400">{result.subtitle}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
