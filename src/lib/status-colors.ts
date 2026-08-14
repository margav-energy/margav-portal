import type { InstallStatus } from "@/types/quote";
import type { ActivityStatus } from "@/types/activity";

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

export const PAYMENT_TYPE_LABELS: Record<string, string> = {
  cash: "Cash",
  finance: "Finance",
  card: "Card",
  bacs: "BACS",
};
