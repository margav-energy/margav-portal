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

/** Renders either a full week (7 days) or a single day — same grid either way. */
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
    <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex border-b border-slate-200">
        <div style={{ width: CALENDAR_TIME_COL_WIDTH }} className="shrink-0" />
        <div className="flex flex-1 overflow-x-auto">
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={cn(
                "min-w-[140px] flex-1 border-l border-slate-100 px-3 py-3 text-center text-sm font-medium",
                isSameDay(day, today) ? "bg-brand-blue/5 text-brand-blue" : "text-slate-700",
              )}
            >
              {formatDayHeader(day)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex overflow-y-auto">
        <div style={{ width: CALENDAR_TIME_COL_WIDTH }} className="shrink-0">
          {CALENDAR_HOURS.map((hour) => (
            <div key={hour} style={{ height: CALENDAR_ROW_HEIGHT }} className="relative">
              <span className="absolute top-0 right-2 -translate-y-1/2 text-xs text-slate-400">
                {formatHourLabel(hour)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-1 overflow-x-auto">
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
                style={{ height: GRID_HEIGHT }}
                className={cn(
                  "relative min-w-[140px] flex-1 border-l border-slate-100",
                  isToday && "bg-brand-blue/[0.03]",
                )}
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
