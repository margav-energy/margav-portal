export type AcceptanceStatus = "pending" | "overdue";

export interface AllocatedAppointment {
  id: string;
  customerName: string;
  status: AcceptanceStatus;
  representativeName: string;
  /** ISO datetime, e.g. "2026-08-16T10:00:00" */
  appointmentAt: string;
  response?: string;
}
