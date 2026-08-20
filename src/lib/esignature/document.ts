import "server-only";
import { createHash } from "node:crypto";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumLineItems } from "@/data/quotes-mappers";
import type { Quote } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";
import type { SolarQuoteDetail } from "@/types/solar-quote";

/**
 * Replaces the old Dropbox Sign integration's merge-field builder (now
 * removed) — same source fields, but captured as structured data (not a
 * flat merge-field list) since this app now renders the document itself
 * (see `pdf.tsx`) instead of relying on a template built in a third-party
 * dashboard.
 *
 * This snapshot is what gets locked into `signature_requests.document_snapshot`
 * at send-time and rendered on `/sign/[token]` — never a live re-fetch of
 * the quote, so what the customer signs can't change underneath them.
 */
export interface DocumentSnapshot {
  quoteId: string;
  reference: string;
  productTypeLabel: string;
  customerName: string;
  customerAddressLines: string[];
  totalPriceLabel: string;
  paymentMethodLabel: string;
  lineItems: { name: string; amountLabel: string }[];
  sentDateLabel: string;
  generatedAt: string;
}

function productTypeLabel(productType: Quote["productType"]): string {
  return productType === "boiler" ? "Boiler" : "Solar PV";
}

function paymentMethodLabel(detail: BoilerQuoteDetail | SolarQuoteDetail): string {
  if (detail.selectedPaymentMethod === "monthly_plan") {
    const years = detail.monthlyPlanTermYears;
    return years ? `Monthly Plan (${years} years)` : "Monthly Plan";
  }
  return "BACS";
}

/**
 * `detail.pricingBreakdown` collapses every extra/standard-additional/
 * free-text line into one lump-sum row each (see `buildPricingBreakdown` in
 * `src/data/quotes-mappers.ts`) — fine for the quote detail page's sidebar,
 * but the signing document itemizes them individually so the customer sees
 * exactly what they're agreeing to. Only the "Boiler + install"/"Solar
 * array + install" row stays aggregated (that's a single package price,
 * not a list of separately-priced things).
 */
const AGGREGATED_SECTION_NAMES = new Set(["Extras", "Standard additionals", "Free-text extras"]);

function itemizedLineItems(detail: BoilerQuoteDetail | SolarQuoteDetail): { name: string; amountLabel: string }[] {
  const installLines = detail.pricingBreakdown
    .filter((item) => !AGGREGATED_SECTION_NAMES.has(item.name))
    .map((item) => ({ name: item.name, amountLabel: formatCurrency(item.quantity * item.unitPrice) }));

  const extraLines = detail.extras.map((item) => ({
    name: item.name,
    amountLabel: formatCurrency(item.quantity * item.unitPrice),
  }));
  const standardAdditionalLines = detail.standardAdditionals.map((item) => ({
    name: item.name,
    amountLabel: formatCurrency(item.quantity * item.unitPrice),
  }));
  const freeTextLines = detail.freeTextExtras.map((item) => ({
    name: item.description,
    amountLabel: formatCurrency(item.quantity * item.unitPrice),
  }));

  return [...installLines, ...extraLines, ...standardAdditionalLines, ...freeTextLines];
}

export function buildDocumentSnapshot(
  quote: Quote,
  detail: BoilerQuoteDetail | SolarQuoteDetail,
): DocumentSnapshot {
  // `quote.amount` is a separately-entered field that isn't kept in sync
  // with the line items below (it's set once at quote creation and not
  // recomputed as extras/additionals are added) — the real total is the
  // sum of exactly what's itemized here, same as `totalCostFor()` in
  // src/components/quotes/presenter/slides/PersonalizedSlides.tsx.
  const totalPrice = sumLineItems(detail.pricingBreakdown);

  return {
    quoteId: quote.id,
    reference: detail.reference,
    productTypeLabel: productTypeLabel(quote.productType),
    customerName: detail.customer.name,
    customerAddressLines: detail.customer.addressLines,
    totalPriceLabel: formatCurrency(totalPrice),
    paymentMethodLabel: paymentMethodLabel(detail),
    lineItems: itemizedLineItems(detail),
    sentDateLabel: formatDate(quote.sentDate),
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Deterministic JSON — object keys sorted at every nesting level, not just
 * the top one (a plain `JSON.stringify(obj, Object.keys(obj).sort())` only
 * allowlists top-level keys and would silently drop every key inside
 * `lineItems`) — so the same snapshot always hashes the same way.
 */
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${canonicalStringify(val)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/** Generic over any locked snapshot shape — also used for `AgreementSnapshot` (see `agreement-document.ts`). */
export function hashDocument(snapshot: object): string {
  return createHash("sha256").update(canonicalStringify(snapshot)).digest("hex");
}
