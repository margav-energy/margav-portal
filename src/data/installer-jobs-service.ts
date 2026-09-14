import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getAllProfiles } from "@/data/profiles-service";
import { buildProfileMap, mapBoilerPropertyDetails, mapNoteRow, mapSolarPropertyDetails } from "@/data/quotes-mappers";
import type { InstallAcceptanceStatus } from "@/types/installer-availability";
import type { CustomerDetails, QuoteNote } from "@/types/quote-detail-shared";
import type { BoilerPropertyDetails } from "@/types/boiler-quote";
import type { SolarPropertyDetails } from "@/types/solar-quote";

/**
 * Data-access layer for what an installer sees about their own booked jobs
 * — the "Upcoming Jobs" list (src/app/jobs/page.tsx) and its detail page
 * (src/app/jobs/[id]/page.tsx). Deliberately separate from
 * `installer-availability-service.ts` (the day-by-day calendar): this is
 * about a specific job's equipment/survey, not availability.
 *
 * Every query here is scoped to `installer_id = <the calling installer>` —
 * an installer can only ever see their own jobs, never another quote by
 * guessing its id.
 */

export interface InstallerJob {
  quoteId: string;
  customerName: string;
  address: string;
  postcode: string;
  productType: "solar" | "boiler";
  reference: string | null;
  installDate: string;
  acceptanceStatus: InstallAcceptanceStatus | null;
}

interface InstallerJobDbRow {
  id: string;
  customer_name: string;
  address: string;
  postcode: string;
  product_type: "solar" | "boiler";
  reference: string | null;
  install_date: string;
  install_acceptance_status: InstallAcceptanceStatus | null;
}

/**
 * This installer's booked jobs from `fromDate` onward, nearest first — the
 * "Upcoming Jobs" list. Unlike the availability calendar, this isn't
 * bounded to whatever month is currently displayed (a job booked 3 months
 * out shouldn't require paging a calendar forward to notice it exists).
 */
export async function getInstallerJobs(installerId: string, fromDate: string, limit = 30): Promise<InstallerJob[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, customer_name, address, postcode, product_type, reference, install_date, install_acceptance_status")
    .eq("installer_id", installerId)
    .gte("install_date", fromDate)
    .order("install_date", { ascending: true })
    .limit(limit);

  if (error) {
    console.error("getInstallerJobs failed", error);
    return [];
  }

  return (data ?? []).map((row) => {
    const jobRow = row as InstallerJobDbRow;
    return {
      quoteId: jobRow.id,
      customerName: jobRow.customer_name,
      address: jobRow.address,
      postcode: jobRow.postcode,
      productType: jobRow.product_type,
      reference: jobRow.reference,
      installDate: jobRow.install_date,
      acceptanceStatus: jobRow.install_acceptance_status,
    };
  });
}

/** A boiler unit's specs, with no `price`/`items[].unitPrice` — installers
 *  see what's going in, never what it costs. */
export interface InstallerBoilerUnit {
  id: string;
  label: string;
  make: string;
  model: string;
  outputKw: number;
  fuelType: string;
  flueType: string;
  installType: string;
  cylinderLitres?: number;
  warrantyYears: number;
  items: { name: string; quantity: number }[];
}

/** A solar array's specs, same no-pricing rule as `InstallerBoilerUnit`. */
export interface InstallerSolarArray {
  id: string;
  label: string;
  shadeFactor: number;
  orientation: string;
  pitchDegrees: number;
  items: { name: string; quantity: number }[];
}

/** A quote-level extra/standard-additional/free-text line item, with no
 *  `unitPrice` — same no-pricing rule as everything else here. `name` holds
 *  a free-text item's `description` too, so the installer view can treat
 *  all three sections identically. */
export interface InstallerLineItem {
  id: string;
  name: string;
  quantity: number;
}

export interface InstallerJobDetail extends InstallerJob {
  /** Full contact details — an installer needs the phone number/address to
   *  actually reach the customer, not just the name shown in the list. */
  customer: CustomerDetails;
  property: BoilerPropertyDetails | SolarPropertyDetails;
  boilerUnits?: InstallerBoilerUnit[];
  solarArrays?: InstallerSolarArray[];
  /** `quote_line_items` sections, pricing stripped — mirrors the admin/rep
   *  detail page's Extras/Standard Additionals/Free-text Extras sections. */
  extras: InstallerLineItem[];
  standardAdditionals: InstallerLineItem[];
  freeTextExtras: InstallerLineItem[];
  /** Same shared notes timeline the admin/rep detail page shows — read AND
   *  write for installers too (see `NotesPanel`, reused as-is on /jobs/[id]). */
  notes: QuoteNote[];
}

interface RawLineItem {
  id?: string;
  name?: string;
  quantity?: number;
}

function stripPricing(items: unknown): { name: string; quantity: number }[] {
  if (!Array.isArray(items)) return [];
  return (items as RawLineItem[]).map((item) => ({
    name: item.name ?? "",
    quantity: Number(item.quantity ?? 0),
  }));
}

interface LineItemRow {
  id: string;
  section: "extra" | "standard_additional" | "free_text";
  name: string | null;
  description: string | null;
  quantity: number;
}

function mapInstallerLineItemRow(row: LineItemRow): InstallerLineItem {
  return {
    id: row.id,
    name: row.section === "free_text" ? (row.description ?? "") : (row.name ?? ""),
    quantity: Number(row.quantity),
  };
}

/**
 * One job's full detail for an installer — equipment specs plus everything
 * `getInstallerJobs` already carries. Returns `undefined` if the quote
 * doesn't exist *or* isn't booked to this installer, so a guessed/foreign
 * quote id can't leak anything (same ownership check as `respondToJob`,
 * src/app/jobs/actions.ts).
 */
export async function getInstallerJobDetail(
  installerId: string,
  quoteId: string,
): Promise<InstallerJobDetail | undefined> {
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("quotes")
    .select(
      "id, customer_name, customer_email, customer_phone, customer_address_lines, address, postcode, product_type, reference, install_date, install_acceptance_status, installer_id, property_details",
    )
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    console.error("getInstallerJobDetail failed", error);
    return undefined;
  }
  if (!row || row.installer_id !== installerId || !row.install_date) return undefined;

  const job: InstallerJob = {
    quoteId: row.id,
    customerName: row.customer_name,
    address: row.address,
    postcode: row.postcode,
    productType: row.product_type,
    reference: row.reference,
    installDate: row.install_date,
    acceptanceStatus: row.install_acceptance_status,
  };

  const customer: CustomerDetails = {
    name: row.customer_name,
    email: row.customer_email ?? "",
    phone: row.customer_phone ?? "",
    addressLines: row.customer_address_lines ?? [],
  };

  const isBoiler = job.productType === "boiler";
  const property = isBoiler ? mapBoilerPropertyDetails(row.property_details) : mapSolarPropertyDetails(row.property_details);

  // Same three "what's included beyond the unit/array itself" sections the
  // admin/rep detail page shows (Extras/Standard Additionals/Free-text
  // Extras) — quantities and names only, no `unit_price` column selected.
  const [{ data: lineItemRows, error: lineItemsError }, { data: noteRows, error: notesError }, profiles] =
    await Promise.all([
      supabase
        .from("quote_line_items")
        .select("id, section, name, description, quantity, sort_order")
        .eq("quote_id", quoteId)
        .order("sort_order", { ascending: true }),
      supabase
        .from("quote_notes")
        .select("id, author_id, body, created_at")
        .eq("quote_id", quoteId)
        .order("created_at", { ascending: false }),
      getAllProfiles(),
    ]);

  if (lineItemsError) console.error("getInstallerJobDetail: line items failed", lineItemsError);
  if (notesError) console.error("getInstallerJobDetail: notes failed", notesError);

  const lineItemRowsTyped = (lineItemRows ?? []) as LineItemRow[];
  const extras = lineItemRowsTyped.filter((item) => item.section === "extra").map(mapInstallerLineItemRow);
  const standardAdditionals = lineItemRowsTyped
    .filter((item) => item.section === "standard_additional")
    .map(mapInstallerLineItemRow);
  const freeTextExtras = lineItemRowsTyped.filter((item) => item.section === "free_text").map(mapInstallerLineItemRow);

  const profileMap = buildProfileMap(profiles);
  const notes = (noteRows ?? []).map((noteRow) =>
    mapNoteRow(noteRow as { id: string; author_id: string | null; body: string; created_at: string }, profileMap),
  );

  const shared = { customer, property, extras, standardAdditionals, freeTextExtras, notes };

  if (isBoiler) {
    const { data: unitRows, error: unitsError } = await supabase
      .from("boiler_units")
      .select("id, label, make, model, output_kw, fuel_type, flue_type, install_type, cylinder_litres, warranty_years, items, sort_order")
      .eq("quote_id", quoteId)
      .order("sort_order", { ascending: true });

    if (unitsError) console.error("getInstallerJobDetail: boiler units failed", unitsError);

    const boilerUnits: InstallerBoilerUnit[] = (unitRows ?? []).map((unit) => ({
      id: unit.id,
      label: unit.label,
      make: unit.make,
      model: unit.model,
      outputKw: Number(unit.output_kw),
      fuelType: unit.fuel_type,
      flueType: unit.flue_type,
      installType: unit.install_type,
      cylinderLitres: unit.cylinder_litres != null ? Number(unit.cylinder_litres) : undefined,
      warrantyYears: unit.warranty_years,
      items: stripPricing(unit.items),
    }));

    return { ...job, ...shared, boilerUnits };
  }

  const { data: arrayRows, error: arraysError } = await supabase
    .from("solar_arrays")
    .select("id, label, shade_factor, orientation, pitch_degrees, items, sort_order")
    .eq("quote_id", quoteId)
    .order("sort_order", { ascending: true });

  if (arraysError) console.error("getInstallerJobDetail: solar arrays failed", arraysError);

  const solarArrays: InstallerSolarArray[] = (arrayRows ?? []).map((array) => ({
    id: array.id,
    label: array.label,
    shadeFactor: Number(array.shade_factor),
    orientation: array.orientation,
    pitchDegrees: Number(array.pitch_degrees),
    items: stripPricing(array.items),
  }));

  return { ...job, ...shared, solarArrays };
}
