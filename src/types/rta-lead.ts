export interface RtaLead {
  id: string;
  leadName: string;
  phone: string;
  /** ISO datetime, e.g. "2026-08-14T10:00:00" */
  appointmentAt: string;
}
