"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { HolidayRow } from "@/components/holidays/HolidayRow";
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
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter
          label="Representative"
          options={reps}
          selected={selectedReps}
          onChange={setSelectedReps}
        />
        <ToggleSwitch checked={showAll} onChange={setShowAll} label="All holidays" />
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
