import type { InstallStatus, QuotePipelineStatus } from "@/types/quote";
import type { ActivityStatus } from "@/types/activity";
import type { HolidayStatus } from "@/types/holiday";
import type { AppointmentStage } from "@/types/calendar-appointment";
import type { ConfirmationStatus } from "@/types/ready-to-confirm";
import type { AcceptanceStatus } from "@/types/allocated-appointment";
import type { InstallAcceptanceStatus, InstallerAvailabilityStatus } from "@/types/installer-availability";

export const INSTALL_STATUS_STYLES: Record<
  InstallStatus,
  { label: string; className: string }
> = {
  awaiting_scaffold: {
    label: "Awaiting Scaffold",
    className: "bg-slate-100 text-slate-600",
  },
  scaffold_removal: {
    label: "Scaffold Removal",
    className: "bg-brand-blue/10 text-brand-blue",
  },
  install_in_progress: {
    label: "Install In Progress",
    className: "bg-amber-100 text-amber-700",
  },
  completed_install: {
    label: "Completed Install",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700",
  },
};

export const ACTIVITY_STATUS_STYLES: Record<
  ActivityStatus,
  { label: string; className: string }
> = {
  allocated: {
    label: "Allocated",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  unallocated: {
    label: "Unallocated",
    className: "bg-slate-100 text-slate-600",
  },
  ready_to_confirm: {
    label: "Ready to Confirm",
    className: "bg-brand-blue/10 text-brand-blue",
  },
  outcome_missing: {
    label: "Outcome Missing",
    className: "bg-amber-100 text-amber-700",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700",
  },
};

export const HOLIDAY_STATUS_STYLES: Record<
  HolidayStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700",
  },
  approved: {
    label: "Approved",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-700",
  },
};

// "unset" covers a date with no row yet — distinct from an explicit
// "unavailable" so the admin grid and the installer's own list can tell
// "hasn't answered" apart from "answered no" at a glance.
export const INSTALLER_AVAILABILITY_STATUS_STYLES: Record<
  InstallerAvailabilityStatus | "unset",
  { label: string; className: string }
> = {
  available: {
    label: "Available",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  unavailable: {
    label: "Unavailable",
    className: "bg-red-100 text-red-700",
  },
  unset: {
    label: "Not entered",
    className: "bg-slate-100 text-slate-400",
  },
};

export const INSTALL_ACCEPTANCE_STATUS_STYLES: Record<
  InstallAcceptanceStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Awaiting response",
    className: "bg-amber-100 text-amber-700",
  },
  accepted: {
    label: "Accepted",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  rejected: {
    label: "Declined",
    className: "bg-red-100 text-red-700",
  },
};

export const APPOINTMENT_STAGE_STYLES: Record<
  AppointmentStage,
  { label: string; blockClassName: string }
> = {
  // Distinct from "allocated" below — this is "nobody assigned yet", styled
  // deliberately muted/dashed so it reads as "not actioned" at a glance
  // rather than looking the same as an appointment a rep has already been
  // put on (which previously both showed as "Allocated").
  unallocated: {
    label: "Unallocated",
    blockClassName: "bg-white text-slate-500 border-slate-300 border-dashed",
  },
  allocated: {
    label: "Allocated",
    blockClassName: "bg-slate-100 text-slate-700 border-slate-300",
  },
  booked: {
    label: "Booked",
    blockClassName: "bg-brand-blue/10 text-brand-blue border-brand-blue/30",
  },
  confirmed: {
    label: "Confirmed",
    blockClassName: "bg-brand-green-mid/10 text-brand-green-mid border-brand-green-mid/30",
  },
  not_pitched: {
    label: "Not Pitched",
    blockClassName: "bg-amber-100 text-amber-700 border-amber-300",
  },
  pitch_and_miss: {
    label: "Pitch & Miss",
    blockClassName: "bg-red-100 text-red-700 border-red-300",
  },
  sold: {
    label: "Sold",
    blockClassName: "bg-brand-green-end/10 text-emerald-700 border-brand-green-end/30",
  },
};

export const CONFIRMATION_STATUS_STYLES: Record<
  ConfirmationStatus,
  { label: string; className: string }
> = {
  awaiting: {
    label: "Awaiting",
    className: "bg-amber-100 text-amber-700",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
  declined: {
    label: "Declined",
    className: "bg-red-100 text-red-700",
  },
};

export const ACCEPTANCE_STATUS_STYLES: Record<
  AcceptanceStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "Pending",
    className: "bg-amber-100 text-amber-700",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700",
  },
};

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  finance: "Finance",
  card: "Card",
  bacs: "BACS",
};

export const PRODUCT_TYPE_LABELS: Record<"solar" | "boiler", string> = {
  solar: "Solar",
  boiler: "Boiler",
};

export const QUOTE_PIPELINE_STATUS_STYLES: Record<
  QuotePipelineStatus,
  { label: string; className: string }
> = {
  new_lead: {
    label: "New Lead",
    className: "bg-sky-100 text-sky-700",
  },
  ready_to_pitch: {
    label: "Ready to Pitch",
    className: "bg-brand-blue/10 text-brand-blue",
  },
  locked: {
    label: "Locked",
    className: "bg-slate-100 text-slate-600",
  },
  complete: {
    label: "Complete",
    className: "bg-brand-green-mid/10 text-brand-green-mid",
  },
};

/** Every stage a lead moves through, in order — drives the dropdown on
 *  `QuoteStatusPill` (only admins can change it) and anywhere else the
 *  full ordered list is useful (e.g. a "next stage" shortcut). */
export const QUOTE_PIPELINE_STATUS_ORDER: QuotePipelineStatus[] = ["new_lead", "ready_to_pitch", "locked", "complete"];
