import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getProfileById } from "@/data/profiles-service";
import { formatCurrency, formatDate } from "@/lib/format";
import { sumLineItems } from "@/data/quotes-mappers";
import { financedAmount, monthlyRepayment } from "@/lib/finance";
import { findCatalogEntry } from "@/lib/extras-catalog";
import { computeSapTable, paybackYears } from "@/lib/solar-sap";
import { hasEasyPvProposal } from "@/data/easypv-proposal-service";
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
  /**
   * The solar design image (panels drawn on the roof — the quote's "Solar
   * design", usually from Easy PV) shown on the quote. A copy is locked in
   * the `signed-documents` bucket at send-time so changing the quote's image
   * later can't alter what was sent; `sha256` is covered by the document
   * hash. See `lockQuoteDesignImage` (src/data/quote-design-image-service.ts).
   */
  designImage?: { storagePath: string; contentType: string; sha256: string };
  /**
   * Set when the customer is sent the Easy PV proposal with the portal's own
   * quote sheet in place of Easy PV's Quote page. A copy of the proposal PDF is
   * locked in the `signed-documents` bucket at send-time (`sha256` is covered
   * by the document hash) and `skipPages` (1-based) are left out of it. See
   * `lockEasyPvProposal` (src/data/easypv-proposal-service.ts).
   */
  proposalPdf?: { storagePath: string; fileName: string; sha256: string; skipPages: number[] };
  /**
   * Solar only: the quote laid out like Easy PV's own Quote page — a description-only "Goods" list
   * (panels, inverter, batteries, mounting, "Electrical and ancillary items") rolled into one System
   * cost, then any priced additional items (scaffolding, etc.), the discount and the totals. Built by
   * `solarSheetFor`. When absent (a boiler, or an older snapshot) the plain itemised table is used.
   */
  /**
   * Solar with an Easy PV proposal only: the portal's own "Your Solar Proposal" page, which stands in for
   * Easy PV's (whose customer, price, reference and dates come from the Easy PV project, not the quote).
   * Every figure is the portal's: the system from the quote's arrays, the yield / saving / payback from the
   * MCS estimate and SAP table at the quote's own price. A figure the portal can't calculate is left out.
   */
  proposalPage?: {
    kwpLabel: string;
    priceLabel: string;
    genY1Label?: string;
    savingY1Label?: string;
    paybackLabel?: string;
    batteryLabel?: string;
    validityLabel: string;
  };
  solarSheet?: {
    goods: string[];
    systemCostLabel: string;
    additionalItems: { name: string; quantity: number; unitPriceLabel: string; amountLabel: string }[];
    /** Only when a VAT figure has been entered on the quote — the total itself is always VAT-inclusive. */
    totalBeforeVatLabel?: string;
    vatLabel?: string;
    validityLabel: string;
  };
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
  /** Sum of `lineItems` before the discount below — "Subtotal" on the
   *  System Summary. Already VAT-inclusive (this business quotes
   *  VAT-inclusive prices) — VAT itself is deliberately left out of this
   *  snapshot for now, see `PricingAdjustmentsCard`. */
  subtotalLabel?: string;
  discountLabel?: string;
  /** Absent when there's no deposit for this quote. */
  depositLabel?: string;
  /** True when the deposit is paid up front, so the Monthly Plan finances only `amountFinancedLabel`. */
  depositPaidUpfront?: boolean;
  /** Set only for a Monthly Plan with an up-front deposit — the part of the price the plan actually finances. */
  amountFinancedLabel?: string;
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
    /** Set only for an Extras catalog entry that's included at no charge
     *  but has a real worth (e.g. "Gateway with Comfort Touch", see
     *  `lockedPrice` in src/lib/extras-catalog.ts) — the value it would
     *  normally cost, to render struck through next to the £0.00
     *  `amountLabel` the customer actually pays. Absent for every other
     *  line item, and on a snapshot locked before this field existed. */
    originalUnitPriceLabel?: string;
  }[];
  /** The term the customer actually picked on the Payment Method card, not
   *  a comparison across `MONTHLY_PLAN_TERM_YEARS` — a single-element array
   *  (kept as an array so the renderers below didn't need a shape change),
   *  or absent/empty when the quote isn't on a Monthly Plan at all (e.g.
   *  BACS) — there's no "selected" term to show then. */
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

  const solar = detail as SolarQuoteDetail;
  const { batteries } = solar.keyDetails;
  // `keyDetails.systemSizeKw` is a stored figure that's 0 until someone enters it (e.g. after importing
  // from Easy PV) — the arrays themselves are always current, so prefer what they add up to.
  const fromArrays = solar.solarArrays.reduce((sum, array) => sum + (array.moduleWp * array.moduleCount) / 1000, 0);
  const systemSizeKw = fromArrays > 0 ? Math.round(fromArrays * 100) / 100 : solar.keyDetails.systemSizeKw;
  return {
    headline: `${systemSizeKw}kW Solar System`,
    subheadline: batteries > 0 ? `with ${batteries} battery unit${batteries === 1 ? "" : "s"}` : undefined,
  };
}

/** The single term actually selected on the Payment Method card — absent
 *  when the quote isn't on a Monthly Plan (e.g. BACS), since there's
 *  nothing "selected" to show then. */
function monthlyPlansFor(
  totalPrice: number,
  detail: BoilerQuoteDetail | SolarQuoteDetail,
): { years: number; monthlyLabel: string }[] {
  if (detail.selectedPaymentMethod !== "monthly_plan" || !detail.monthlyPlanTermYears) return [];
  const years = detail.monthlyPlanTermYears;
  // An up-front deposit comes off what's financed (see `financedAmount`).
  const financed = financedAmount(totalPrice, detail.depositAmount, detail.depositPaidUpfront);
  return [{ years, monthlyLabel: formatCurrency(monthlyRepayment(financed, years)) }];
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

function lineItemFrom(
  name: string,
  quantity: number,
  unitPrice: number,
  originalUnitPrice?: number,
): DocumentSnapshot["lineItems"][number] {
  return {
    name,
    quantity,
    unitPriceLabel: formatCurrency(unitPrice),
    amount: quantity * unitPrice,
    amountLabel: formatCurrency(quantity * unitPrice),
    originalUnitPriceLabel: originalUnitPrice ? formatCurrency(originalUnitPrice) : undefined,
  };
}

/** Extras go through the catalog (see `findCatalogEntry`) so a locked-price
 *  entry — always charged £0 on the line itself — carries its real worth
 *  through as `originalUnitPriceLabel` too. */
function extraLineItemFrom(item: { name: string; quantity: number; unitPrice: number }): DocumentSnapshot["lineItems"][number] {
  const catalogEntry = findCatalogEntry(item.name);
  const originalUnitPrice = catalogEntry?.lockedPrice ? catalogEntry.defaultUnitPrice : undefined;
  return lineItemFrom(item.name, item.quantity, item.unitPrice, originalUnitPrice);
}

function itemizedLineItems(detail: BoilerQuoteDetail | SolarQuoteDetail): DocumentSnapshot["lineItems"] {
  // A solar quote lists each panel / inverter / battery / mounting line with its own quantity and
  // price (like the Easy PV quote page), instead of the sidebar's "Solar array + install" and
  // "Equipment" lump sums. Boilers keep their single package row.
  const installLines =
    "solarArrays" in detail
      ? [...detail.solarArrays.flatMap((array) => array.items), ...detail.equipment.flatMap((entry) => entry.items)].map(
          (item) => lineItemFrom(item.name, item.quantity, item.unitPrice),
        )
      : detail.pricingBreakdown
          .filter((item) => !AGGREGATED_SECTION_NAMES.has(item.name))
          .map((item) => lineItemFrom(item.name, item.quantity, item.unitPrice));

  const extraLines = detail.extras.map(extraLineItemFrom);
  const standardAdditionalLines = detail.standardAdditionals.map((item) =>
    lineItemFrom(item.name, item.quantity, item.unitPrice),
  );
  const freeTextLines = detail.freeTextExtras.map((item) => lineItemFrom(item.description, item.quantity, item.unitPrice));

  return [...installLines, ...extraLines, ...standardAdditionalLines, ...freeTextLines];
}

/** Names of the Easy PV cart lines that are electrical / ancillary — these are folded into "Electrical and ancillary items". */
async function easyPvAncillaryNames(quoteId: string): Promise<Set<string>> {
  try {
    const admin = createServiceRoleClient();
    const { data } = await admin.from("quotes").select("easypv_summary").eq("id", quoteId).maybeSingle();
    const cart = (data?.easypv_summary as { cart?: { name: string; kind: string }[] } | null)?.cart ?? [];
    return new Set(cart.filter((line) => line.kind === "electrical" || line.kind === "other").map((line) => line.name));
  } catch (error) {
    console.error("easyPvAncillaryNames failed", error);
    return new Set();
  }
}

/**
 * The solar quote as Easy PV lays out its own Quote page: what's supplied (no per-line prices), one
 * System cost, then anything priced separately. Prices are the portal's (Easy PV cost + markup),
 * so the figures always tally with the quote's total.
 */
function solarSheetFor(detail: SolarQuoteDetail, ancillaryNames: Set<string>, total: number): DocumentSnapshot["solarSheet"] {
  if (detail.solarArrays.length === 0 && detail.equipment.length === 0) return undefined;

  const goods: string[] = [];
  for (const array of detail.solarArrays) {
    const [main, ...rest] = array.items;
    if (main) goods.push(`${array.moduleCount > 0 ? array.moduleCount : main.quantity} \u00d7 ${main.name}`);
    if (rest.length > 0 && !goods.includes("Mounting system and fixings")) goods.push("Mounting system and fixings");
  }
  for (const entry of detail.equipment) {
    const main = entry.items[0];
    if (main) goods.push(main.quantity > 1 ? `${main.quantity} \u00d7 ${main.name}` : main.name);
  }

  const ancillary = detail.extras.filter((item) => ancillaryNames.has(item.name));
  if (ancillary.length > 0) goods.push("Electrical and ancillary items");

  const systemCost =
    sumLineItems(detail.solarArrays.flatMap((array) => array.items)) +
    sumLineItems(detail.equipment.flatMap((entry) => entry.items)) +
    sumLineItems(ancillary);

  const ancillarySet = new Set(ancillary);
  const additionalItems = [
    ...detail.extras.filter((item) => !ancillarySet.has(item)).map(extraLineItemFrom),
    ...detail.standardAdditionals.map((item) => lineItemFrom(item.name, item.quantity, item.unitPrice)),
    ...detail.freeTextExtras.map((item) => lineItemFrom(item.description, item.quantity, item.unitPrice)),
  ].map((item) => ({
    name: item.name,
    quantity: item.quantity ?? 1,
    unitPriceLabel: item.unitPriceLabel ?? "",
    amountLabel: item.amountLabel,
  }));

  return {
    goods,
    systemCostLabel: formatCurrency(systemCost),
    additionalItems,
    totalBeforeVatLabel: detail.vatAmount > 0 ? formatCurrency(total - detail.vatAmount) : undefined,
    vatLabel: detail.vatAmount > 0 ? formatCurrency(detail.vatAmount) : undefined,
    validityLabel: `${OFFER_VALIDITY_DAYS} days`,
  };
}

/** The portal's own figures for the "Your Solar Proposal" page — see `DocumentSnapshot.proposalPage`. */
function proposalPageFor(detail: SolarQuoteDetail, total: number): DocumentSnapshot["proposalPage"] {
  const estimate = detail.mcsEstimate;
  const kwp = estimate.totalKwp;
  if (!(kwp > 0)) return undefined;

  const assumptions = detail.keyDetails.sapAssumptions;
  const rows = assumptions ? computeSapTable(estimate, detail.property.electricUnitRate, assumptions) : undefined;
  const financed = (assumptions?.annualCosts ?? 0) > 0;
  const payback = rows ? paybackYears(rows, financed ? 0 : total) : undefined;
  const savingY1 = rows?.[0]?.savings;
  const generation = estimate.totalOutputKwh;
  const batteries = detail.keyDetails.batteries;
  const usableKwh = detail.keyDetails.batteryUsableKwh;

  return {
    kwpLabel: `${Math.round(kwp * 100) / 100} kW PV System`,
    priceLabel: formatCurrency(total),
    genY1Label: generation > 0 ? `${Math.round(generation).toLocaleString("en-GB")} kWh a year` : undefined,
    savingY1Label: savingY1 !== undefined && savingY1 > 0 ? formatCurrency(savingY1) : undefined,
    paybackLabel: payback !== undefined ? `${Math.ceil(payback)} years` : undefined,
    batteryLabel:
      batteries > 0
        ? usableKwh
          ? `${batteries} × battery, ${Math.round(usableKwh * 100) / 100} kWh usable storage`
          : `${batteries} battery unit${batteries === 1 ? "" : "s"}`
        : undefined,
    validityLabel: `${OFFER_VALIDITY_DAYS} days`,
  };
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
  // (see PricingAdjustmentsCard) — VAT is already included in the
  // subtotal (never added on top) and, for now, left out of this snapshot
  // entirely rather than broken out as its own line.
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
    discountLabel: detail.discountAmount > 0 ? formatCurrency(detail.discountAmount) : undefined,
    depositLabel: detail.depositAmount > 0 ? formatCurrency(detail.depositAmount) : undefined,
    depositPaidUpfront: detail.depositAmount > 0 ? detail.depositPaidUpfront : undefined,
    amountFinancedLabel:
      detail.selectedPaymentMethod === "monthly_plan" && detail.depositAmount > 0 && detail.depositPaidUpfront
        ? formatCurrency(financedAmount(total, detail.depositAmount, true))
        : undefined,
    totalPriceLabel: formatCurrency(total),
    paymentMethodLabel: paymentMethodLabel(detail),
    lineItems: itemizedLineItems(detail),
    solarSheet: "solarArrays" in detail ? solarSheetFor(detail, await easyPvAncillaryNames(quote.id), total) : undefined,
    proposalPage:
      "solarArrays" in detail && (await hasEasyPvProposal(quote.id)) ? proposalPageFor(detail, total) : undefined,
    monthlyPlans: monthlyPlansFor(total, detail),
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
