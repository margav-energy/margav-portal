"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/current-user";
import { updateBoilerCostSettings } from "@/data/boiler-cost-settings-service";
import { logActivity } from "@/lib/activity";
import type { BoilerCostSettings } from "@/lib/boiler-install-cost";

export interface BoilerCostSettingsFormState {
  error?: string;
  success?: boolean;
}

/**
 * Parses the repeated `unitKw`/`unitCost` inputs (one pair per boiler size
 * row — see `BoilerCostSettingsForm`) into the map `boilerCostPrice` reads.
 * Blank rows (a size the admin started typing then abandoned) are skipped
 * rather than rejected, so removing a row's text has the same effect as
 * clicking its remove button.
 */
function parseUnitCosts(formData: FormData): { unitCostsByKw: Record<number, number>; error?: string } {
  const kwValues = formData.getAll("unitKw").map(String);
  const costValues = formData.getAll("unitCost").map(String);
  const unitCostsByKw: Record<number, number> = {};

  for (let i = 0; i < kwValues.length; i++) {
    const kwRaw = kwValues[i]?.trim();
    const costRaw = costValues[i]?.trim();
    if (!kwRaw && !costRaw) continue;

    const kw = Number(kwRaw);
    const cost = Number(costRaw);
    if (!kwRaw || !Number.isFinite(kw) || kw <= 0) {
      return { unitCostsByKw, error: `"${kwRaw || "(blank)"}" isn't a valid boiler size in kW.` };
    }
    if (!costRaw || !Number.isFinite(cost) || cost < 0) {
      return { unitCostsByKw, error: `Enter a valid cost for the ${kwRaw}kW boiler.` };
    }
    unitCostsByKw[kw] = cost;
  }

  if (Object.keys(unitCostsByKw).length === 0) {
    return { unitCostsByKw, error: "Add at least one boiler size." };
  }

  return { unitCostsByKw };
}

function parseNonNegativeNumber(formData: FormData, field: string, label: string): number | { error: string } {
  const raw = String(formData.get(field) ?? "").trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0) {
    return { error: `Enter a valid ${label}.` };
  }
  return value;
}

export async function updateBoilerCostSettingsAction(
  _prevState: BoilerCostSettingsFormState,
  formData: FormData,
): Promise<BoilerCostSettingsFormState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { error: "Only admins can edit boiler install costs." };
  }

  const { unitCostsByKw, error: unitCostsError } = parseUnitCosts(formData);
  if (unitCostsError) return { error: unitCostsError };

  const fernoxSystemFilter = parseNonNegativeNumber(formData, "fernoxSystemFilter", "Fernox System Filter cost");
  if (typeof fernoxSystemFilter !== "number") return fernoxSystemFilter;

  const gatewayWithComfortTouch = parseNonNegativeNumber(
    formData,
    "gatewayWithComfortTouch",
    "Gateway with Comfort Touch cost",
  );
  if (typeof gatewayWithComfortTouch !== "number") return gatewayWithComfortTouch;

  const installerCost = parseNonNegativeNumber(formData, "installerCost", "Installer cost");
  if (typeof installerCost !== "number") return installerCost;

  const costPerSale = parseNonNegativeNumber(formData, "costPerSale", "Cost per sale");
  if (typeof costPerSale !== "number") return costPerSale;

  const commission = parseNonNegativeNumber(formData, "commission", "Commission");
  if (typeof commission !== "number") return commission;

  const settings: BoilerCostSettings = {
    unitCostsByKw,
    fernoxSystemFilter,
    gatewayWithComfortTouch,
    installerCost,
    costPerSale,
    commission,
  };

  const ok = await updateBoilerCostSettings(settings, user.id);
  if (!ok) return { error: "Could not save these figures. Please try again." };

  await logActivity({
    actorId: user.id,
    customerName: "Boiler install costs",
    description: `${user.firstName ?? "Someone"} updated the boiler install cost figures`,
    status: "allocated",
    entityType: "settings",
    entityId: "boiler-cost-settings",
  });

  // Every open boiler quote's Profit card reads these figures, so a price
  // change should show up immediately rather than after their next reload.
  revalidatePath("/settings/boiler-costs");
  revalidatePath("/quotes", "layout");

  return { success: true };
}
