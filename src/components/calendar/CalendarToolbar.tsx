"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Clock, Menu, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CalendarViewMode } from "@/types/calendar-appointment";

const VIEW_MODES: { value: CalendarViewMode; label: string }[] = [
  { value: "month", label: "Month" },
  { value: "week", label: "Week" },
  { value: "day", label: "Day" },
];

export function CalendarToolbar({
  rangeLabel,
  onPrev,
  onNext,
  onToday,
  viewMode,
  onViewModeChange,
  search,
  onSearchChange,
  onToggleFilters,
  onSaveFavourite,
}: {
  rangeLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onToggleFilters: () => void;
  onSaveFavourite: (name: string) => void;
}) {
  const [isSavingFavourite, setIsSavingFavourite] = useState(false);
  const [favouriteName, setFavouriteName] = useState("");

  function submitFavourite(event: React.FormEvent) {
    event.preventDefault();
    if (!favouriteName.trim()) return;
    onSaveFavourite(favouriteName.trim());
    setFavouriteName("");
    setIsSavingFavourite(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <button
        type="button"
        onClick={onToggleFilters}
        aria-label="Toggle filters"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="min-w-[200px] px-1 text-center text-sm font-semibold text-brand-blue">
          {rangeLabel}
        </span>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next"
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-blue text-white hover:bg-brand-blue/90"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        aria-label="Jump to today"
        title="Jump to today"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
      >
        <Clock className="h-4 w-4" />
      </button>

      <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 sm:max-w-xs">
        <Search className="h-4 w-4 shrink-0" />
        <input
          type="search"
          placeholder="Search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
        />
      </label>

      <div className="ml-auto flex items-center gap-3">
        {isSavingFavourite ? (
          <form onSubmit={submitFavourite} className="flex items-center gap-2">
            <input
              autoFocus
              value={favouriteName}
              onChange={(event) => setFavouriteName(event.target.value)}
              placeholder="Name this view"
              className="w-40 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm outline-none focus:border-brand-blue"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-blue px-2.5 py-1.5 text-sm font-medium text-white hover:bg-brand-blue/90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setIsSavingFavourite(false)}
              className="text-sm text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsSavingFavourite(true)}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <Plus className="h-4 w-4" />
            Favourite
          </button>
        )}

        <div className="flex rounded-lg bg-slate-100 p-1">
          {VIEW_MODES.map((mode) => (
            <button
              key={mode.value}
              type="button"
              onClick={() => onViewModeChange(mode.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                viewMode === mode.value
                  ? "bg-brand-blue text-white"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
