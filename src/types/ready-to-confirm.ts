export type ConfirmationStatus = "awaiting" | "confirmed" | "declined";

export interface ReadyToConfirmLead {
  id: string;
  leadName: string;
  phone: string;
  /** ISO datetime, e.g. "2026-08-16T10:00:00" */
  appointmentAt: string;
  occupancy: string;
  confirmation: ConfirmationStatus;
}
