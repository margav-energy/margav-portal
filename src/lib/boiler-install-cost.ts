/**
 * Pure calculation over the boiler install cost figures an admin maintains
 * at Settings → Boiler Install Costs (see
 * `src/data/boiler-cost-settings-service.ts` for the DB-backed read/write —
 * this file has no I/O of its own, so it stays trivially testable).
 *
 * These are Margav's real, definitive install costs — the Profit card's
 * Cost price and Profit/Margin for a boiler quote *are* these numbers, not
 * an editable estimate (Cost price shows `materialsCost`; Profit/Margin
 * derive from the full `total` — see `BoilerCostBreakdown`). Never render
 * these figures anywhere a customer sees — the e-signature PDF, the
 * presenter deck, and outbound emails all intentionally have no path to
 * `ProfitBreakdown`; keep it that way.
 *
 * The boiler unit itself varies by size; Fernox Filter, the Gateway, the
 * standard flue, Installer Cost, and Rep Comms are flat per install
 * regardless of kW (every boiler install gets exactly one of each, whether
 * or not a rep itemizes them as an Extras line on the quote — see
 * `flatInstallLineItems`), which is what makes margin shrink as the boiler
 * gets bigger against Margav's fixed `DEFAULT_BOILER_SELL_PRICE`. A quote's
 * "Extras" (Roof kit, Gas run per metre, ...) never factor in here at all —
 * they're priced individually on the Pricing card instead (their sell
 * price is revenue, not a cost to weigh against margin), and the Profit
 * card only ever shows these six rows: Cost price, Installer Cost, Rep
 * Comms, Sell price, Profit, Margin.
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
   * (`src/lib/extras-catalog.ts`) — e.g. `{ "Roof kit": 87.36, "Gas run per
   * metre": 35.88, "Flue extension per metre": 35.88 }` — keyed by the
   * catalog entry's exact `name`. Not currently read anywhere: Extras are
   * priced on the Pricing card, not the Profit card (see this file's
   * top-of-file doc comment) — kept here in case that changes.
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
  /**
   * "materials" — the boiler unit itself, flue, Fernox Filter, Gateway —
   * sums to `materialsCost`, what the Profit card shows as "Cost price".
   * "extra" — Installer Cost and Rep Comms — real costs too, but broken
   * out as their own rows rather than folded into "Cost price", so the
   * figure a rep can eyeball against "unit + flue + filter + gateway"
   * always matches. Both categories count toward `total`, which is what
   * Profit/Margin actually derive from (see ProfitCard.tsx).
   */
  category: "materials" | "extra";
}

export interface BoilerCostBreakdown {
  /** Ordered: each boiler unit's own cost, then the flat per-install
   *  items — sums exactly to `total`, so the Profit card can render this
   *  list directly instead of just a single number. */
  lineItems: BoilerCostLineItem[];
  total: number;
  /** Sum of just the `"materials"` line items — see `BoilerCostLineItem`. */
  materialsCost: number;
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
    {
      name: 'Horizontal "Standard" 60/100 Flue w/Terminal (1000mm)',
      amount: settings.standardFlue * unitCount,
      category: "materials",
    },
    { name: "Fernox System Filter", amount: settings.fernoxSystemFilter * unitCount, category: "materials" },
    { name: "Gateway with Smart Touch", amount: settings.gatewayWithComfortTouch * unitCount, category: "materials" },
    { name: "Installer Cost", amount: settings.installerCost * unitCount, category: "extra" },
    { name: "Rep Comms", amount: settings.commission * unitCount, category: "extra" },
  ];
}

/**
 * The boiler quote's full cost breakdown — each boiler unit's own real
 * install cost (unit cost by kW) plus the flat per-install items. `total`
 * is what Profit/Margin derive from; `lineItems` is the same figure broken
 * out for display, in the same order. Deliberately takes no `extras` — a
 * quote's Extras are never costed here at all, see this file's top-of-file
 * doc comment.
 */
export function boilerCostBreakdown(
  units: { outputKw: number; make: string; model: string }[],
  settings: BoilerCostSettings,
): BoilerCostBreakdown {
  const unitLineItems: BoilerCostLineItem[] = units.map((unit) => ({
    name: unit.make && unit.model ? `${unit.make} ${unit.model}` : `${unit.outputKw}kW boiler unit`,
    amount: nearestUnitCost(unit.outputKw, settings.unitCostsByKw),
    category: "materials",
  }));

  const lineItems = [...unitLineItems, ...flatInstallLineItems(units.length, settings)];

  return {
    lineItems,
    total: lineItems.reduce((sum, item) => sum + item.amount, 0),
    materialsCost: lineItems
      .filter((item) => item.category === "materials")
      .reduce((sum, item) => sum + item.amount, 0),
  };
}
