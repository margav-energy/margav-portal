"use client";

import { useState } from "react";
import { formatDayHeader } from "@/lib/date-utils";
import { Card } from "@/components/ui/Card";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { INSTALLER_AVAILABILITY_STATUS_STYLES } from "@/lib/status-colors";
import { cn } from "@/lib/utils";
import { AssignJobModal } from "@/components/availability/AssignJobModal";
import { UnassignJobModal } from "@/components/availability/UnassignJobModal";
import type { InstallerAvailabilityDay, InstallerAvailabilityRow } from "@/types/installer-availability";
import type { UnassignedInstallJob } from "@/types/quote";

const COMPACT_LABEL: Record<"available" | "unavailable" | "unset", string> = {
  available: "Avail",
  unavailable: "Off",
  unset: "—",
};

const BOOKED_CLASS = "bg-brand-blue/10 text-brand-blue";
const CELL_WIDTH = 84;
const FIRST_COL_WIDTH = 220;

/** Parses a bare "YYYY-MM-DD" date as local midnight — avoids the UTC-shift
 *  `new Date(iso)` would give (same caution as src/lib/format.ts). */
function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function cellFor(day: InstallerAvailabilityDay) {
  if (day.assignedJob) {
    return { label: day.assignedJob.customerName, className: BOOKED_CLASS, kind: "booked" as const };
  }
  const status = day.status ?? "unset";
  const { className } = INSTALLER_AVAILABILITY_STATUS_STYLES[status];
  return { label: COMPACT_LABEL[status], className, kind: status === "available" ? ("assign" as const) : ("inert" as const) };
}

interface AssignTarget {
  installerId: string;
  installerName: string;
  date: string;
}

interface UnassignTarget {
  quoteId: string;
  installerName: string;
  customerName: string;
  date: string;
}

/**
 * Read-plus-assign reference grid for admins doing manual job scheduling —
 * installers as rows, dates as columns. An "available" cell opens
 * AssignJobModal; a "booked" cell (a job already scheduled that day) opens
 * UnassignJobModal. Unavailable/not-entered cells are inert — v1 only
 * offers assignment on days the installer actually said they're free.
 */
export function InstallerAvailabilityGrid({
  rows,
  dateHeaders,
  unassignedJobs,
}: {
  rows: InstallerAvailabilityRow[];
  dateHeaders: string[];
  unassignedJobs: UnassignedInstallJob[];
}) {
  const [assignTarget, setAssignTarget] = useState<AssignTarget | null>(null);
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null);

  if (rows.length === 0) {
    return (
      <Card className="p-6 text-sm text-slate-500">
        No installer accounts yet — availability will show here once installers start filling theirs in.
      </Card>
    );
  }

  const gridTemplateColumns = `${FIRST_COL_WIDTH}px repeat(${dateHeaders.length}, ${CELL_WIDTH}px)`;

  return (
    <>
      <Card className="overflow-x-auto">
        <div style={{ minWidth: FIRST_COL_WIDTH + dateHeaders.length * CELL_WIDTH }}>
          {/* Header row */}
          <div className="grid border-b border-slate-200" style={{ gridTemplateColumns }}>
            <div className="sticky left-0 z-10 flex h-14 items-center bg-white px-4 text-xs font-semibold tracking-wide text-slate-400 uppercase">
              Installer
            </div>
            {dateHeaders.map((date) => (
              <div key={date} className="flex h-14 flex-col items-center justify-center gap-0.5 border-l border-slate-50">
                <span className="text-[11px] font-semibold text-slate-400">
                  {formatDayHeader(parseISODate(date)).slice(0, 3)}
                </span>
                <span className="text-sm font-semibold text-slate-700">{parseISODate(date).getDate()}</span>
              </div>
            ))}
          </div>

          {/* Installer rows */}
          {rows.map((row) => (
            <div key={row.installerId} className="grid border-b border-slate-100 last:border-0" style={{ gridTemplateColumns }}>
              <div className="sticky left-0 z-10 flex h-[60px] items-center gap-2.5 border-r border-slate-100 bg-white px-4">
                <InitialsAvatar name={row.installerName} initials={row.installerInitials} className="h-8 w-8 text-xs" />
                <span className="truncate text-sm font-medium text-slate-900">{row.installerName}</span>
              </div>
              {row.days.map((day) => {
                const cell = cellFor(day);
                const commonClassName = cn(
                  "flex h-[60px] w-full items-center justify-center px-1.5 py-1",
                );
                const chipClassName = cn(
                  "flex h-8 w-full items-center justify-center truncate rounded-md text-[11px] font-semibold",
                  cell.className,
                  cell.kind !== "inert" && "cursor-pointer transition hover:brightness-95",
                );

                if (cell.kind === "assign") {
                  return (
                    <div key={day.date} className={commonClassName}>
                      <button
                        type="button"
                        title={`Assign a job to ${row.installerName} on ${day.date}`}
                        className={chipClassName}
                        onClick={() => setAssignTarget({ installerId: row.installerId, installerName: row.installerName, date: day.date })}
                      >
                        {cell.label}
                      </button>
                    </div>
                  );
                }

                if (cell.kind === "booked" && day.assignedJob) {
                  return (
                    <div key={day.date} className={commonClassName}>
                      <button
                        type="button"
                        title={`${day.assignedJob.customerName} — click to unassign`}
                        className={chipClassName}
                        onClick={() =>
                          setUnassignTarget({
                            quoteId: day.assignedJob!.quoteId,
                            installerName: row.installerName,
                            customerName: day.assignedJob!.customerName,
                            date: day.date,
                          })
                        }
                      >
                        {cell.label}
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={day.date} className={commonClassName}>
                    <div className={chipClassName}>{cell.label}</div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {assignTarget && (
        <AssignJobModal
          installerId={assignTarget.installerId}
          installerName={assignTarget.installerName}
          date={assignTarget.date}
          jobs={unassignedJobs}
          onClose={() => setAssignTarget(null)}
        />
      )}

      {unassignTarget && (
        <UnassignJobModal
          quoteId={unassignTarget.quoteId}
          installerName={unassignTarget.installerName}
          customerName={unassignTarget.customerName}
          date={unassignTarget.date}
          onClose={() => setUnassignTarget(null)}
        />
      )}
    </>
  );
}
