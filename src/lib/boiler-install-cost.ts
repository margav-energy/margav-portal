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
 * The boiler unit itself varies by size; Fernox Filter, the Gateway, and
 * the standard flue are flat per install regardless of kW (every boiler
 * install gets exactly one of each, whether or not a rep itemizes them as
 * an Extras line on the quote — see `fixedInstallTotal`), which is what
 * makes margin shrink as the boiler gets bigger against Margav's fixed
 * `DEFAULT_BOILER_SELL_PRICE`. `extraCostsByName`, unlike those, only
 * counts for a given quote when the matching Extras catalog entry is
 * actually on it — see `boilerCostPrice`.
 */

/**
 * The sell price a boiler unit is entered at regardless of its size (see
 * `BoilerUnitsSection.tsx`'s "Price (£)" field, which defaults new units to
 * this) — margin comes entirely from the cost side shrinking/growing with
 * output, not from charging more for a bigger unit. Still a plain editable
 * number on the unit, not enforced — this is just the right default.
 */
export const DEFAULT_BOILER_SELL_PRICE = 4995;

export interface BoilerCostSettings {
  /** Boiler unit cost by output (kW), e.g. `{ 24: 810.36, 30: 875.36, 36: 973.12 }`. */
  unitCostsByKw: Record<number, number>;
  fernoxSystemFilter: number;
  gatewayWithComfortTouch: number;
  /** The standard 60/100 flue every boiler install gets — same "always counted" treatment as the two costs above. */
  standardFlue: number;
  installerCost: number;
  costPerSale: number;
  commission: number;
  /**
   * Real supplier cost for specific "Extras" catalog entries
   * (`src/lib/extras-catalog.ts`) that are genuinely optional per job —
   * e.g. `{ "Roof kit": 87.36, "Gas run per metre": 35.88, "Flue extension
   * per metre": 35.88 }` — keyed by the catalog entry's exact `name`.
   * Unlike the fixed per-install costs above, these only contribute to a
   * quote's cost price when that extra is actually on the quote (scaled by
   * its quantity) — a job with no roof kit shouldn't be costed as if it had
   * one. Any extra not listed here (a free-text extra, or a catalog entry
   * with no tracked cost) contributes nothing.
   */
  extraCostsByName: Record<string, number>;
}

/** Seed values (also written by the migration) — used if the settings row is ever missing so a quote can still price. */
export const DEFAULT_BOILER_COST_SETTINGS: BoilerCostSettings = {
  unitCostsByKw: { 24: 810.36, 30: 875.36, 36: 973.12 },
  fernoxSystemFilter: 93.6,
  gatewayWithComfortTouch: 139.88,
  standardFlue: 54.08,
  installerCost: 700.0,
  costPerSale: 300.0,
  commission: 300.0,
  extraCostsByName: {
    "Roof kit": 87.36,
    "Gas run per metre": 35.88,
    "Flue extension per metre": 35.88,
  },
};

function fixedInstallTotal(settings: BoilerCostSettings): number {
  return (
    settings.fernoxSystemFilter +
    settings.gatewayWithComfortTouch +
    settings.standardFlue +
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

/** Real cost of the optional extras actually on the quote — only entries with a tracked cost (`extraCostsByName`) count, scaled by quantity; anything else (free-text, an untracked catalog entry) is £0. */
function extrasInstallCost(extras: { name: string; quantity: number }[], settings: BoilerCostSettings): number {
  return extras.reduce((sum, extra) => sum + (settings.extraCostsByName[extra.name] ?? 0) * extra.quantity, 0);
}

/**
 * The boiler quote's cost price — the sum of each boiler unit's real
 * install cost (the overwhelming majority of quotes have exactly one; the
 * rare multi-unit property, e.g. an annexe needing its own boiler, is
 * treated as two full installs, since each genuinely needs its own filter/
 * gateway/flue/installer visit/commission) plus the real cost of whichever
 * optional extras are actually on the quote.
 */
export function boilerCostPrice(
  outputKws: number[],
  extras: { name: string; quantity: number }[],
  settings: BoilerCostSettings,
): number {
  const unitsCost = outputKws.reduce((sum, kw) => sum + boilerUnitInstallCost(kw, settings), 0);
  return unitsCost + extrasInstallCost(extras, settings);
}
