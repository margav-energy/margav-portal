export interface OutcomeMissingLead {
  id: string;
  leadName: string;
  address: string;
  phone: string;
  representativeName: string;
  /** ISO datetime, e.g. "2026-08-12T14:30:00" */
  appointmentAt: string;
}
