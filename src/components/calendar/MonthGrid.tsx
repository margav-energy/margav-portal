import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import { getMonthGridDays, isSameDay, toISODate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "@/types/calendar-appointment";

const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_PER_DAY = 3;

export function MonthGrid({
  monthDate,
  appointments,
  onSelectDay,
}: {
  monthDate: Date;
  appointments: CalendarAppointment[];
  onSelectDay: (day: Date) => void;
}) {
  const days = getMonthGridDays(monthDate);
  const today = new Date();

  function appointmentsForDay(day: Date) {
    const iso = toISODate(day);
    return appointments.filter((appointment) => appointment.date === iso);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAY_SHORT.map((label) => (
          <div
            key={label}
            className="border-l border-slate-100 px-3 py-2 text-center text-xs font-semibold tracking-wide text-slate-400 uppercase first:border-l-0"
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayAppointments = appointmentsForDay(day);
          const isCurrentMonth = day.getMonth() === monthDate.getMonth();
          const visible = dayAppointments.slice(0, MAX_VISIBLE_PER_DAY);
          const hiddenCount = dayAppointments.length - visible.length;

          return (
            <button
              type="button"
              key={day.toISOString()}
              onClick={() => onSelectDay(day)}
              className={cn(
                "flex min-h-[110px] flex-col gap-1 border-t border-l border-slate-100 p-2 text-left first:border-l-0 hover:bg-slate-50",
                !isCurrentMonth && "bg-slate-50/60 text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                  isSameDay(day, today) ? "bg-brand-blue text-white" : "text-slate-600",
                )}
              >
                {day.getDate()}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((appointment) => (
                  <span
                    key={appointment.id}
                    className={cn(
                      "truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                      APPOINTMENT_STAGE_STYLES[appointment.stage].blockClassName,
                    )}
                  >
                    {appointment.customerName}
                  </span>
                ))}
                {hiddenCount > 0 && (
                  <span className="text-[11px] text-slate-400">+{hiddenCount} more</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
