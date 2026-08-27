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
 * The boiler unit itself varies by size; Fernox Filter, the Gateway, the
 * standard flue, Installer Cost, and Rep Comms are flat per install
 * regardless of kW (every boiler install gets exactly one of each, whether
 * or not a rep itemizes them as an Extras line on the quote — see
 * `flatInstallLineItems`), which is what makes margin shrink as the boiler
 * gets bigger against Margav's fixed `DEFAULT_BOILER_SELL_PRICE`.
 * `extraCostsByName`, unlike those, only counts for a given quote when the
 * matching Extras catalog entry is actually on it — see
 * `boilerCostBreakdown`.
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
  /** The rep's payout on the sale — shown as "Rep Comms" on the Profit card. */
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
  commission: 300.0,
  extraCostsByName: {
    "Roof kit": 87.36,
    "Gas run per metre": 35.88,
    "Flue extension per metre": 35.88,
  },
};

export interface BoilerCostLineItem {
  name: string;
  amount: number;
}

export interface BoilerCostBreakdown {
  /** Ordered: each boiler unit's own cost, then the flat per-install
   *  items, then whichever optional extras are actually costed — sums
   *  exactly to `total`, so the Profit card can render this list directly
   *  instead of just a single number. */
  lineItems: BoilerCostLineItem[];
  total: number;
}

/**
 * Which of `boilerCostBreakdown`'s line items the Profit card actually
 * breaks out on screen — everything else (the boiler unit itself, flue,
 * Fernox Filter, Gateway, extras) still contributes to `total`, just isn't
 * itemized individually there (see ProfitCard.tsx).
 */
export const VISIBLE_COST_LINE_ITEM_NAMES = ["Installer Cost", "Rep Comms"];

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

/**
 * The flat per-install costs, each its own named line item — every boiler
 * install gets exactly one of each, scaled by how many units are actually
 * on the quote (the rare multi-unit property, e.g. an annexe needing its
 * own boiler, genuinely needs its own filter/gateway/flue/installer visit/
 * commission per unit, not one shared set).
 */
function flatInstallLineItems(unitCount: number, settings: BoilerCostSettings): BoilerCostLineItem[] {
  if (unitCount === 0) return [];
  return [
    { name: 'Horizontal "Standard" 60/100 Flue w/Terminal (1000mm)', amount: settings.standardFlue * unitCount },
    { name: "Fernox System Filter", amount: settings.fernoxSystemFilter * unitCount },
    { name: "Gateway with Smart Touch", amount: settings.gatewayWithComfortTouch * unitCount },
    { name: "Installer Cost", amount: settings.installerCost * unitCount },
    { name: "Rep Comms", amount: settings.commission * unitCount },
  ];
}

/** Real cost of the optional extras actually on the quote, as named line items — only entries with a tracked cost (`extraCostsByName`) count, scaled by quantity; anything else (free-text, an untracked catalog entry) contributes no row at all. */
function extrasLineItems(extras: { name: string; quantity: number }[], settings: BoilerCostSettings): BoilerCostLineItem[] {
  return extras
    .map((extra) => ({ name: extra.name, amount: (settings.extraCostsByName[extra.name] ?? 0) * extra.quantity }))
    .filter((item) => item.amount > 0);
}

/**
 * The boiler quote's full cost breakdown — each boiler unit's own real
 * install cost (unit cost by kW), the flat per-install items, and whichever
 * optional extras are actually on the quote. `total` is what the Profit
 * card's "Cost price" shows; `lineItems` is the same figure broken out for
 * display, in the same order.
 */
export function boilerCostBreakdown(
  units: { outputKw: number; make: string; model: string }[],
  extras: { name: string; quantity: number }[],
  settings: BoilerCostSettings,
): BoilerCostBreakdown {
  const unitLineItems = units.map((unit) => ({
    name: unit.make && unit.model ? `${unit.make} ${unit.model}` : `${unit.outputKw}kW boiler unit`,
    amount: nearestUnitCost(unit.outputKw, settings.unitCostsByKw),
  }));

  const lineItems = [
    ...unitLineItems,
    ...flatInstallLineItems(units.length, settings),
    ...extrasLineItems(extras, settings),
  ];

  return { lineItems, total: lineItems.reduce((sum, item) => sum + item.amount, 0) };
}
