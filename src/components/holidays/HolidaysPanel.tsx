"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { HolidayRow } from "@/components/holidays/HolidayRow";
import { RepresentativeFilter } from "@/components/holidays/RepresentativeFilter";
import { cn } from "@/lib/utils";
import type { HolidayRequest } from "@/types/holiday";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export function HolidaysPanel({
  holidays: initialHolidays,
  reps,
}: {
  holidays: HolidayRequest[];
  reps: string[];
}) {
  const [holidays, setHolidays] = useState(initialHolidays);
  const [search, setSearch] = useState("");
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [showAll, setShowAll] = useState(true);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return holidays.filter((holiday) => {
      if (!showAll && holiday.status !== "pending") return false;
      if (selectedReps.length > 0 && !selectedReps.includes(holiday.repName)) return false;
      if (query) {
        const haystack = [holiday.repName, ...holiday.postcodes].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [holidays, search, selectedReps, showAll]);

  function updateStatus(id: string, status: "approved" | "rejected") {
    // Mock-data only — this doesn't persist past a page refresh.
    setHolidays((current) =>
      current.map((holiday) => (holiday.id === id ? { ...holiday, status } : holiday)),
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>

        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="search"
            placeholder="Search.."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>

        <RepresentativeFilter reps={reps} selected={selectedReps} onChange={setSelectedReps} />

        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <button
            type="button"
            role="switch"
            aria-checked={showAll}
            onClick={() => setShowAll((value) => !value)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              showAll ? "bg-brand-blue" : "bg-slate-200",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                showAll ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </button>
          All holidays
        </label>
      </div>

      <div className="hidden grid-cols-[1.5fr_1.3fr_1.6fr_1fr_1.2fr] gap-4 border-b border-slate-100 px-5 py-3 text-xs font-semibold tracking-wide text-slate-400 uppercase sm:grid">
        <span>User</span>
        <span>Postcodes</span>
        <span>Dates</span>
        <span>Status</span>
        <span className="text-right">Actions</span>
      </div>

      <Pagination
        rows={filtered.map((holiday) => (
          <HolidayRow
            key={holiday.id}
            holiday={holiday}
            onApprove={() => updateStatus(holiday.id, "approved")}
            onReject={() => updateStatus(holiday.id, "rejected")}
          />
        ))}
        pageSize={pageSize}
        emptyMessage="No holiday requests match your filters."
      />
    </Card>
  );
}
