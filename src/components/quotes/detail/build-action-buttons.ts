import type { HeaderActionButton } from "@/components/quotes/detail/ActionButtonGrid";

/**
 * Shared by `BoilerQuoteDetail.tsx` / `SolarQuoteDetail.tsx` — the two
 * verticals' action-button grids are identical except for one label
 * ("Warranty Registration" vs "STAX Portal") and which handler each button
 * calls, both supplied by the caller.
 */

export const PITCH_OUTCOME_OPTIONS = ["Sat - Sold", "Sat - No Sale", "No Show", "Rescheduled"];

/** Matches the query-param pattern used by `RecentlyCancelledTable.tsx`'s "Rebook" button.
 *  `appointmentId` (the quote's originating appointment, if any — see
 *  `BoilerQuoteDetail.appointmentId`) is passed as `rebookFrom` so the create-appointment
 *  page can prefill everything but the date/time from it, not just the name. */
export function rebookAppointmentHref(customerName: string, appointmentId?: string): string {
  const [firstName, ...rest] = customerName.split(" ");
  const params = new URLSearchParams({ firstName, lastName: rest.join(" ") });
  if (appointmentId) params.set("rebookFrom", appointmentId);
  return `/appointments/create?${params.toString()}`;
}

export function buildActionButtons(params: {
  quoteId: string;
  customerName: string;
  /** The quote's originating appointment, if any — see `rebookAppointmentHref`. */
  appointmentId?: string;
  secondaryPortalLabel: string;
  onSendQuote: () => void;
  onSecondaryPortalAction: () => void;
  onCancelApp: () => void;
  onSurvey: () => void;
  onSelectPitchOutcome: (outcome: string) => void;
  /** Boiler-only — the document itself (Boiler Installation Agreement) doesn't apply to solar. */
  onInstallationAgreement?: () => void;
  /** Boiler-only — same reasoning as `onInstallationAgreement` (the Cooling-Off Waiver is written for a boiler installation). */
  onCoolingOffWaiver?: () => void;
}): HeaderActionButton[] {
  return [
    { label: "Presenter", variant: "primary", href: `/quotes/${params.quoteId}/presenter` },
    { label: "View Quote", variant: "primary", href: `/quotes/${params.quoteId}/view`, target: "_blank" },
    { label: "Send Quote", variant: "primary", onClick: params.onSendQuote },
    { label: params.secondaryPortalLabel, variant: "primary", onClick: params.onSecondaryPortalAction },
    { label: "Cancel App", variant: "primary", onClick: params.onCancelApp },
    {
      label: "Pitch Outcome",
      variant: "primary",
      popoverOptions: PITCH_OUTCOME_OPTIONS,
      onSelectOption: params.onSelectPitchOutcome,
    },
    { label: "Rebook App", variant: "primary", href: rebookAppointmentHref(params.customerName, params.appointmentId) },
    { label: "Survey", variant: "primary", onClick: params.onSurvey },
    ...(params.onInstallationAgreement
      ? [{ label: "Installation Agreement", variant: "primary" as const, onClick: params.onInstallationAgreement }]
      : []),
    ...(params.onCoolingOffWaiver
      ? [{ label: "Cooling-Off Waiver", variant: "primary" as const, onClick: params.onCoolingOffWaiver }]
      : []),
    // No manual "Archive" button — quotes archive themselves automatically
    // after 5 years (see src/data/quotes-service.ts).
  ];
}
