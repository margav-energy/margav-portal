"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, Search } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RtaLead } from "@/types/rta-lead";

type SortKey = "leadName" | "phone" | "appointmentAt";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "leadName", label: "Lead" },
  { key: "phone", label: "Phone" },
  { key: "appointmentAt", label: "Appointment At" },
];

const GRID_COLS = "grid-cols-[2fr_1fr_1.2fr]";

export function RtaDueTable({ leads }: { leads: RtaLead[] }) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sortKey, setSortKey] = useState<SortKey | null>("appointmentAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  function handleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortKey(null);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = leads.filter(
      (lead) =>
        !query ||
        lead.leadName.toLowerCase().includes(query) ||
        lead.phone.toLowerCase().includes(query),
    );

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = a[sortKey].localeCompare(b[sortKey], undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [leads, search, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 sm:max-w-xs">
          <Search className="h-4 w-4 shrink-0" />
          <input
            type="search"
            placeholder="Search.."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-slate-700 outline-none placeholder:text-slate-400"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            "grid gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase",
            GRID_COLS,
          )}
        >
          {COLUMNS.map((column) => (
            <button
              key={column.key}
              type="button"
              onClick={() => handleSort(column.key)}
              className="flex items-center gap-1.5 text-left hover:text-slate-700"
            >
              {column.label}
              <ArrowUpDown
                className={cn(
                  "h-3.5 w-3.5",
                  sortKey === column.key ? "text-brand-blue" : "text-slate-300",
                )}
              />
            </button>
          ))}
        </div>

        <Pagination
          rows={rows.map((lead) => (
            <div key={lead.id} className={cn("grid gap-4 px-5 py-4 hover:bg-slate-50", GRID_COLS)}>
              <p className="truncate text-sm font-semibold text-slate-900">{lead.leadName}</p>
              <p className="text-sm text-slate-600">{lead.phone}</p>
              <p className="text-sm text-slate-600">{formatDateTime(lead.appointmentAt)}</p>
            </div>
          ))}
          pageSize={pageSize}
          emptyMessage="Nothing to show!"
        />
      </div>
    </div>
  );
}
