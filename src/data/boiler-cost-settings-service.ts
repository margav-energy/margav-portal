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
  installer_cost: number | string;
  cost_per_sale: number | string;
  commission: number | string;
}

const COLUMNS =
  "unit_costs_by_kw, fernox_system_filter, gateway_comfort_touch, installer_cost, cost_per_sale, commission";

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

function mapRow(row: BoilerCostSettingsRow): BoilerCostSettings {
  return {
    unitCostsByKw: parseUnitCosts(row.unit_costs_by_kw),
    fernoxSystemFilter: Number(row.fernox_system_filter),
    gatewayWithComfortTouch: Number(row.gateway_comfort_touch),
    installerCost: Number(row.installer_cost),
    costPerSale: Number(row.cost_per_sale),
    commission: Number(row.commission),
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
      installer_cost: settings.installerCost,
      cost_per_sale: settings.costPerSale,
      commission: settings.commission,
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
