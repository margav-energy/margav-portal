import {
  CALENDAR_HOURS,
  CALENDAR_ROW_HEIGHT,
  CALENDAR_TIME_COL_WIDTH,
  formatHourLabel,
} from "@/lib/calendar-constants";
import { formatDayHeader, isSameDay, toISODate } from "@/lib/date-utils";
import { AppointmentBlock } from "@/components/calendar/AppointmentBlock";
import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "@/types/calendar-appointment";

const GRID_HEIGHT = CALENDAR_HOURS.length * CALENDAR_ROW_HEIGHT;
const DAY_MIN_WIDTH = 140;

/**
 * Renders either a full week (7 days) or a single day — same grid either way.
 *
 * One scroll container for the whole grid, filling whatever height the
 * calendar gives it: the day-header row is `sticky top-0` and the time
 * column `sticky left-0`, so scrolling down through the hours keeps the days
 * visible, and scrolling across the days (narrow screens) keeps the times
 * visible — header, times and columns always move together. (Previously
 * header and body each had their own horizontal scroller, which drifted out
 * of line, and the body's scrollbar sat below 21:00, off-screen.)
 */
export function WeekGrid({
  days,
  appointments,
  onSelectAppointment,
  repColorsByName,
}: {
  days: Date[];
  appointments: CalendarAppointment[];
  onSelectAppointment: (appointment: CalendarAppointment) => void;
  /** Rep full name → their manually-picked calendar colour, if any — see `repColorFor`. */
  repColorsByName: Record<string, string | undefined>;
}) {
  const today = new Date();

  function appointmentsForDay(day: Date) {
    const iso = toISODate(day);
    return appointments.filter((appointment) => appointment.date === iso);
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white">
      <div style={{ minWidth: CALENDAR_TIME_COL_WIDTH + days.length * DAY_MIN_WIDTH }}>
        <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-white">
          <div style={{ width: CALENDAR_TIME_COL_WIDTH }} className="sticky left-0 z-10 shrink-0 bg-white" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              style={{ minWidth: DAY_MIN_WIDTH }}
              className={cn(
                "flex-1 border-l border-slate-100 px-3 py-3 text-center text-sm font-medium",
                isSameDay(day, today) ? "bg-brand-blue/5 text-brand-blue" : "text-slate-700",
              )}
            >
              {formatDayHeader(day)}
            </div>
          ))}
        </div>

        <div className="flex">
          {/* z-[25]: above the appointment blocks (z-10) and today's now-line (z-20) as they scroll underneath it. */}
          <div style={{ width: CALENDAR_TIME_COL_WIDTH }} className="sticky left-0 z-[25] shrink-0 bg-white">
            {CALENDAR_HOURS.map((hour) => (
              <div key={hour} style={{ height: CALENDAR_ROW_HEIGHT }} className="relative">
                {/* The first label would be clipped by the header above it if nudged up like the rest. */}
                <span
                  className={cn(
                    "absolute top-0 right-2 text-xs text-slate-400",
                    hour !== CALENDAR_HOURS[0] && "-translate-y-1/2",
                  )}
                >
                  {formatHourLabel(hour)}
                </span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayAppointments = appointmentsForDay(day);
            const isToday = isSameDay(day, today);
            const nowOffset =
              isToday &&
              today.getHours() >= CALENDAR_HOURS[0] &&
              today.getHours() <= CALENDAR_HOURS[CALENDAR_HOURS.length - 1]
                ? ((today.getHours() - CALENDAR_HOURS[0]) * 60 + today.getMinutes()) *
                  (CALENDAR_ROW_HEIGHT / 60)
                : null;

            return (
              <div
                key={day.toISOString()}
                style={{ height: GRID_HEIGHT, minWidth: DAY_MIN_WIDTH }}
                className={cn("relative flex-1 border-l border-slate-100", isToday && "bg-brand-blue/[0.03]")}
              >
                {CALENDAR_HOURS.map((hour) => (
                  <div key={hour} style={{ height: CALENDAR_ROW_HEIGHT }} className="border-b border-slate-50" />
                ))}
                {dayAppointments.map((appointment) => (
                  <AppointmentBlock
                    key={appointment.id}
                    appointment={appointment}
                    onSelect={onSelectAppointment}
                    calendarColor={repColorsByName[appointment.repName]}
                  />
                ))}
                {nowOffset !== null && (
                  <div style={{ top: nowOffset }} className="absolute right-0 left-0 z-20 flex items-center">
                    <span className="-ml-1 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                    <span className="h-px flex-1 bg-brand-blue" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
