"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function RepresentativeFilter({
  reps,
  selected,
  onChange,
}: {
  reps: string[];
  selected: string[];
  onChange: (value: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allSelected = reps.length > 0 && selected.length === reps.length;

  function toggleRep(rep: string) {
    onChange(selected.includes(rep) ? selected.filter((r) => r !== rep) : [...selected, rep]);
  }

  const label = selected.length === 0 ? "Representative" : `${selected.length} selected`;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
      >
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="absolute left-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => onChange(allSelected ? [] : [...reps])}
              className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
            />
            Select all
          </label>
          <div className="my-1 border-t border-slate-100" />
          {reps.map((rep) => (
            <label
              key={rep}
              className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selected.includes(rep)}
                onChange={() => toggleRep(rep)}
                className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
              />
              {rep}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
