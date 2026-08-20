/**
 * Pure calculation over the boiler install cost figures an admin maintains
 * at Settings → Boiler Install Costs (see
 * `src/data/boiler-cost-settings-service.ts` for the DB-backed read/write —
 * this file has no I/O of its own, so it stays trivially testable).
 *
 * These are Margav's real, definitive install costs — the Profit card's
 * cost price for a boiler quote *is* this number, not an editable estimate.
 * Never render these figures anywhere a customer sees — the e-signature
 * PDF, the presenter deck, and outbound emails all intentionally have no
 * path to `ProfitBreakdown`; keep it that way.
 *
 * Only the boiler unit itself varies by size — the rest (filter, gateway,
 * installer, cost per sale, commission) are flat regardless of kW, which is
 * what makes margin shrink as the boiler gets bigger against Margav's fixed
 * £4,995 sell price.
 */

export interface BoilerCostSettings {
  /** Boiler unit cost by output (kW), e.g. `{ 24: 771.50, 30: 834.00, 36: 928.00 }`. */
  unitCostsByKw: Record<number, number>;
  fernoxSystemFilter: number;
  gatewayWithComfortTouch: number;
  installerCost: number;
  costPerSale: number;
  commission: number;
}

/** Seed values (also written by the migration) — used if the settings row is ever missing so a quote can still price. */
export const DEFAULT_BOILER_COST_SETTINGS: BoilerCostSettings = {
  unitCostsByKw: { 24: 771.5, 30: 834.0, 36: 928.0 },
  fernoxSystemFilter: 52.0,
  gatewayWithComfortTouch: 134.5,
  installerCost: 700.0,
  costPerSale: 300.0,
  commission: 300.0,
};

function fixedInstallTotal(settings: BoilerCostSettings): number {
  return (
    settings.fernoxSystemFilter +
    settings.gatewayWithComfortTouch +
    settings.installerCost +
    settings.costPerSale +
    settings.commission
  );
}

/**
 * Nearest defined tier to `outputKw` — handles boiler sizes outside the
 * admin-configured list (e.g. a 27kW unit logged against a quote) without
 * throwing, since a boiler of any make/model can be logged and this must
 * never block saving one. Exact matches always win.
 */
function nearestUnitCost(outputKw: number, unitCostsByKw: Record<number, number>): number {
  const tiers = Object.keys(unitCostsByKw).map(Number);
  if (tiers.length === 0) return 0;
  const closest = tiers.reduce((best, kw) => (Math.abs(kw - outputKw) < Math.abs(best - outputKw) ? kw : best));
  return unitCostsByKw[closest];
}

/** Total real cost of installing one boiler unit: its own unit cost (by kW) plus every flat per-install cost. */
export function boilerUnitInstallCost(outputKw: number, settings: BoilerCostSettings): number {
  return nearestUnitCost(outputKw, settings.unitCostsByKw) + fixedInstallTotal(settings);
}

/**
 * The boiler quote's cost price — the sum of each boiler unit's real
 * install cost. The overwhelming majority of quotes have exactly one
 * boiler unit; the rare multi-unit property (e.g. an annexe needing its
 * own boiler) is treated as two full installs, since each genuinely needs
 * its own filter/gateway/installer visit/commission.
 */
export function boilerCostPrice(outputKws: number[], settings: BoilerCostSettings): number {
  return outputKws.reduce((sum, kw) => sum + boilerUnitInstallCost(kw, settings), 0);
}
