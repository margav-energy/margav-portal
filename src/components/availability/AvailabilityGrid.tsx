"use client";

import { useState, useTransition } from "react";
import { formatDayHeader } from "@/lib/date-utils";
import { setAvailabilityDayAction } from "@/app/availability/actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import type { InstallerAvailabilityDay, InstallerAvailabilityStatus } from "@/types/installer-availability";

/** Parses a bare "YYYY-MM-DD" date as local midnight — avoids the UTC-shift
 *  `new Date(iso)` would give (same caution as src/lib/format.ts). */
function parseISODate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Editable day-by-day list for an installer to mark their own availability.
 * A list (not a month grid) fits full-day-only, single-person data entry
 * better than a calendar layout — the admin's side-by-side grid is the
 * comparison view, this is the input view.
 */
export function AvailabilityGrid({
  days,
  todayISO,
}: {
  days: InstallerAvailabilityDay[];
  todayISO: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, InstallerAvailabilityStatus | null>>(() =>
    Object.fromEntries(days.map((day) => [day.date, day.status])),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSet(date: string, status: InstallerAvailabilityStatus) {
    setError(null);
    setPendingDate(date);
    startTransition(async () => {
      const result = await setAvailabilityDayAction(date, status);
      if (result.error) {
        setError(result.error);
      } else {
        setStatuses((prev) => ({ ...prev, [date]: status }));
      }
      setPendingDate(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Card className="divide-y divide-slate-100">
        {days.map((day) => {
          const isPast = day.date < todayISO;
          const status = statuses[day.date];
          const busy = isPending && pendingDate === day.date;

          return (
            <div
              key={day.date}
              className={cn(
                "flex items-center justify-between gap-4 px-4 py-3",
                isPast && "opacity-50",
                day.date === todayISO && "bg-brand-blue/5",
              )}
            >
              <span className="text-sm font-medium text-slate-700">
                {formatDayHeader(parseISODate(day.date))}
                {day.date === todayISO && <span className="ml-2 text-xs font-normal text-brand-blue">Today</span>}
              </span>
              {day.assignedJob ? (
                <span className="rounded-md bg-brand-blue/10 px-3 py-1.5 text-xs font-semibold text-brand-blue">
                  Booked: {day.assignedJob.customerName} ({day.assignedJob.productType})
                </span>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant={status === "available" ? "success" : "secondary"}
                    disabled={isPast || busy}
                    onClick={() => handleSet(day.date, "available")}
                  >
                    Available
                  </Button>
                  <Button
                    variant={status === "unavailable" ? "danger" : "secondary"}
                    disabled={isPast || busy}
                    onClick={() => handleSet(day.date, "unavailable")}
                  >
                    Unavailable
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
