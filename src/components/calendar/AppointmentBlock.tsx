import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import { CALENDAR_ROW_HEIGHT, CALENDAR_START_HOUR, timeStringToMinutes } from "@/lib/calendar-constants";
import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "@/types/calendar-appointment";

export function AppointmentBlock({ appointment }: { appointment: CalendarAppointment }) {
  const startMinutes = timeStringToMinutes(appointment.startTime) - CALENDAR_START_HOUR * 60;
  const endMinutes = timeStringToMinutes(appointment.endTime) - CALENDAR_START_HOUR * 60;
  const top = (startMinutes / 60) * CALENDAR_ROW_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * CALENDAR_ROW_HEIGHT, 30);
  const style = APPOINTMENT_STAGE_STYLES[appointment.stage];

  return (
    <div
      style={{ top, height }}
      title={`${appointment.customerName} — ${style.label}`}
      className={cn(
        "absolute right-1 left-1 z-10 cursor-default overflow-hidden rounded-md border px-2 py-1 text-xs leading-tight shadow-sm",
        style.blockClassName,
      )}
    >
      <p className="truncate font-semibold">{appointment.customerName}</p>
      <p className="truncate opacity-80">
        {appointment.startTime}–{appointment.endTime} · {appointment.repName}
      </p>
    </div>
  );
}
