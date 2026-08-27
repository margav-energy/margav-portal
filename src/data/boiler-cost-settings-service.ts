import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_BOILER_COST_SETTINGS, type BoilerCostSettings } from "@/lib/boiler-install-cost";

/**
 * Reads/writes the single admin-editable row backing the boiler Profit
 * card's cost price (see `src/lib/boiler-install-cost.ts` for the
 * calculation itself, and `src/app/settings/boiler-costs` for the admin UI).
 * `boiler_cost_settings` is a singleton table — there's exactly one row.
 */

interface BoilerCostSettingsRow {
  unit_costs_by_kw: unknown;
  fernox_system_filter: number | string;
  gateway_comfort_touch: number | string;
  standard_flue: number | string;
  installer_cost: number | string;
  cost_per_sale: number | string;
  commission: number | string;
  extra_costs_by_name: unknown;
}

const COLUMNS =
  "unit_costs_by_kw, fernox_system_filter, gateway_comfort_touch, standard_flue, installer_cost, cost_per_sale, commission, extra_costs_by_name";

function parseUnitCosts(raw: unknown): Record<number, number> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<number, number> = {};
  for (const [kw, cost] of Object.entries(raw as Record<string, unknown>)) {
    const kwNumber = Number(kw);
    const costNumber = Number(cost);
    if (Number.isFinite(kwNumber) && Number.isFinite(costNumber)) result[kwNumber] = costNumber;
  }
  return result;
}

/** Same shape as `parseUnitCosts` but string-keyed (an Extras catalog entry name, not a kW tier) — no numeric coercion on the key. */
function parseExtraCosts(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const result: Record<string, number> = {};
  for (const [name, cost] of Object.entries(raw as Record<string, unknown>)) {
    const costNumber = Number(cost);
    if (name && Number.isFinite(costNumber)) result[name] = costNumber;
  }
  return result;
}

function mapRow(row: BoilerCostSettingsRow): BoilerCostSettings {
  return {
    unitCostsByKw: parseUnitCosts(row.unit_costs_by_kw),
    fernoxSystemFilter: Number(row.fernox_system_filter),
    gatewayWithComfortTouch: Number(row.gateway_comfort_touch),
    standardFlue: Number(row.standard_flue),
    installerCost: Number(row.installer_cost),
    costPerSale: Number(row.cost_per_sale),
    commission: Number(row.commission),
    extraCostsByName: parseExtraCosts(row.extra_costs_by_name),
  };
}

/** Falls back to `DEFAULT_BOILER_COST_SETTINGS` if the row is missing (e.g. migration not yet run) so pricing a quote never hard-fails. */
export async function getBoilerCostSettings(): Promise<BoilerCostSettings> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("boiler_cost_settings").select(COLUMNS).eq("id", true).maybeSingle();

  if (error || !data) {
    if (error) console.error("getBoilerCostSettings failed", error);
    return DEFAULT_BOILER_COST_SETTINGS;
  }

  return mapRow(data as BoilerCostSettingsRow);
}

export async function updateBoilerCostSettings(
  settings: BoilerCostSettings,
  updatedBy: string | undefined,
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("boiler_cost_settings")
    .update({
      unit_costs_by_kw: Object.fromEntries(
        Object.entries(settings.unitCostsByKw).map(([kw, cost]) => [String(kw), cost]),
      ),
      fernox_system_filter: settings.fernoxSystemFilter,
      gateway_comfort_touch: settings.gatewayWithComfortTouch,
      standard_flue: settings.standardFlue,
      installer_cost: settings.installerCost,
      cost_per_sale: settings.costPerSale,
      commission: settings.commission,
      extra_costs_by_name: settings.extraCostsByName,
      updated_at: new Date().toISOString(),
      updated_by: updatedBy ?? null,
    })
    .eq("id", true);

  if (error) {
    console.error("updateBoilerCostSettings failed", error);
    return false;
  }
  return true;
}
