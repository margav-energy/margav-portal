import type { HeaderActionButton } from "@/components/quotes/detail/ActionButtonGrid";

/**
 * Shared by `BoilerQuoteDetail.tsx` / `SolarQuoteDetail.tsx` — the two
 * verticals' action-button grids are identical except for one label
 * ("Warranty Registration" vs "STAX Portal") and which handler each button
 * calls, both supplied by the caller.
 */

export const PITCH_OUTCOME_OPTIONS = ["Sat - Sold", "Sat - No Sale", "No Show", "Rescheduled"];

/** Matches the query-param pattern used by `RecentlyCancelledTable.tsx`'s "Rebook" button. */
export function rebookAppointmentHref(customerName: string): string {
  const [firstName, ...rest] = customerName.split(" ");
  const params = new URLSearchParams({ firstName, lastName: rest.join(" ") });
  return `/appointments/create?${params.toString()}`;
}

export function buildActionButtons(params: {
  quoteId: string;
  customerName: string;
  secondaryPortalLabel: string;
  onSendQuote: () => void;
  onSecondaryPortalAction: () => void;
  onCancelApp: () => void;
  onSurvey: () => void;
  onSelectPitchOutcome: (outcome: string) => void;
}): HeaderActionButton[] {
  return [
    { label: "Presenter", variant: "primary", href: `/quotes/${params.quoteId}/presenter` },
    // No replacement destination defined for this one yet.
    { label: "View Quote", variant: "primary" },
    { label: "Send Quote", variant: "primary", onClick: params.onSendQuote },
    { label: params.secondaryPortalLabel, variant: "primary", onClick: params.onSecondaryPortalAction },
    { label: "Cancel App", variant: "primary", onClick: params.onCancelApp },
    {
      label: "Pitch Outcome",
      variant: "primary",
      popoverOptions: PITCH_OUTCOME_OPTIONS,
      onSelectOption: params.onSelectPitchOutcome,
    },
    { label: "Rebook App", variant: "primary", href: rebookAppointmentHref(params.customerName) },
    { label: "Survey", variant: "primary", onClick: params.onSurvey },
    // No manual "Archive" button — quotes archive themselves automatically
    // after 5 years (see src/data/quotes-service.ts).
  ];
}
