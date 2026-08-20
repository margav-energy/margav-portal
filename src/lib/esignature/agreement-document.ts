import "server-only";
import type { Quote } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";

/**
 * Locked-at-send-time snapshot for the fixed "Boiler Installation
 * Agreement" T&Cs document (assets/agreement-templates/boiler-installation-agreement.pdf)
 * — much smaller than `DocumentSnapshot` (see `document.ts`) since the
 * agreement's body text is fixed; only the signature block needs
 * per-customer data.
 */
export interface AgreementSnapshot {
  quoteId: string;
  reference: string;
  customerName: string;
  customerAddressLines: string[];
}

export function buildAgreementSnapshot(quote: Quote, detail: BoilerQuoteDetail): AgreementSnapshot {
  return {
    quoteId: quote.id,
    reference: detail.reference,
    customerName: detail.customer.name,
    customerAddressLines: detail.customer.addressLines,
  };
}
