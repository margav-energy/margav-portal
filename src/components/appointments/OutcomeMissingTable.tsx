"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { PhoneLink } from "@/components/ui/PhoneLink";
import { OutcomePopover } from "@/components/appointments/OutcomePopover";
import { logOutcomeAction } from "@/components/appointments/actions";
import { formatTimeOnly, formatWeekdayOrdinal } from "@/lib/format";
import { isSameDay } from "@/lib/date-utils";
import { getInitials, cn } from "@/lib/utils";
import type { OutcomeMissingLead } from "@/types/outcome-missing";

type SortKey = "leadName" | "phone" | "appointmentAt";
type SortDirection = "asc" | "desc";
type DueBucket = "Overdue" | "Due Today" | "Due This Week" | "Later";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const GRID_COLS = "grid-cols-[2fr_1.2fr_1.3fr_0.8fr]";
const DUE_BUCKETS: DueBucket[] = ["Overdue", "Due Today", "Due This Week", "Later"];

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "leadName", label: "Lead" },
  { key: "phone", label: "Phone" },
  { key: "appointmentAt", label: "Appointment At" },
];

function getDueBucket(appointmentAt: string): DueBucket {
  const now = new Date();
  const appointmentDate = new Date(appointmentAt);
  if (isSameDay(appointmentDate, now)) return "Due Today";
  if (appointmentDate < now) return "Overdue";
  const daysAway = (appointmentDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysAway <= 7 ? "Due This Week" : "Later";
}

export function OutcomeMissingTable({
  leads: initialLeads,
  reps,
}: {
  leads: OutcomeMissingLead[];
  reps: string[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [selectedBuckets, setSelectedBuckets] = useState<string[]>([]);
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

  function handleLogOutcome(id: string, outcome: string) {
    // Optimistically drop the row — a logged outcome moves the appointment's
    // lifecycle_stage to "completed" so it won't match this view's query
    // again on the next real fetch either.
    setLeads((current) => current.filter((lead) => lead.id !== id));
    startTransition(async () => {
      await logOutcomeAction(id, outcome);
    });
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = leads.filter((lead) => {
      if (selectedReps.length > 0 && !selectedReps.includes(lead.representativeName)) return false;
      if (selectedBuckets.length > 0 && !selectedBuckets.includes(getDueBucket(lead.appointmentAt))) {
        return false;
      }
      if (query && !lead.leadName.toLowerCase().includes(query) && !lead.phone.toLowerCase().includes(query)) {
        return false;
      }
      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = a[sortKey].localeCompare(b[sortKey], undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [leads, search, selectedReps, selectedBuckets, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter label="Representative" options={reps} selected={selectedReps} onChange={setSelectedReps} />
        <MultiSelectFilter label="Status" options={DUE_BUCKETS} selected={selectedBuckets} onChange={setSelectedBuckets} />
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
          <span />
        </div>

        <Pagination
          rows={rows.map((lead) => (
            <div
              key={lead.id}
              className={cn(
                "flex flex-col gap-3 px-5 py-4 hover:bg-slate-50 sm:grid sm:items-center sm:gap-4",
                GRID_COLS,
              )}
            >
              <div className="flex items-center gap-3">
                <InitialsAvatar name={lead.leadName} initials={getInitials(lead.leadName)} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{lead.leadName}</p>
                  <p className="truncate text-sm text-slate-500">{lead.address}</p>
                </div>
              </div>
              <PhoneLink phone={lead.phone} />
              <div className="text-sm text-slate-600">
                <p>{formatWeekdayOrdinal(lead.appointmentAt)}</p>
                <p className="text-slate-500">{formatTimeOnly(lead.appointmentAt)}</p>
              </div>
              <div className="sm:justify-self-end">
                <OutcomePopover onSelect={(outcome) => handleLogOutcome(lead.id, outcome)} />
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
