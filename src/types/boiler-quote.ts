import type {
  CustomerDetails,
  FreeTextExtra,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteHistoryEntry,
  QuoteNote,
} from "@/types/quote-detail-shared";

/**
 * Rich detail-view shape for a boiler quote, keyed 1:1 with a `Quote` whose
 * `productType` is `"boiler"` (see `src/types/quote.ts`). This lives
 * alongside — not inside — `Quote` because the list/table only ever needs
 * the thin summary; the full breakdown is only fetched when a boiler
 * quote's detail page is opened. Product-agnostic shapes (line items,
 * customer info, notes, history, ...) live in `quote-detail-shared.ts` and
 * are reused by the solar vertical too.
 */

export type FuelType = "Mains Gas" | "LPG" | "Oil";
export type FlueType = "Horizontal" | "Vertical";
export type BoilerInstallType = "Combi" | "System" | "Open Vent";

export interface BoilerUnit {
  id: string;
  label: string;
  make: string;
  model: string;
  outputKw: number;
  fuelType: FuelType;
  flueType: FlueType;
  installType: BoilerInstallType;
  /** Litres. Absent for combi boilers, which have no separate cylinder. */
  cylinderLitres?: number;
  warrantyYears: number;
  /** The boiler's own price — separate from `items`, which are its add-ons. */
  price: number;
  items: LineItem[];
}

export interface BoilerPropertyDetails {
  propertyType: string;
  bedrooms: number;
  radiators: number;
  currentBoilerType: string;
  currentBoilerAge: string;
  boilerLocation: string;
  gasSupplyConfirmed: "Yes" | "No";
  /** Meter Point Reference Number — the gas-meter equivalent of an MPAN. */
  mprn: string;
  accessNotes: string;
}

export interface BoilerKeyDetails {
  estInstallDays: number;
}

export interface BoilerQuoteDetail {
  /** Matches the owning Quote's id. */
  quoteId: string;
  reference: string;
  version: number;
  statusLabel: string;
  assignedRep: string;
  /** Absent when unassigned. */
  assignedRepId?: string;
  /** Who's booked to install this job, if anyone (see quotes.installer_id/install_date). */
  installerId?: string;
  installerName?: string;
  /** ISO date, e.g. "2026-09-12" — only meaningful alongside installerId. */
  installDate?: string;
  /** Whether the installer has confirmed the booking — absent when unassigned. */
  installAcceptanceStatus?: "pending" | "accepted" | "rejected";
  /** The "System Summary" figures a generated quote can't derive on its
   *  own — see PricingAdjustmentsCard. vatAmount is informational only
   *  (this business quotes VAT-inclusive prices). */
  vatAmount: number;
  discountAmount: number;
  depositAmount: number;
  isFavourite: boolean;
  locked: boolean;
  customer: CustomerDetails;
  property: BoilerPropertyDetails;
  boilerUnits: BoilerUnit[];
  extras: LineItem[];
  standardAdditionals: LineItem[];
  freeTextExtras: FreeTextExtra[];
  selectedPaymentMethod: PaymentMethodOption;
  /** Only meaningful when `selectedPaymentMethod === "monthly_plan"`. */
  monthlyPlanTermYears?: number;
  keyDetails: BoilerKeyDetails;
  pricingBreakdown: LineItem[];
  profitBreakdown: ProfitBreakdown;
  notes: QuoteNote[];
  history: QuoteHistoryEntry[];
}
