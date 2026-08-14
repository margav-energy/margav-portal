export interface CancelledAppointment {
  id: string;
  customerName: string;
  address: string;
  /** A rep name, or "None" if it was never allocated */
  representativeName: string;
  /** ISO datetime, e.g. "2026-08-10T10:00:00" */
  appointmentAt: string;
  reason: string;
}
