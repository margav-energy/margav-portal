import type { McsEstimate } from "@/lib/mcs/performance-estimate";
import type {
  CustomerDetails,
  FreeTextExtra,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteHistoryEntry,
  QuoteNote,
} from "@/types/quote-detail-shared";
import type { InstallStatus, QuotePipelineStatus } from "@/types/quote";

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
  /** e.g. "Standard" — informational, doesn't feed the MCS estimate. */
  tariffType?: string;
  /** Only relevant while `estimatedBill` is "Yes": true = the consumption is entered by hand; false = it's the 3,500 kWh average. Treated as true when absent. */
  customEstimate?: boolean;
  sprayFoam: "Yes" | "No";
  mpan: string;
  /** The fields below are filled in from the customer's pre-installation survey when it's submitted (see `buildPropertyPatchFromSurvey`) — empty until then. */
  propertyType?: string;
  energySupplier?: string;
  meterPhase?: string;
  rearAccess?: string;
  hasWifi?: string;
  hasPets?: string;
  existingEvCharger?: string;
  existingSolarOrBattery?: string;
  roofCount?: string;
}

/** Matches `solar_equipment.kind` in `supabase/schema.sql`. */
export type SolarEquipmentKind = "optimiser" | "inverter" | "battery" | "ev_charger" | "gateway";

/** One inverter / battery / … entry: the main product first, then its accessory lines. */
export interface SolarEquipment {
  id: string;
  kind: SolarEquipmentKind;
  label: string;
  items: LineItem[];
}

export interface SolarArray {
  id: string;
  label: string;
  /** Shading factor as a fraction of unshaded irradiance, e.g. 1 = no shade, 0.92 = 8% shaded. */
  shadeFactor: number;
  /** Display label, e.g. "South-East". The number the MCS estimate uses is `orientationDegrees`. */
  orientation: string;
  /** Degrees from due south (0 south, 90 east/west, 180 north). Absent until entered. */
  orientationDegrees?: number;
  pitchDegrees: number;
  /** Module label rating in watts at STC; kWp = moduleWp × moduleCount / 1000. */
  moduleWp: number;
  moduleCount: number;
  /** Set when a value wasn't entered but read from the array's existing text or line items — shown for confirmation on the MCS estimate. */
  derivedFrom?: { module?: string; orientation?: string };
  items: LineItem[];
}

/**
 * Admin-entered assumptions for the 25-year "Quote SAP table" projection
 * (see `computeSapTable`, src/lib/solar-sap.ts) — stored inside
 * `quotes.key_details`. The year-1 generation and self-consumption come from
 * the MCS estimate, so only what MCS doesn't specify is entered here.
 */
export interface SapAssumptions {
  /** £ per kWh paid for exported electricity (e.g. the Smart Export Guarantee tariff). */
  exportRatePerKwh: number;
  /** Yearly rise in the electricity unit rate, %. */
  electricityPriceGrowthPct: number;
  /** Yearly change in the export rate, % (negative for a fall). */
  exportRateGrowthPct: number;
  /** Straight-line fall in output per year, as a % of year 1 output (module degradation). */
  outputDegradationPct: number;
  /** Yearly finance repayment (or other running cost). */
  annualCosts: number;
  /** One-off added to the year 1 costs only. */
  year1ExtraCost: number;
  /** Number of years `annualCosts` is paid; later years cost nothing. */
  costTermYears: number;
  /** A recurring one-off cost (e.g. an inverter replacement) paid in every `replacementEveryYears`th year. 0 = none. */
  replacementCost: number;
  replacementEveryYears: number;
  /**
   * Hand-entered year 1 figures for systems outside the MCS self-consumption range (consumption of 6,000 kWh or
   * more, or generation of 6,000 kWh or more), where MCS gives no figures to start from. Only used in that case.
   */
  templateYear1?: TemplateYear1;
}

export interface TemplateYear1 {
  outputKwh: number;
  /** £ saved by electricity the solar panels supply directly. */
  solar: number;
  /** £ saved by the extra electricity the battery supplies. */
  battery: number;
  /** £ earned from exported electricity. */
  exportIncome: number;
}

export interface SapRow {
  year: number;
  outputKwh: number;
  solar: number;
  battery: number;
  export: number;
  savings: number;
  costs: number;
  /** Cumulative: previous net position + this year's savings − costs. */
  netPosition: number;
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
  /** Assumptions for the 25-year projection; absent until an admin enters them. */
  sapAssumptions?: SapAssumptions;
  /** Battery's usable capacity (kWh) for MCS self-consumption — after depth of discharge / reserved backup (MGD 003 §4.5). */
  batteryUsableKwh?: number;
}

export interface SolarQuoteDetail {
  /** Matches the owning Quote's id. */
  quoteId: string;
  /** The appointment that spawned this quote, if any (see `quotes.appointment_id`) — manually created quotes have none. Used to prefill the "Rebook App" flow. */
  appointmentId?: string;
  /** The original sales appointment's date/time — not the install date (`installDate` below) or the boiler survey date. ISO date, e.g. "2026-09-12". Absent alongside `appointmentId`. */
  appointmentDate?: string;
  /** "HH:mm" (or "HH:mm:ss") */
  appointmentStartTime?: string;
  appointmentEndTime?: string;
  reference: string;
  version: number;
  statusLabel: string;
  /** The lead's stage — New Lead → Ready to Pitch → Locked → Complete
   *  (see `QUOTE_PIPELINE_STATUS_STYLES`, src/lib/status-colors.ts).
   *  Admin-editable via `updateQuotePipelineStatusAction`. */
  pipelineStatus: QuotePipelineStatus;
  /** Set to "cancelled" by the "Cancel App" action button — surfaced as a
   *  "Cancelled" pill in the header (see `QuoteHeader`). Otherwise unused
   *  here; every other `InstallStatus` value only matters on the
   *  Dashboard's "signed" quotes panel (`QuoteListRow.tsx`). */
  installStatus?: InstallStatus;
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
  discountReason: string;
  depositAmount: number;
  isFavourite: boolean;
  locked: boolean;
  customer: CustomerDetails;
  property: SolarPropertyDetails;
  solarArrays: SolarArray[];
  equipment: SolarEquipment[];
  extras: LineItem[];
  standardAdditionals: LineItem[];
  freeTextExtras: FreeTextExtra[];
  selectedPaymentMethod: PaymentMethodOption;
  /** Only meaningful when `selectedPaymentMethod === "monthly_plan"`. */
  monthlyPlanTermYears?: number;
  keyDetails: SolarKeyDetails;
  /** The MCS performance estimate, built on the server from the quote's arrays, postcode and property details. */
  mcsEstimate: McsEstimate;
  pricingBreakdown: LineItem[];
  profitBreakdown: ProfitBreakdown;
  notes: QuoteNote[];
  history: QuoteHistoryEntry[];
}
