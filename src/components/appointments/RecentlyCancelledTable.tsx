"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { Button } from "@/components/ui/Button";
import { formatDateTime } from "@/lib/format";
import { getInitials, cn } from "@/lib/utils";
import type { CancelledAppointment } from "@/types/cancelled-appointment";

type SortKey = "customerName" | "representativeName" | "appointmentAt";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const GRID_COLS = "grid-cols-[1.8fr_1.1fr_1.2fr_1.5fr_0.8fr]";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "customerName", label: "Customer" },
  { key: "representativeName", label: "Representative" },
  { key: "appointmentAt", label: "Appointment" },
];

function rebookHref(appointment: CancelledAppointment): string {
  const [firstName, ...rest] = appointment.customerName.split(" ");
  const params = new URLSearchParams({
    firstName,
    lastName: rest.join(" "),
    rebookFrom: appointment.id,
  });
  return `/appointments/create?${params.toString()}`;
}

export function RecentlyCancelledTable({
  appointments,
  reps,
}: {
  appointments: CancelledAppointment[];
  reps: string[];
}) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>("appointmentAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

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

    const filtered = appointments.filter((appointment) => {
      if (selectedReps.length > 0 && !selectedReps.includes(appointment.representativeName)) return false;
      if (query && !appointment.customerName.toLowerCase().includes(query)) return false;
      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = a[sortKey].localeCompare(b[sortKey], undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [appointments, search, selectedReps, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter
          label="Representative"
          options={["None", ...reps]}
          selected={selectedReps}
          onChange={setSelectedReps}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            "hidden gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase sm:grid",
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
          <span>Reason</span>
          <span />
        </div>

        <Pagination
          rows={rows.map((appointment) => (
            <div
              key={appointment.id}
              className={cn(
                "flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 sm:grid sm:items-center sm:gap-4",
                GRID_COLS,
              )}
            >
              <div className="flex items-center gap-3">
                <InitialsAvatar name={appointment.customerName} initials={getInitials(appointment.customerName)} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{appointment.customerName}</p>
                  <p className="truncate text-sm text-slate-500">{appointment.address}</p>
                </div>
              </div>
              <p className="text-sm text-slate-600">{appointment.representativeName}</p>
              <p className="text-sm text-slate-600">{formatDateTime(appointment.appointmentAt)}</p>
              <p className="text-sm text-slate-600">{appointment.reason}</p>
              <div className="sm:justify-self-end">
                <Button href={rebookHref(appointment)} className="px-3 py-1.5 text-xs">
                  Rebook
                </Button>
              </div>
            </div>
          ))}
          pageSize={pageSize}
          emptyMessage="Nothing to show!"
        />
      </div>
    </div>
  );
}
