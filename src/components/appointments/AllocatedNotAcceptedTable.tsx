"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowUpDown } from "lucide-react";
import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";
import { TableSearchInput } from "@/components/ui/TableSearchInput";
import { MultiSelectFilter } from "@/components/ui/MultiSelectFilter";
import { ToggleSwitch } from "@/components/ui/ToggleSwitch";
import { AcceptanceStatusPill } from "@/components/ui/AcceptanceStatusPill";
import { Button } from "@/components/ui/Button";
import { acceptAppointmentAction, declineAppointmentAction } from "@/components/appointments/actions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AllocatedAppointment } from "@/types/allocated-appointment";

type SortKey = "customerName" | "representativeName" | "appointmentAt";
type SortDirection = "asc" | "desc";

const PAGE_SIZE_OPTIONS = [10, 25, 50];
const GRID_COLS = "grid-cols-[1.4fr_0.9fr_1.1fr_1.2fr_1.1fr_1.3fr]";

export function AllocatedNotAcceptedTable({
  appointments: initialAppointments,
  reps,
}: {
  appointments: AllocatedAppointment[];
  reps: string[];
}) {
  const [appointments, setAppointments] = useState(initialAppointments);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [selectedReps, setSelectedReps] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
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

  function handleAccept(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await acceptAppointmentAction(id);
      if (result.ok) {
        setAppointments((current) => current.filter((appointment) => appointment.id !== id));
      }
      setPendingId(null);
    });
  }

  function handleDecline(id: string) {
    setPendingId(id);
    startTransition(async () => {
      const result = await declineAppointmentAction(id);
      if (result.ok) {
        setAppointments((current) => current.filter((appointment) => appointment.id !== id));
      }
      setPendingId(null);
    });
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = appointments.filter((appointment) => {
      if (!showPast && appointment.status === "overdue") return false;
      if (selectedReps.length > 0 && !selectedReps.includes(appointment.representativeName)) return false;
      if (query && !appointment.customerName.toLowerCase().includes(query)) return false;
      return true;
    });

    if (!sortKey) return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = a[sortKey].localeCompare(b[sortKey], undefined, { numeric: true });
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [appointments, search, selectedReps, showPast, sortKey, sortDirection]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <PageSizeSelect value={pageSize} options={PAGE_SIZE_OPTIONS} onChange={setPageSize} />
        <TableSearchInput value={search} onChange={setSearch} />
        <MultiSelectFilter label="Representative" options={reps} selected={selectedReps} onChange={setSelectedReps} />
        <ToggleSwitch checked={showPast} onChange={setShowPast} label="Past appointments" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div
          className={cn(
            "grid gap-4 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase",
            GRID_COLS,
          )}
        >
          <button
            type="button"
            onClick={() => handleSort("customerName")}
            className="flex items-center gap-1.5 text-left hover:text-slate-700"
          >
            Customer
            <ArrowUpDown
              className={cn("h-3.5 w-3.5", sortKey === "customerName" ? "text-brand-blue" : "text-slate-300")}
            />
          </button>
          <span>Status</span>
          <button
            type="button"
            onClick={() => handleSort("representativeName")}
            className="flex items-center gap-1.5 text-left hover:text-slate-700"
          >
            Representative
            <ArrowUpDown
              className={cn("h-3.5 w-3.5", sortKey === "representativeName" ? "text-brand-blue" : "text-slate-300")}
            />
          </button>
          <button
            type="button"
            onClick={() => handleSort("appointmentAt")}
            className="flex items-center gap-1.5 text-left hover:text-slate-700"
          >
            Appointment
            <ArrowUpDown
              className={cn("h-3.5 w-3.5", sortKey === "appointmentAt" ? "text-brand-blue" : "text-slate-300")}
            />
          </button>
          <span>Response</span>
          <span>Actions</span>
        </div>

        <Pagination
          rows={rows.map((appointment) => (
            <div
              key={appointment.id}
              className={cn("grid items-center gap-4 px-5 py-4 hover:bg-slate-50", GRID_COLS)}
            >
              <p className="truncate text-sm font-semibold text-slate-900">{appointment.customerName}</p>
              <div>
                <AcceptanceStatusPill status={appointment.status} />
              </div>
              <p className="text-sm text-slate-600">{appointment.representativeName}</p>
              <p className="text-sm text-slate-600">{formatDateTime(appointment.appointmentAt)}</p>
              <p className="truncate text-sm text-slate-400">{appointment.response ?? "—"}</p>
              <div className="flex gap-2">
                <Button
                  variant="success"
                  className="px-3 py-1.5 text-xs"
                  disabled={isPending && pendingId === appointment.id}
                  onClick={() => handleAccept(appointment.id)}
                >
                  Accept
                </Button>
                <Button
                  variant="danger"
                  className="px-3 py-1.5 text-xs"
                  disabled={isPending && pendingId === appointment.id}
                  onClick={() => handleDecline(appointment.id)}
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
