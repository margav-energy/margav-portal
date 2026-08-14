export type ActivityStatus =
  | "allocated"
  | "unallocated"
  | "ready_to_confirm"
  | "outcome_missing"
  | "cancelled";

export interface Activity {
  id: string;
  actorName: string;
  /** Omitted for system-generated entries */
  actorInitials?: string;
  isSystem?: boolean;
  customerName: string;
  /** May contain \n for multi-line entries (e.g. a batch of property changes) */
  description: string;
  status: ActivityStatus;
  /** ISO datetime, e.g. "2026-08-14T09:12:00" */
  timestamp: string;
}
