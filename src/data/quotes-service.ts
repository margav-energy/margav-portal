import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles } from "@/data/profiles-service";
import { getBoilerCostSettings } from "@/data/boiler-cost-settings-service";
import { boilerCostBreakdown } from "@/lib/boiler-install-cost";
import {
  buildPricingBreakdown,
  buildProfileMap,
  buildProfitBreakdown,
  manualCostPriceFrom,
  mapBoilerKeyDetails,
  mapBoilerPropertyDetails,
  mapBoilerUnitRow,
  mapCustomerDetails,
  mapFreeTextRow,
  mapHistoryRow,
  mapLineItemRow,
  mapNoteRow,
  mapQuoteRow,
  mapSolarArrayRow,
  mapSolarKeyDetails,
  mapSolarPropertyDetails,
  monthlyPlanTermYearsFor,
  referenceFor,
  selectedPaymentMethodFor,
  statusLabelFor,
  sumLineItems,
  type BoilerUnitRow,
  type LineItemRow,
  type ProfileMap,
  type QuoteHistoryRow,
  type QuoteNoteRow,
  type QuoteRow,
  type SolarArrayRow,
} from "@/data/quotes-mappers";
import type { InstallStatus, Quote, QuotePipelineStatus, QuoteStage, UnassignedInstallJob } from "@/types/quote";
import type { BoilerQuoteDetail } from "@/types/boiler-quote";
import type { SolarQuoteDetail } from "@/types/solar-quote";

/**
 * Data-access layer for the Quotes module, backed by Supabase (see
 * `supabase/schema.sql`). Row → app-type mapping lives in
 * `quotes-mappers.ts`; mutations live in `src/components/quotes/actions.ts`.
 */

const QUOTE_COLUMNS =
  "id, customer_name, customer_email, customer_phone, customer_address_lines, postcode, address, amount, payment_type, selected_payment_method, monthly_plan_term_years, stage, sent_date, signed_date, install_status, notes, product_type, pipeline_status, representative_id, installer_id, install_date, install_acceptance_status, vat_amount, discount_amount, deposit_amount, is_favourite, is_locked, archived_at, property_details, key_details, profit_breakdown, sent_at, reference, version, status_label, dropbox_sign_request_id";

const ARCHIVE_AFTER_YEARS = 5;

/**
 * There's no manual "Archive" button anymore — quotes drop out of every
 * list view on their own once they're this many years old. `archived_at`
 * still exists for a possible future manual override; this is the
 * automatic half of archiving.
 */
function autoArchiveCutoffIso(): string {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - ARCHIVE_AFTER_YEARS);
  return cutoff.toISOString().slice(0, 10);
}

async function fetchProfileMap(): Promise<ProfileMap> {
  const profiles = await getAllProfiles();
  return buildProfileMap(profiles);
}

/**
 * `representativeId`, when passed, limits the result to that rep's own
 * quotes — used to restrict the `rep` role to "only see quotes assigned to
 * them" (see `requireStaffUser` callers in `src/app/quotes/page.tsx` and
 * `src/app/page.tsx`). Admins pass `undefined` and see everything, same as
 * before this existed.
 */
export async function getAllQuotes(representativeId?: string): Promise<Quote[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .is("archived_at", null)
    .gte("sent_date", autoArchiveCutoffIso());
  if (representativeId) query = query.eq("representative_id", representativeId);

  const [{ data, error }, profiles] = await Promise.all([
    query.order("sent_date", { ascending: false }),
    fetchProfileMap(),
  ]);

  if (error) {
    console.error("getAllQuotes failed", error);
    return [];
  }

  return (data ?? []).map((row) => mapQuoteRow(row as QuoteRow, profiles));
}

/** See `getAllQuotes`'s doc comment — `representativeId` restricts the rep role the same way here. */
export async function getQuotesByStage(stage: QuoteStage, representativeId?: string): Promise<Quote[]> {
  const supabase = await createClient();
  let query = supabase
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .is("archived_at", null)
    .gte("sent_date", autoArchiveCutoffIso())
    .eq("stage", stage);
  if (representativeId) query = query.eq("representative_id", representativeId);

  const [{ data, error }, profiles] = await Promise.all([
    query.order("sent_date", { ascending: false }),
    fetchProfileMap(),
  ]);

  if (error) {
    console.error("getQuotesByStage failed", error);
    return [];
  }

  return (data ?? []).map((row) => mapQuoteRow(row as QuoteRow, profiles));
}

export async function getQuoteById(id: string): Promise<Quote | undefined> {
  const supabase = await createClient();
  const [{ data, error }, profiles] = await Promise.all([
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("id", id).maybeSingle(),
    fetchProfileMap(),
  ]);

  if (error || !data) {
    if (error) console.error("getQuoteById failed", error);
    return undefined;
  }

  return mapQuoteRow(data as QuoteRow, profiles);
}

/**
 * Every quote has a rich detail view assembled from several tables:
 * `boiler_units`/`solar_arrays` (depending on `product_type`),
 * `quote_line_items` (extras / standard additionals / free-text extras),
 * `quote_notes`, and `quote_history`. This is the single entry point the
 * detail page calls; it returns `undefined` only if the quote itself
 * doesn't exist.
 */
export async function getQuoteDetail(
  id: string,
): Promise<{ quote: Quote; detail: BoilerQuoteDetail | SolarQuoteDetail } | undefined> {
  const supabase = await createClient();

  const [{ data: quoteRow, error: quoteError }, profiles] = await Promise.all([
    supabase.from("quotes").select(QUOTE_COLUMNS).eq("id", id).maybeSingle(),
    fetchProfileMap(),
  ]);

  if (quoteError || !quoteRow) {
    if (quoteError) console.error("getQuoteDetail failed", quoteError);
    return undefined;
  }

  const row = quoteRow as QuoteRow;
  const isBoiler = row.product_type === "boiler";

  const [unitsResult, lineItemsResult, notesResult, historyResult, boilerCostSettings] = await Promise.all([
    isBoiler
      ? supabase
          .from("boiler_units")
          .select("id, label, make, model, output_kw, fuel_type, flue_type, install_type, cylinder_litres, warranty_years, price, items, sort_order")
          .eq("quote_id", id)
          .order("sort_order", { ascending: true })
      : supabase
          .from("solar_arrays")
          .select("id, label, shade_factor, orientation, pitch_degrees, items, sort_order")
          .eq("quote_id", id)
          .order("sort_order", { ascending: true }),
    supabase
      .from("quote_line_items")
      .select("id, section, name, description, quantity, unit_price, sort_order")
      .eq("quote_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("quote_notes")
      .select("id, author_id, body, created_at")
      .eq("quote_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("quote_history")
      .select("id, actor_id, is_system, description, created_at")
      .eq("quote_id", id)
      .order("created_at", { ascending: false }),
    // Only boiler quotes need this — skip the extra round trip for solar.
    isBoiler ? getBoilerCostSettings() : Promise.resolve(null),
  ]);

  if (unitsResult.error) console.error("getQuoteDetail units failed", unitsResult.error);
  if (lineItemsResult.error) console.error("getQuoteDetail line items failed", lineItemsResult.error);
  if (notesResult.error) console.error("getQuoteDetail notes failed", notesResult.error);
  if (historyResult.error) console.error("getQuoteDetail history failed", historyResult.error);

  const lineItemRows = (lineItemsResult.data ?? []) as LineItemRow[];
  const extras = lineItemRows.filter((item) => item.section === "extra").map(mapLineItemRow);
  const standardAdditionals = lineItemRows
    .filter((item) => item.section === "standard_additional")
    .map(mapLineItemRow);
  const freeTextExtras = lineItemRows.filter((item) => item.section === "free_text").map(mapFreeTextRow);

  const notes = (notesResult.data ?? []).map((noteRow) => mapNoteRow(noteRow as QuoteNoteRow, profiles));
  const history = (historyResult.data ?? []).map((historyRow) =>
    mapHistoryRow(historyRow as QuoteHistoryRow, profiles),
  );

  const assignedRepId = row.representative_id ?? undefined;
  const assignedRep = assignedRepId ? (profiles.get(assignedRepId)?.fullName ?? "Unassigned") : "Unassigned";
  const installerId = row.installer_id ?? undefined;
  const installerName = installerId ? profiles.get(installerId)?.fullName : undefined;
  const installDate = row.install_date ?? undefined;
  const installAcceptanceStatus = row.install_acceptance_status ?? undefined;
  const vatAmount = Number(row.vat_amount ?? 0);
  const discountAmount = Number(row.discount_amount ?? 0);
  const depositAmount = Number(row.deposit_amount ?? 0);

  const shared = {
    reference: referenceFor(row),
    version: row.version,
    statusLabel: statusLabelFor(row),
    pipelineStatus: row.pipeline_status as QuotePipelineStatus,
    installStatus: (row.install_status as InstallStatus | null) ?? undefined,
    assignedRep,
    assignedRepId,
    installerId,
    installerName,
    installDate,
    installAcceptanceStatus,
    vatAmount,
    discountAmount,
    depositAmount,
    isFavourite: row.is_favourite,
    locked: row.is_locked,
    customer: mapCustomerDetails(row),
    extras,
    standardAdditionals,
    freeTextExtras,
    selectedPaymentMethod: selectedPaymentMethodFor(row),
    monthlyPlanTermYears: monthlyPlanTermYearsFor(row),
    pricingBreakdown: [] as BoilerQuoteDetail["pricingBreakdown"],
    notes,
    history,
  };

  const extrasTotal = sumLineItems(extras);
  const standardAdditionalsTotal = sumLineItems(standardAdditionals);
  const freeTextTotal = sumLineItems(freeTextExtras);

  const quote = mapQuoteRow(row, profiles);

  if (isBoiler) {
    const unitRows = (unitsResult.data ?? []) as BoilerUnitRow[];
    const boilerUnits = unitRows.map(mapBoilerUnitRow);
    const unitsTotal =
      boilerUnits.reduce((sum, unit) => sum + unit.price, 0) +
      sumLineItems(boilerUnits.flatMap((unit) => unit.items));
    const sellPrice = unitsTotal + extrasTotal + standardAdditionalsTotal + freeTextTotal;
    // boilerCostSettings is always populated here — fetched above whenever isBoiler is true.
    const costBreakdown = boilerCostBreakdown(
      boilerUnits.map((unit) => ({ outputKw: unit.outputKw, make: unit.make, model: unit.model })),
      boilerCostSettings!,
      extras,
    );

    const detail: BoilerQuoteDetail = {
      quoteId: row.id,
      ...shared,
      property: mapBoilerPropertyDetails(row.property_details),
      boilerUnits,
      keyDetails: mapBoilerKeyDetails(row.key_details),
      pricingBreakdown: buildPricingBreakdown([
        { name: "Boiler + install", total: unitsTotal, count: boilerUnits.length },
        { name: "Extras", total: extrasTotal, count: extras.length },
        { name: "Standard additionals", total: standardAdditionalsTotal, count: standardAdditionals.length },
        { name: "Free-text extras", total: freeTextTotal, count: freeTextExtras.length },
      ]),
      profitBreakdown: buildProfitBreakdown(
        costBreakdown.total,
        sellPrice,
        costBreakdown.lineItems,
        costBreakdown.materialsCost,
      ),
    };

    return { quote, detail };
  }

  const arrayRows = (unitsResult.data ?? []) as SolarArrayRow[];
  const solarArrays = arrayRows.map(mapSolarArrayRow);
  const arraysTotal = sumLineItems(solarArrays.flatMap((array) => array.items));
  const sellPrice = arraysTotal + extrasTotal + standardAdditionalsTotal + freeTextTotal;

  const detail: SolarQuoteDetail = {
    quoteId: row.id,
    ...shared,
    property: mapSolarPropertyDetails(row.property_details),
    solarArrays,
    keyDetails: mapSolarKeyDetails(row.key_details),
    pricingBreakdown: buildPricingBreakdown([
      { name: "Solar array + install", total: arraysTotal, count: solarArrays.length },
      { name: "Extras", total: extrasTotal, count: extras.length },
      { name: "Standard additionals", total: standardAdditionalsTotal, count: standardAdditionals.length },
      { name: "Free-text extras", total: freeTextTotal, count: freeTextExtras.length },
    ]),
    profitBreakdown: buildProfitBreakdown(manualCostPriceFrom(row.profit_breakdown), sellPrice),
  };

  return { quote, detail };
}

/** See `getAllQuotes`'s doc comment — `representativeId` restricts the rep role the same way here. */
export async function getQuoteSummary(representativeId?: string): Promise<{
  totalQuotes: number;
  totalSigned: number;
}> {
  const supabase = await createClient();
  const cutoff = autoArchiveCutoffIso();
  let totalQuery = supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .gte("sent_date", cutoff);
  let signedQuery = supabase
    .from("quotes")
    .select("id", { count: "exact", head: true })
    .is("archived_at", null)
    .gte("sent_date", cutoff)
    .eq("stage", "signed");
  if (representativeId) {
    totalQuery = totalQuery.eq("representative_id", representativeId);
    signedQuery = signedQuery.eq("representative_id", representativeId);
  }

  const [totalResult, signedResult] = await Promise.all([totalQuery, signedQuery]);

  if (totalResult.error) console.error("getQuoteSummary failed", totalResult.error);
  if (signedResult.error) console.error("getQuoteSummary failed", signedResult.error);

  return {
    totalQuotes: totalResult.count ?? 0,
    totalSigned: signedResult.count ?? 0,
  };
}

/**
 * Signed jobs with nobody booked to install them yet — the list shown in
 * the "assign a job" modal on the Installer Availability grid (see
 * src/components/availability/AssignJobModal.tsx). Deliberately its own
 * lean `select`, not `QUOTE_COLUMNS`/`mapQuoteRow` — this list only needs
 * enough to identify and pick a job, not the full quote shape.
 */
export async function getUnassignedInstallJobs(): Promise<UnassignedInstallJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, reference, customer_name, postcode, product_type, install_status")
    .eq("stage", "signed")
    .is("installer_id", null)
    .or("install_status.is.null,install_status.not.in.(completed_install,cancelled)")
    .order("signed_date", { ascending: true });

  if (error) {
    console.error("getUnassignedInstallJobs failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    reference: row.reference,
    customerName: row.customer_name,
    postcode: row.postcode,
    productType: row.product_type,
    installStatus: row.install_status,
  }));
}
