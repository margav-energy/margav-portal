import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getProfileById } from "@/data/profiles-service";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumLineItems } from "@/data/quotes-mappers";
import { HEADLINE_MONTHLY_PLAN_TERM_YEARS, monthlyRepayment } from "@/lib/finance";
import { addDays, parseISODate, toISODate } from "@/lib/date-utils";
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
 *
 * Fields added after the original shape (headline/monthlyPlans/rep/customer
 * contact) are optional — a snapshot locked before they existed won't have
 * them, and `QuoteDocumentPreview` has to render those older rows too.
 */
export interface DocumentSnapshot {
  quoteId: string;
  reference: string;
  productTypeLabel: string;
  /** e.g. "7.76kW Solar System" / "30kW Combi Boiler". */
  headlineLabel?: string;
  /** e.g. "with 2 battery units" / "Mains Gas · Horizontal Flue". */
  subheadlineLabel?: string;
  customerName: string;
  customerAddressLines: string[];
  customerEmail?: string;
  customerPhone?: string;
  /** Sum of `lineItems` before the discount below — "Subtotal incl. VAT"
   *  on the System Summary. */
  subtotalLabel?: string;
  /** Informational only — this business quotes VAT-inclusive prices, so
   *  it's never added on top of the subtotal. */
  vatLabel?: string;
  discountLabel?: string;
  /** Absent when there's no deposit for this quote. */
  depositLabel?: string;
  /** `subtotalLabel` minus the discount — the actual amount owed. */
  totalPriceLabel: string;
  paymentMethodLabel: string;
  lineItems: {
    name: string;
    amountLabel: string;
    /** Raw quantity/unit price/line total behind `amountLabel` — absent on
     *  a snapshot locked before these existed. Only the boiler quote
     *  template's dynamic pricing table (boiler-quote-pdf.ts) needs them,
     *  to lay out and sum a variable number of rows; `QuoteDocumentPreview`
     *  and the plain PDF renderer (pdf.tsx) still just show `amountLabel`. */
    quantity?: number;
    unitPriceLabel?: string;
    amount?: number;
  }[];
  /** A handful of representative terms, not the full list in
   *  `MONTHLY_PLAN_TERM_YEARS` — see `HEADLINE_MONTHLY_PLAN_TERM_YEARS`. */
  monthlyPlans?: { years: number; monthlyLabel: string }[];
  /** "Unassigned" when nobody's assigned — same as the quote header shows. */
  repName?: string;
  /** Absent when the rep has no email on `auth.users`, or on an old snapshot. */
  repEmail?: string;
  /** Absent when the rep hasn't set a phone number in Settings, or on an old snapshot. */
  repPhone?: string;
  sentDateLabel: string;
  /** `sentDateLabel` + `OFFER_VALIDITY_DAYS` — only used by the boiler
   *  quote template's cover page (see boiler-quote-pdf.ts); absent on a
   *  snapshot locked before this field existed. */
  offerValidUntilLabel?: string;
  generatedAt: string;
}

/** How long a quote is held open for, shown on the boiler quote template's
 *  cover page ("Offer valid until"). Not configurable per-quote today —
 *  just a fixed policy window from the day it's sent. */
const OFFER_VALIDITY_DAYS = 30;

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

/** "7.76kW Solar System" / "30kW Combi Boiler", plus a short subheadline —
 *  the headline on the document's hero panel. Boiler headlines come off the
 *  first unit (multi-unit boiler quotes are rare and this is just a
 *  headline, not a spec sheet — the itemized units still show further down). */
function headlineFor(
  quote: Quote,
  detail: BoilerQuoteDetail | SolarQuoteDetail,
): { headline?: string; subheadline?: string } {
  if (quote.productType === "boiler") {
    const unit = (detail as BoilerQuoteDetail).boilerUnits[0];
    if (!unit) return {};
    return {
      headline: `${unit.outputKw}kW ${unit.installType} Boiler`,
      subheadline: `${unit.fuelType} · ${unit.flueType} Flue`,
    };
  }

  const { systemSizeKw, batteries } = (detail as SolarQuoteDetail).keyDetails;
  return {
    headline: `${systemSizeKw}kW Solar System`,
    subheadline: batteries > 0 ? `with ${batteries} battery unit${batteries === 1 ? "" : "s"}` : undefined,
  };
}

function monthlyPlansFor(totalPrice: number): { years: number; monthlyLabel: string }[] {
  return HEADLINE_MONTHLY_PLAN_TERM_YEARS.map((years) => ({
    years,
    monthlyLabel: formatCurrency(monthlyRepayment(totalPrice, years)),
  }));
}

/**
 * `profiles` has no email column (see supabase/schema.sql) — the real
 * address lives on `auth.users`, which only the service-role client can
 * look up for a user other than the current session's own. Same pattern as
 * `emailNotification` in src/lib/notify.ts.
 */
async function repEmailFor(repId: string | undefined): Promise<string | undefined> {
  if (!repId) return undefined;
  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.getUserById(repId);
    if (error || !data?.user?.email) return undefined;
    return data.user.email;
  } catch (error) {
    console.error("repEmailFor failed", error);
    return undefined;
  }
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

function lineItemFrom(name: string, quantity: number, unitPrice: number): DocumentSnapshot["lineItems"][number] {
  return {
    name,
    quantity,
    unitPriceLabel: formatCurrency(unitPrice),
    amount: quantity * unitPrice,
    amountLabel: formatCurrency(quantity * unitPrice),
  };
}

function itemizedLineItems(detail: BoilerQuoteDetail | SolarQuoteDetail): DocumentSnapshot["lineItems"] {
  const installLines = detail.pricingBreakdown
    .filter((item) => !AGGREGATED_SECTION_NAMES.has(item.name))
    .map((item) => lineItemFrom(item.name, item.quantity, item.unitPrice));

  const extraLines = detail.extras.map((item) => lineItemFrom(item.name, item.quantity, item.unitPrice));
  const standardAdditionalLines = detail.standardAdditionals.map((item) =>
    lineItemFrom(item.name, item.quantity, item.unitPrice),
  );
  const freeTextLines = detail.freeTextExtras.map((item) => lineItemFrom(item.description, item.quantity, item.unitPrice));

  return [...installLines, ...extraLines, ...standardAdditionalLines, ...freeTextLines];
}

export async function buildDocumentSnapshot(
  quote: Quote,
  detail: BoilerQuoteDetail | SolarQuoteDetail,
): Promise<DocumentSnapshot> {
  // `quote.amount` is a separately-entered field that isn't kept in sync
  // with the line items below (it's set once at quote creation and not
  // recomputed as extras/additionals are added) — the real subtotal is the
  // sum of exactly what's itemized here, same as `totalCostFor()` in
  // src/components/quotes/presenter/slides/PersonalizedSlides.tsx. The
  // actual amount owed is that minus whatever discount's been entered
  // (see PricingAdjustmentsCard) — VAT is informational only, already
  // included in the subtotal, never added on top.
  const subtotal = sumLineItems(detail.pricingBreakdown);
  const total = subtotal - detail.discountAmount;
  const { headline, subheadline } = headlineFor(quote, detail);

  const [repEmail, repProfile] = await Promise.all([
    repEmailFor(detail.assignedRepId),
    getProfileById(detail.assignedRepId),
  ]);

  return {
    quoteId: quote.id,
    reference: detail.reference,
    productTypeLabel: productTypeLabel(quote.productType),
    headlineLabel: headline,
    subheadlineLabel: subheadline,
    customerName: detail.customer.name,
    customerAddressLines: detail.customer.addressLines,
    customerEmail: detail.customer.email || undefined,
    customerPhone: detail.customer.phone || undefined,
    subtotalLabel: formatCurrency(subtotal),
    vatLabel: formatCurrency(detail.vatAmount),
    discountLabel: detail.discountAmount > 0 ? formatCurrency(detail.discountAmount) : undefined,
    depositLabel: detail.depositAmount > 0 ? formatCurrency(detail.depositAmount) : undefined,
    totalPriceLabel: formatCurrency(total),
    paymentMethodLabel: paymentMethodLabel(detail),
    lineItems: itemizedLineItems(detail),
    monthlyPlans: monthlyPlansFor(total),
    repName: detail.assignedRep,
    repEmail,
    repPhone: repProfile?.phone,
    sentDateLabel: formatDate(quote.sentDate),
    offerValidUntilLabel: quote.sentDate
      ? formatDate(toISODate(addDays(parseISODate(quote.sentDate), OFFER_VALIDITY_DAYS)))
      : undefined,
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
