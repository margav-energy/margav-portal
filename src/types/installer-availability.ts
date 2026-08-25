export type InstallerAvailabilityStatus = "available" | "unavailable";

/** Whether the assigned installer has confirmed the booking — set to
 *  'pending' the moment a job is assigned, cleared to null when unassigned.
 *  Separate from `install_status` (physical progress: scaffold, in
 *  progress, completed), see supabase/migrations/0018_*.sql. */
export type InstallAcceptanceStatus = "pending" | "accepted" | "rejected";

/** A signed job booked to an installer on a given day (see `quotes.installer_id`/`install_date`). */
export interface AssignedJobSummary {
  quoteId: string;
  customerName: string;
  productType: "solar" | "boiler";
  reference: string | null;
  postcode: string;
  acceptanceStatus: InstallAcceptanceStatus | null;
}

export interface InstallerAvailabilityDay {
  /** ISO date, e.g. "2026-08-24" */
  date: string;
  /** null means the installer hasn't entered anything for this date yet */
  status: InstallerAvailabilityStatus | null;
  note: string | null;
  /** The job booked for this installer on this day, if any — takes visual
   *  priority over `status` wherever both are shown (see InstallerAvailabilityGrid). */
  assignedJob: AssignedJobSummary | null;
}

/** One installer's availability across a date range — used both for the
 *  installer's own editable calendar and as one row of the admin grid. */
export interface InstallerAvailabilityRow {
  installerId: string;
  installerName: string;
  installerInitials: string;
  days: InstallerAvailabilityDay[];
}
