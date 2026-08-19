"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { ConfirmationStatusPill } from "@/components/ui/ConfirmationStatusPill";
import { Button } from "@/components/ui/Button";
import { confirmAppointmentAction, declineConfirmationAction } from "@/components/appointments/actions";
import { CONFIRMATION_STATUS_STYLES } from "@/lib/status-colors";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ConfirmationStatus, ReadyToConfirmLead } from "@/types/ready-to-confirm";

type SortKey = "leadName" | "phone" | "appointmentAt";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const GRID_COLS = "grid-cols-[1.4fr_0.9fr_1.1fr_0.9fr_0.9fr_1.2fr]";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "leadName", label: "Lead" },
  { key: "phone", label: "Phone" },
  { key: "appointmentAt", label: "Appointment At" },
];

const STATUS_LABELS = Object.values(CONFIRMATION_STATUS_STYLES).map((s) => s.label);
const STATUS_BY_LABEL = Object.fromEntries(
  (Object.entries(CONFIRMATION_STATUS_STYLES) as [ConfirmationStatus, { label: string }][]).map(
    ([key, value]) => [value.label, key],
  ),
);

export function ReadyToConfirmTable({ leads: initialLeads }: { leads: ReadyToConfirmLead[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedStatusLabels, setSelectedStatusLabels] = useState<string[]>([]);
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

  function handleConfirm(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await confirmAppointmentAction(id);
      if (result.ok) {
        setLeads((current) => current.filter((lead) => lead.id !== id));
      }
      setPendingId(null);
    });
  }

  function handleDecline(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await declineConfirmationAction(id);
      if (result.ok) {
        setLeads((current) => current.filter((lead) => lead.id !== id));
      }
      setPendingId(null);
    });
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const selectedStatuses = selectedStatusLabels.map((label) => STATUS_BY_LABEL[label]);

    const filtered = leads.filter((lead) => {
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(lead.confirmation)) return false;
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
  }, [leads, search, selectedStatusLabels, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter
          label="Status"
          options={STATUS_LABELS}
          selected={selectedStatusLabels}
          onChange={setSelectedStatusLabels}
        />
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
          <span>Occupancy</span>
          <span>Confirmation</span>
          <span>Actions</span>
        </div>

        <Pagination
          rows={rows.map((lead) => (
            <div key={lead.id} className={cn("grid items-center gap-4 px-5 py-4 hover:bg-slate-50", GRID_COLS)}>
              <p className="truncate text-sm font-semibold text-slate-900">{lead.leadName}</p>
              <p className="text-sm text-slate-600">{lead.phone}</p>
              <p className="text-sm text-slate-600">{formatDateTime(lead.appointmentAt)}</p>
              <p className="text-sm text-slate-600">{lead.occupancy}</p>
              <div>
                <ConfirmationStatusPill status={lead.confirmation} />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  className="px-3 py-1.5 text-xs"
                  disabled={isPending && pendingId === lead.id}
                  onClick={() => handleConfirm(lead.id)}
                >
                  Confirm
                </Button>
                <Button
                  variant="danger"
                  className="px-3 py-1.5 text-xs"
                  disabled={isPending && pendingId === lead.id}
                  onClick={() => handleDecline(lead.id)}
                >
                  Decline
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
