"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { getMonthGridDays, toISODate } from "@/lib/date-utils";
import { setAvailabilityDayAction } from "@/app/availability/actions";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import type { InstallerAvailabilityDay, InstallerAvailabilityStatus } from "@/types/installer-availability";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * Month-view calendar for an installer to mark their own availability —
 * replaces the old day-by-day list (same self-input purpose, but a
 * calendar reads at a glance and matches the admin grid/appointments
 * calendar's shape elsewhere in the app, see src/components/calendar/MonthGrid.tsx).
 *
 * Caller must remount this with a fresh `key` (e.g. the month string) when
 * `monthDate`/`days` change — the day-status state below is seeded once
 * from props on mount, same as the list view it replaced, and switching
 * months via a `<Link>` doesn't otherwise guarantee a remount.
 */
export function AvailabilityCalendar({
  monthDate,
  days,
  todayISO,
}: {
  monthDate: Date;
  days: InstallerAvailabilityDay[];
  todayISO: string;
}) {
  const [statuses, setStatuses] = useState<Record<string, InstallerAvailabilityStatus | null>>(() =>
    Object.fromEntries(days.map((day) => [day.date, day.status])),
  );
  const [assignedJobByDate] = useState(() => new Map(days.map((day) => [day.date, day.assignedJob])));
  const [error, setError] = useState<string | null>(null);
  const [pendingDate, setPendingDate] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const gridDays = getMonthGridDays(monthDate);

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

      <Card className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-slate-200">
            {WEEKDAY_SHORT.map((label) => (
              <div
                key={label}
                className="border-l border-slate-100 px-2 py-2 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase first:border-l-0"
              >
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map((day) => {
              const iso = toISODate(day);
              const isCurrentMonth = day.getMonth() === monthDate.getMonth();
              const isPast = iso < todayISO;
              const isToday = iso === todayISO;
              const assignedJob = assignedJobByDate.get(iso) ?? null;
              const status = statuses[iso] ?? null;
              const busy = isPending && pendingDate === iso;

              return (
                <div
                  key={iso}
                  className={cn(
                    "flex min-h-[96px] flex-col gap-1.5 border-t border-l border-slate-100 p-2 first:border-l-0",
                    !isCurrentMonth && "bg-slate-50/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday ? "bg-brand-blue text-white" : isCurrentMonth ? "text-slate-600" : "text-slate-300",
                    )}
                  >
                    {day.getDate()}
                  </span>

                  {assignedJob ? (
                    <div
                      title={`${assignedJob.customerName} (${assignedJob.productType})${assignedJob.postcode ? ` — ${assignedJob.postcode}` : ""}${assignedJob.reference ? ` — ${assignedJob.reference}` : ""}`}
                      className="truncate rounded-md bg-brand-blue/10 px-1.5 py-1 text-[11px] font-semibold text-brand-blue"
                    >
                      Booked: {assignedJob.customerName}
                    </div>
                  ) : (
                    isCurrentMonth && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          aria-label={`Mark ${iso} available`}
                          aria-pressed={status === "available"}
                          disabled={isPast || busy}
                          onClick={() => handleSet(iso, "available")}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded py-1 transition disabled:cursor-not-allowed disabled:opacity-40",
                            status === "available"
                              ? "bg-brand-green-mid text-white"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Mark ${iso} unavailable`}
                          aria-pressed={status === "unavailable"}
                          disabled={isPast || busy}
                          onClick={() => handleSet(iso, "unavailable")}
                          className={cn(
                            "flex flex-1 items-center justify-center rounded py-1 transition disabled:cursor-not-allowed disabled:opacity-40",
                            status === "unavailable"
                              ? "bg-red-600 text-white"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200",
                          )}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-green-mid" /> Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-red-600" /> Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-blue/40" /> Booked
        </span>
      </div>
    </div>
  );
}
