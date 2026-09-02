import { APPOINTMENT_STAGE_STYLES } from "@/lib/status-colors";
import { CALENDAR_ROW_HEIGHT, CALENDAR_START_HOUR, timeStringToMinutes } from "@/lib/calendar-constants";
import { repColorFor } from "@/lib/rep-colors";
import { cn } from "@/lib/utils";
import type { CalendarAppointment } from "@/types/calendar-appointment";

export function AppointmentBlock({
  appointment,
  onSelect,
  calendarColor,
}: {
  appointment: CalendarAppointment;
  onSelect: (appointment: CalendarAppointment) => void;
  /** The rep's manually-picked calendar colour, if any — see `repColorFor`. */
  calendarColor?: string;
}) {
  const startMinutes = timeStringToMinutes(appointment.startTime) - CALENDAR_START_HOUR * 60;
  const endMinutes = timeStringToMinutes(appointment.endTime) - CALENDAR_START_HOUR * 60;
  const top = (startMinutes / 60) * CALENDAR_ROW_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * CALENDAR_ROW_HEIGHT, 30);
  const style = APPOINTMENT_STAGE_STYLES[appointment.stage];
  const repColor = repColorFor(appointment.repName, calendarColor);

  return (
    <button
      type="button"
      onClick={() => onSelect(appointment)}
      style={{ top, height, ...(repColor ? repColor.blockStyle : {}) }}
      title={`${appointment.customerName} — ${style.label} · ${appointment.repName}`}
      className={cn(
        "absolute right-1 left-1 z-10 cursor-pointer overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight shadow-sm hover:brightness-95",
        // Unallocated (no rep) keeps the neutral dashed stage style — nothing to colour it by.
        !repColor && style.blockClassName,
      )}
    >
      <p className="truncate font-semibold">{appointment.customerName}</p>
      <p className="truncate opacity-80">
        {appointment.startTime}–{appointment.endTime} · {appointment.repName}
      </p>
    </button>
  );
}
