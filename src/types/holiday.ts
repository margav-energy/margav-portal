export type HolidayStatus = "pending" | "approved" | "rejected";

export interface HolidayRequest {
  id: string;
  repName: string;
  repInitials: string;
  /** Postcode areas this rep normally covers, affected while they're away */
  postcodes: string[];
  /** ISO date, e.g. "2026-08-18" */
  startDate: string;
  /** ISO date, e.g. "2026-08-22" */
  endDate: string;
  status: HolidayStatus;
}
