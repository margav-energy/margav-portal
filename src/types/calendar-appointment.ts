export type AppointmentStage =
  | "allocated"
  | "booked"
  | "confirmed"
  | "not_pitched"
  | "pitch_and_miss"
  | "sold";

export type CalendarViewMode = "month" | "week" | "day";

export interface CalendarAppointment {
  id: string;
  customerName: string;
  /** A rep name, or "Unallocated" */
  repName: string;
  stage: AppointmentStage;
  /** ISO date, e.g. "2026-08-12" */
  date: string;
  /** 24h "HH:mm" */
  startTime: string;
  /** 24h "HH:mm" */
  endTime: string;
}
