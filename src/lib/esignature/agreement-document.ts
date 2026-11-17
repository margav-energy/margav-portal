import "server-only";
import { createHash } from "node:crypto";
import type { Quote } from "@/types/quote";
import { SOLAR_AGREEMENT_BLOCKS, SOLAR_AGREEMENT_PARTIES, SOLAR_AGREEMENT_TITLE } from "@/lib/esignature/solar-agreement-terms";
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
  /** Solar only: SHA-256 of the agreement wording the customer was sent (see `solarAgreementTermsHash`). It is covered by the document hash, and signing is refused if the wording has changed since. */
  termsHash?: string;
  reference: string;
  customerName: string;
  customerAddressLines: string[];
}

export function buildAgreementSnapshot(quote: Quote, detail: BoilerQuoteDetail | SolarQuoteDetail): AgreementSnapshot {
  return {
    quoteId: quote.id,
    product: quote.productType === "boiler" ? "boiler" : "solar",
    termsHash: quote.productType === "boiler" ? undefined : solarAgreementTermsHash(),
    reference: detail.reference,
    customerName: detail.customer.name,
    customerAddressLines: detail.customer.addressLines,
  };
}

/** A fingerprint of the solar agreement's wording — so what the customer signs is provably what they were sent. */
export function solarAgreementTermsHash(): string {
  return createHash("sha256")
    .update(JSON.stringify({ title: SOLAR_AGREEMENT_TITLE, parties: SOLAR_AGREEMENT_PARTIES, blocks: SOLAR_AGREEMENT_BLOCKS }))
    .digest("hex");
}
