import "server-only";
import type { Quote } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";
import type { SolarQuoteDetail } from "@/types/solar-quote";

/**
 * Locked-at-send-time snapshot for the fixed "Boiler Installation
 * Agreement" T&Cs document (assets/agreement-templates/boiler-installation-agreement.pdf)
 * — much smaller than `DocumentSnapshot` (see `document.ts`) since the
 * agreement's body text is fixed; only the signature block needs
 * per-customer data.
 */
export interface AgreementSnapshot {
  quoteId: string;
  /** Which agreement this is — absent on agreements sent before solar had one, which are boiler. */
  product?: "boiler" | "solar";
  reference: string;
  customerName: string;
  customerAddressLines: string[];
}

export function buildAgreementSnapshot(quote: Quote, detail: BoilerQuoteDetail | SolarQuoteDetail): AgreementSnapshot {
  return {
    quoteId: quote.id,
    product: quote.productType === "boiler" ? "boiler" : "solar",
    reference: detail.reference,
    customerName: detail.customer.name,
    customerAddressLines: detail.customer.addressLines,
  };
}
