import { calendarAppointments } from "@/data/calendar-appointments";
import type { CalendarAppointment } from "@/types/calendar-appointment";

export async function getAllCalendarAppointments(): Promise<CalendarAppointment[]> {
  return calendarAppointments;
}
