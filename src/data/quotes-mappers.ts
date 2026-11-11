import "server-only";
import type {
  InstallStatus,
  PaymentType,
  ProductType,
  Quote,
  QuotePipelineStatus,
  QuoteStage,
} from "@/types/quote";
import type {
  CustomerDetails,
  FreeTextExtra,
  LineItem,
  PaymentMethodOption,
  ProfitBreakdown,
  QuoteHistoryEntry,
} from "@/types/quote-detail-shared";
import type { BoilerKeyDetails, BoilerPropertyDetails } from "@/types/boiler-quote";
import { parseModuleFromItems, parseOrientationDegrees } from "@/lib/mcs/array-inputs";
import type { SapAssumptions, SolarEquipment, SolarEquipmentKind, SolarKeyDetails, SolarPropertyDetails, TemplateYear1 } from "@/types/solar-quote";
import type { RepProfile } from "@/data/profiles-service";

/**
 * Row shapes + row → app-type mapping for everything under the Quotes
 * module. Kept separate from `quotes-service.ts` (the read API) and
 * `src/components/quotes/actions.ts` (the mutations) so both can share the
 * same mapping logic without a circular import.
 */

export type ProfileMap = Map<string, RepProfile>;

export function buildProfileMap(profiles: RepProfile[]): ProfileMap {
  return new Map(profiles.map((profile) => [profile.id, profile]));
}

function repName(map: ProfileMap, id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return map.get(id)?.fullName;
}

// ───────────────────────────────────────────────────────────────────────
// quotes
// ───────────────────────────────────────────────────────────────────────

export interface QuoteRow {
  id: string;
  /** The appointment that spawned this quote, if any — see `src/types/boiler-quote.ts`'s `BoilerQuoteDetail.appointmentId`. */
  appointment_id: string | null;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address_lines: string[] | null;
  postcode: string;
  address: string;
  amount: number | string;
  payment_type: string;
  selected_payment_method: string | null;
  monthly_plan_term_years: number | null;
  stage: string;
  sent_date: string;
  signed_date: string | null;
  install_status: string | null;
  notes: string | null;
  product_type: string;
  pipeline_status: string;
  representative_id: string | null;
  installer_id: string | null;
  install_date: string | null;
  install_acceptance_status: "pending" | "accepted" | "rejected" | null;
  vat_amount: number | string;
  discount_amount: number | string;
  discount_reason?: string | null;
  deposit_amount: number | string;
  deposit_paid_upfront?: boolean | null;
  is_favourite: boolean;
  is_locked: boolean;
  archived_at: string | null;
  property_details: unknown;
  key_details: unknown;
  profit_breakdown: unknown;
  sent_at: string | null;
  reference: string | null;
  version: number;
  status_label: string | null;
  dropbox_sign_request_id: string | null;
}

export function mapQuoteRow(row: QuoteRow, profiles: ProfileMap): Quote {
  return {
    id: row.id,
    customerName: row.customer_name,
    postcode: row.postcode,
    address: row.address,
    amount: Number(row.amount),
    discountAmount: Number(row.discount_amount ?? 0),
    paymentType: row.payment_type as PaymentType,
    stage: row.stage as QuoteStage,
    sentDate: row.sent_date,
    signedDate: row.signed_date ?? undefined,
    installStatus: (row.install_status as InstallStatus | null) ?? undefined,
    notes: row.notes ?? undefined,
    productType: (row.product_type as ProductType | null) ?? undefined,
    pipelineStatus: row.pipeline_status as QuotePipelineStatus,
    representative: repName(profiles, row.representative_id),
    sentAt: row.sent_at ?? undefined,
    dropboxSignRequestId: row.dropbox_sign_request_id ?? undefined,
  };
}

export function mapCustomerDetails(row: QuoteRow): CustomerDetails {
  return {
    name: row.customer_name,
    email: row.customer_email ?? "",
    phone: row.customer_phone ?? "",
    addressLines: row.customer_address_lines ?? [],
  };
}

export function referenceFor(row: QuoteRow): string {
  return row.reference || row.id;
}

export function statusLabelFor(row: QuoteRow): string {
  return row.status_label || (row.stage === "signed" ? "Signed" : "Sent to Customer");
}

export function selectedPaymentMethodFor(row: QuoteRow): PaymentMethodOption {
  return row.selected_payment_method === "monthly_plan" ? "monthly_plan" : "bacs";
}

/** Only meaningful when `selectedPaymentMethodFor(row) === "monthly_plan"`. */
export function monthlyPlanTermYearsFor(row: QuoteRow): number | undefined {
  return row.monthly_plan_term_years ?? undefined;
}

/**
 * `sellPrice` always mirrors the Pricing card's total (boiler/solar +
 * install, extras, standard additionals, free-text extras) minus any
 * discount, rather than being stored. `profit`/`marginPercent` derive from
 * `costPrice` + `sellPrice`.
 *
 * `costPrice` itself comes from different places depending on product —
 * boiler quotes pass Margav's calculated install cost (see
 * `boilerCostBreakdown` in src/lib/boiler-install-cost.ts, `.total`) along
 * with its `costLineItems` breakdown and `materialsCost` (the `"materials"`
 * subset of those line items — what the Profit card shows as "Cost price");
 * solar has no cost model yet, so callers pass
 * `manualCostPriceFrom(row.profit_breakdown)` instead (whatever a rep
 * entered via the Profit card's edit modal) and no line items/materialsCost.
 */
export function buildProfitBreakdown(
  costPrice: number,
  sellPrice: number,
  costLineItems?: { name: string; amount: number; category: "materials" | "extra" }[],
  materialsCost?: number,
): ProfitBreakdown {
  const profit = sellPrice - costPrice;
  const marginPercent = sellPrice > 0 ? Math.round((profit / sellPrice) * 1000) / 10 : 0;
  return { costPrice, sellPrice, profit, marginPercent, costLineItems, materialsCost };
}

/** Solar-only: the cost price a rep manually entered via the Profit card, persisted in `quotes.profit_breakdown.costPrice` by `updateQuoteCostPrice`. 0 until someone sets one. */
export function manualCostPriceFrom(raw: unknown): number {
  const obj = (raw && typeof raw === "object" ? raw : {}) as { costPrice?: unknown };
  return typeof obj.costPrice === "number" ? obj.costPrice : 0;
}

export function mapBoilerKeyDetails(raw: unknown): BoilerKeyDetails {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<BoilerKeyDetails>;
  return {
    estInstallDays: Number(obj.estInstallDays ?? 1),
  };
}

export function mapSolarKeyDetails(raw: unknown): SolarKeyDetails {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<SolarKeyDetails>;
  return {
    panels: Number(obj.panels ?? 0),
    batteries: Number(obj.batteries ?? 0),
    systemSizeKw: Number(obj.systemSizeKw ?? 0),
    genY1Kwh: Number(obj.genY1Kwh ?? 0),
    savingY1: Number(obj.savingY1 ?? 0),
    lifetimeSaving: Number(obj.lifetimeSaving ?? 0),
    profit: Number(obj.profit ?? 0),
    roiPercent: Number(obj.roiPercent ?? 0),
    gridIndependencePercent: Number(obj.gridIndependencePercent ?? 0),
    paybackYears: Number(obj.paybackYears ?? 0),
    sapTableUrl: typeof obj.sapTableUrl === "string" && obj.sapTableUrl ? obj.sapTableUrl : undefined,
    sapAssumptions: mapSapAssumptions(obj.sapAssumptions),
    batteryUsableKwh: Number(obj.batteryUsableKwh) > 0 ? Number(obj.batteryUsableKwh) : undefined,
  };
}

function mapSapAssumptions(raw: unknown): SapAssumptions | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const num = (key: Exclude<keyof SapAssumptions, "templateYear1">) => {
    const value = Number(obj[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  const year1 = obj.templateYear1 && typeof obj.templateYear1 === "object" ? (obj.templateYear1 as Record<string, unknown>) : undefined;
  const year1Num = (key: keyof TemplateYear1) => {
    const value = Number(year1?.[key] ?? 0);
    return Number.isFinite(value) ? value : 0;
  };
  return {
    exportRatePerKwh: num("exportRatePerKwh"),
    electricityPriceGrowthPct: num("electricityPriceGrowthPct"),
    exportRateGrowthPct: num("exportRateGrowthPct"),
    outputDegradationPct: num("outputDegradationPct"),
    annualCosts: num("annualCosts"),
    year1ExtraCost: num("year1ExtraCost"),
    costTermYears: num("costTermYears"),
    replacementCost: num("replacementCost"),
    replacementEveryYears: num("replacementEveryYears"),
    templateYear1: year1
      ? { outputKwh: year1Num("outputKwh"), solar: year1Num("solar"), battery: year1Num("battery"), exportIncome: year1Num("exportIncome") }
      : undefined,
  };
}

export function mapBoilerPropertyDetails(raw: unknown): BoilerPropertyDetails {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<BoilerPropertyDetails>;
  return {
    propertyType: obj.propertyType ?? "",
    bedrooms: Number(obj.bedrooms ?? 0),
    bathrooms: Number(obj.bathrooms ?? 0),
    currentBoilerType: obj.currentBoilerType ?? "",
    currentBoilerAge: obj.currentBoilerAge ?? "",
    boilerLocation: obj.boilerLocation ?? "",
    gasSupplyConfirmed: (obj.gasSupplyConfirmed as "Yes" | "No") ?? "No",
    mprn: obj.mprn ?? "",
    accessNotes: obj.accessNotes ?? "",
  };
}

export function mapSolarPropertyDetails(raw: unknown): SolarPropertyDetails {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Partial<SolarPropertyDetails>;
  return {
    occupancyArchetype: obj.occupancyArchetype ?? "",
    annualConsumptionKwh: Number(obj.annualConsumptionKwh ?? 0),
    electricUnitRate: Number(obj.electricUnitRate ?? 0),
    estimatedBill: (obj.estimatedBill as "Yes" | "No") ?? "No",
    estimatedReason: obj.estimatedReason ?? "",
    tariffType: obj.tariffType ?? "Standard",
    customEstimate: obj.customEstimate ?? true,
    sprayFoam: (obj.sprayFoam as "Yes" | "No") ?? "No",
    mpan: obj.mpan ?? "",
    propertyType: obj.propertyType ?? "",
    energySupplier: obj.energySupplier ?? "",
    meterPhase: obj.meterPhase ?? "",
    rearAccess: obj.rearAccess ?? "",
    hasWifi: obj.hasWifi ?? "",
    hasPets: obj.hasPets ?? "",
    existingEvCharger: obj.existingEvCharger ?? "",
    existingSolarOrBattery: obj.existingSolarOrBattery ?? "",
    roofCount: obj.roofCount ?? "",
  };
}

// ───────────────────────────────────────────────────────────────────────
// jsonb `items` arrays (boiler_units / solar_arrays)
// ───────────────────────────────────────────────────────────────────────

interface RawLineItem {
  id?: string;
  name?: string;
  quantity?: number;
  unitPrice?: number;
}

export function parseLineItems(raw: unknown): LineItem[] {
  if (!Array.isArray(raw)) return [];
  return (raw as RawLineItem[]).map((item, index) => ({
    id: typeof item?.id === "string" ? item.id : `item-${index}`,
    name: String(item?.name ?? ""),
    quantity: Number(item?.quantity ?? 0),
    unitPrice: Number(item?.unitPrice ?? 0),
  }));
}

export function serializeLineItems(items: LineItem[]): RawLineItem[] {
  return items.map((item) => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
  }));
}

// ───────────────────────────────────────────────────────────────────────
// boiler_units / solar_arrays
// ───────────────────────────────────────────────────────────────────────

export interface BoilerUnitRow {
  id: string;
  label: string;
  make: string;
  model: string;
  output_kw: number | string;
  fuel_type: string;
  flue_type: string;
  install_type: string;
  cylinder_litres: number | string | null;
  warranty_years: number;
  price: number | string;
  items: unknown;
  sort_order: number;
}

export function mapBoilerUnitRow(row: BoilerUnitRow) {
  return {
    id: row.id,
    label: row.label,
    make: row.make,
    model: row.model,
    outputKw: Number(row.output_kw),
    fuelType: row.fuel_type as "Mains Gas" | "LPG" | "Oil",
    flueType: row.flue_type as "Horizontal" | "Vertical",
    installType: row.install_type as "Combi" | "System" | "Open Vent",
    cylinderLitres: row.cylinder_litres != null ? Number(row.cylinder_litres) : undefined,
    warrantyYears: row.warranty_years,
    price: Number(row.price ?? 0),
    items: parseLineItems(row.items),
  };
}

export interface SolarArrayRow {
  id: string;
  label: string;
  shade_factor: number | string;
  orientation: string;
  orientation_degrees: number | string | null;
  pitch_degrees: number | string;
  module_wp: number;
  module_count: number;
  items: unknown;
  sort_order: number;
}

export function mapSolarArrayRow(row: SolarArrayRow) {
  const items = parseLineItems(row.items);
  const derivedFrom: { module?: string; orientation?: string } = {};

  // Quotes made before the MCS inputs existed: read the rating/count from the panel line item
  // ("AIKO Neostar 3S 485w × 6") and the degrees from the orientation text ("90° South").
  let moduleWp = Number(row.module_wp ?? 0);
  let moduleCount = Number(row.module_count ?? 0);
  if (!(moduleWp > 0 && moduleCount > 0)) {
    const moduleItem = parseModuleFromItems(items);
    if (moduleItem) {
      moduleWp = moduleItem.wp;
      moduleCount = moduleItem.count;
      derivedFrom.module = `${moduleItem.itemName} × ${moduleItem.count}`;
    }
  }

  let orientationDegrees = row.orientation_degrees != null ? Number(row.orientation_degrees) : undefined;
  if (orientationDegrees === undefined) {
    orientationDegrees = parseOrientationDegrees(row.orientation);
    if (orientationDegrees !== undefined) derivedFrom.orientation = row.orientation;
  }

  return {
    id: row.id,
    label: row.label,
    shadeFactor: Number(row.shade_factor),
    orientation: row.orientation,
    orientationDegrees,
    pitchDegrees: Number(row.pitch_degrees),
    moduleWp,
    moduleCount,
    derivedFrom: Object.keys(derivedFrom).length > 0 ? derivedFrom : undefined,
    items,
  };
}

export interface SolarEquipmentRow {
  id: string;
  kind: string;
  label: string;
  items: unknown;
  sort_order: number;
}

export function mapSolarEquipmentRow(row: SolarEquipmentRow): SolarEquipment {
  return {
    id: row.id,
    kind: row.kind as SolarEquipmentKind,
    label: row.label,
    items: parseLineItems(row.items),
  };
}

// ───────────────────────────────────────────────────────────────────────
// quote_line_items
// ───────────────────────────────────────────────────────────────────────

export interface LineItemRow {
  id: string;
  section: string;
  name: string | null;
  description: string | null;
  quantity: number | string;
  unit_price: number | string;
  sort_order: number;
}

export function mapLineItemRow(row: LineItemRow): LineItem {
  return {
    id: row.id,
    name: row.name ?? "",
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
  };
}

export function mapFreeTextRow(row: LineItemRow): FreeTextExtra {
  return {
    id: row.id,
    description: row.description ?? "",
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
  };
}

// ───────────────────────────────────────────────────────────────────────
// quote_notes / quote_history
// ───────────────────────────────────────────────────────────────────────

export interface QuoteHistoryRow {
  id: string;
  actor_id: string | null;
  is_system: boolean;
  description: string;
  created_at: string;
}

export function mapHistoryRow(row: QuoteHistoryRow, profiles: ProfileMap): QuoteHistoryEntry {
  const actor = row.actor_id ? profiles.get(row.actor_id) : undefined;
  return {
    id: row.id,
    actorName: row.is_system ? "System" : (actor?.fullName ?? "Unknown"),
    isSystem: row.is_system,
    description: row.description,
    timestamp: row.created_at,
  };
}

// ───────────────────────────────────────────────────────────────────────
// pricing breakdown — derived at read time from line items, per spec.
// ───────────────────────────────────────────────────────────────────────

export function buildPricingBreakdown(
  sections: { name: string; total: number; count: number }[],
): LineItem[] {
  return sections
    .filter((section) => section.count > 0)
    .map((section, index) => ({
      id: `pricing-${index}`,
      name: section.name,
      quantity: 1,
      unitPrice: section.total,
    }));
}

export function sumLineItems(items: { quantity: number; unitPrice: number }[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}
