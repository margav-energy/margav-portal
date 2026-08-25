import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InstallAcceptanceStatus } from "@/types/installer-availability";

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

export interface InstallerJobDetail extends InstallerJob {
  boilerUnits?: InstallerBoilerUnit[];
  solarArrays?: InstallerSolarArray[];
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
      "id, customer_name, address, postcode, product_type, reference, install_date, install_acceptance_status, installer_id",
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

  if (job.productType === "boiler") {
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

    return { ...job, boilerUnits };
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

  return { ...job, solarArrays };
}
