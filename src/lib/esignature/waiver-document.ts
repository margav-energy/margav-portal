import "server-only";
import { formatDate } from "@/lib/format";
import type { Quote } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

/**
 * Locked-at-send-time snapshot for the fixed "Cooling-Off Waiver" T&Cs
 * document (assets/agreement-templates/cooling-off-waiver.pdf) — same idea
 * as `agreement-document.ts`'s `AgreementSnapshot`, just with a couple more
 * fields since the waiver's own "Details and Signatures" page asks for more
 * than a name/signature/date (see `waiver-pdf.tsx`).
 *
 * `contractDateLabel` is the date this waiver itself was sent — set once,
 * below, at `createWaiverSignatureRequest` time, and never editable
 * afterward (unlike `agreedInstallDate`).
 *
 * `agreedInstallDate` (ISO date, formatted at render time — see
 * `waiver-pdf.tsx`) starts out from whatever's currently on
 * `detail.installDate` (set via InstallerAssignmentCard) — but the customer
 * can change it on the signing page itself before signing (see
 * `SignForm.tsx`), since installer scheduling often isn't locked in yet by
 * the time this waiver goes out. Whatever's in that box when they submit is
 * what gets recorded on the final signed PDF; this snapshot's value is just
 * the starting point. Optional — left as "—" if nobody ever sets one.
 */
export interface WaiverSnapshot {
  quoteId: string;
  reference: string;
  customerName: string;
  installationAddress: string;
  contractDateLabel: string;
  /** ISO date, e.g. "2026-09-10". */
  agreedInstallDate?: string;
}

export function buildWaiverSnapshot(quote: Quote, detail: BoilerQuoteDetail): WaiverSnapshot {
  return {
    quoteId: quote.id,
    reference: detail.reference,
    customerName: detail.customer.name,
    installationAddress: quote.address,
    // "Contract date" on this document means the date the waiver was sent,
    // not when the main quote was signed — see the doc comment above.
    contractDateLabel: formatDate(new Date().toISOString().slice(0, 10)),
    agreedInstallDate: detail.installDate,
  };
}
