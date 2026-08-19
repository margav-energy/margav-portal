"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { inputClassName } from "@/components/ui/FormField";
import { allocateAppointmentAction } from "@/components/appointments/actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { RtaLead } from "@/types/rta-lead";
import type { RepProfile } from "@/data/profiles-service";

type SortKey = "leadName" | "phone" | "appointmentAt";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "leadName", label: "Lead" },
  { key: "phone", label: "Phone" },
  { key: "appointmentAt", label: "Appointment At" },
];

/**
 * Generic Lead / Phone / Appointment At table — shared by the RTA due and
 * Unallocated views, which only differ in the leads they're handed. When
 * `reps` is passed (the Unallocated page only — RTA due is a reminder-call
 * worklist, not an allocation queue) an extra "Allocate" column lets a rep
 * be assigned directly from the row.
 */
export function LeadTable({
  leads: initialLeads,
  emptyMessage = "Nothing to show!",
  reps,
}: {
  leads: RtaLead[];
  emptyMessage?: string;
  reps?: RepProfile[];
}) {
  const [leads, setLeads] = useState(initialLeads);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [sortKey, setSortKey] = useState<SortKey | null>("appointmentAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const gridCols = reps ? "grid-cols-[2fr_1fr_1.2fr_1.3fr]" : "grid-cols-[2fr_1fr_1.2fr]";

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

  function handleAllocate(id: string, repId: string) {
    if (!repId) return;
    const repName = reps?.find((rep) => rep.id === repId)?.fullName ?? "";
    setPendingId(id);
    startTransition(async () => {
      const result = await allocateAppointmentAction(id, repId, repName);
      if (result.ok) {
        setLeads((current) => current.filter((lead) => lead.id !== id));
      }
      setPendingId(null);
    });
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
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            "grid gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase",
            gridCols,
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
          {reps && <span>Allocate</span>}
        </div>

        <Pagination
          rows={rows.map((lead) => (
            <div key={lead.id} className={cn("grid items-center gap-4 px-5 py-4 hover:bg-slate-50", gridCols)}>
              <p className="truncate text-sm font-semibold text-slate-900">{lead.leadName}</p>
              <p className="text-sm text-slate-600">{lead.phone}</p>
              <p className="text-sm text-slate-600">{formatDateTime(lead.appointmentAt)}</p>
              {reps && (
                <select
                  className={cn(inputClassName, "text-sm")}
                  defaultValue=""
                  disabled={isPending && pendingId === lead.id}
                  onChange={(event) => handleAllocate(lead.id, event.target.value)}
                >
                  <option value="" disabled>
                    Allocate to…
                  </option>
                  {reps.map((rep) => (
                    <option key={rep.id} value={rep.id}>
                      {rep.fullName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
          pageSize={pageSize}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
