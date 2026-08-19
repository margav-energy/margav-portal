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
 * Rich detail-view shape for a solar quote — the app's original (and still
 * default) product line, i.e. every `Quote` whose `productType` is absent
 * or `"solar"`. Mirrors `BoilerQuoteDetail` in shape; see that file's
 * comment for why the product-agnostic pieces live in
 * `quote-detail-shared.ts` instead of here.
 */

export interface SolarPropertyDetails {
  occupancyArchetype: string;
  annualConsumptionKwh: number;
  /** £/kWh */
  electricUnitRate: number;
  estimatedBill: "Yes" | "No";
  estimatedReason: string;
  sprayFoam: "Yes" | "No";
  mpan: string;
}

export interface SolarArray {
  id: string;
  label: string;
  /** Shading factor as a fraction of unshaded irradiance, e.g. 1 = no shade, 0.92 = 8% shaded. */
  shadeFactor: number;
  orientation: string;
  pitchDegrees: number;
  items: LineItem[];
}

export interface SolarKeyDetails {
  panels: number;
  batteries: number;
  systemSizeKw: number;
  genY1Kwh: number;
  savingY1: number;
  lifetimeSaving: number;
  profit: number;
  roiPercent: number;
  gridIndependencePercent: number;
  paybackYears: number;
  /** Optional external URL, stored in `quotes.key_details`. No upload UI — set manually/by another integration. */
  sapTableUrl?: string;
}

export interface SolarQuoteDetail {
  /** Matches the owning Quote's id. */
  quoteId: string;
  reference: string;
  version: number;
  statusLabel: string;
  assignedRep: string;
  /** Absent when unassigned. */
  assignedRepId?: string;
  isFavourite: boolean;
  locked: boolean;
  customer: CustomerDetails;
  property: SolarPropertyDetails;
  solarArrays: SolarArray[];
  extras: LineItem[];
  standardAdditionals: LineItem[];
  freeTextExtras: FreeTextExtra[];
  selectedPaymentMethod: PaymentMethodOption;
  /** Only meaningful when `selectedPaymentMethod === "monthly_plan"`. */
  monthlyPlanTermYears?: number;
  keyDetails: SolarKeyDetails;
  pricingBreakdown: LineItem[];
  profitBreakdown: ProfitBreakdown;
  notes: QuoteNote[];
  history: QuoteHistoryEntry[];
}
