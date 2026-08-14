"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Star, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ActivityUserFilter({
  actors,
  selected,
  onSelect,
}: {
  actors: string[];
  selected: string | "all";
  onSelect: (value: string | "all") => void;
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

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
      >
        {selected === "all" ? "All Users" : selected}
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <div className="absolute right-0 z-10 mt-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              onSelect("all");
              setIsOpen(false);
            }}
            className={cn(
              "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50",
              selected === "all" ? "font-medium text-slate-900" : "text-slate-600",
            )}
          >
            <Star className="h-4 w-4 text-slate-400" />
            All
          </button>
          {actors.map((actor) => (
            <button
              key={actor}
              type="button"
              onClick={() => {
                onSelect(actor);
                setIsOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50",
                selected === actor ? "font-medium text-slate-900" : "text-slate-600",
              )}
            >
              <UserIcon className="h-4 w-4 text-slate-400" />
              {actor}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
