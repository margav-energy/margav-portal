/**
 * Margav's own costs of fitting a solar system, folded into the Profit card's cost price (see `ProfitCard`)
 * on top of the materials figure — a rep-entered cost price, or the Easy PV import's cost total.
 * Pure calculation, no I/O. Never render these anywhere a customer sees (same rule as boiler-install-cost.ts).
 */

/** Paid to the installer for each panel fitted. */
export const SOLAR_INSTALLER_COST_PER_PANEL = 40;
/** Flat electrician cost for every solar install. */
export const SOLAR_ELECTRICIAN_COST = 1000;
export type SolarCostLineItem = { name: string; amount: number; category: "extra" };

/**
 * The solar cost lines for a quote, in display order: installer cost follows the panel count, electricians is flat.
 * Scaffolding is not a cost here — it is charged to the customer as a "Scaffolding (per elevation)" Standard additional.
 * Empty when there's nothing to install yet.
 */
export function solarInstallCostLineItems(arrays: { moduleCount: number }[]): SolarCostLineItem[] {
  const panels = arrays.reduce((sum, array) => sum + Math.max(0, array.moduleCount), 0);
  if (panels === 0) return [];

  return [
    { name: `Installer Cost (${panels} × £${SOLAR_INSTALLER_COST_PER_PANEL})`, amount: panels * SOLAR_INSTALLER_COST_PER_PANEL, category: "extra" },
    { name: "Electricians", amount: SOLAR_ELECTRICIAN_COST, category: "extra" },
  ];
}

export function sumCostLineItems(items: { amount: number }[]): number {
  return items.reduce((sum, item) => sum + item.amount, 0);
}
