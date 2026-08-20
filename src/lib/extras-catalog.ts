/**
 * Named catalog for the quote detail's "Extras" section (boiler + solar
 * both use it via `LineItemsSection`'s optional `catalog` prop) — reps pick
 * from this list instead of only free-typing a name, per the naming/pricing
 * rules Margav gave for the boiler product line.
 */
export interface ExtraCatalogEntry {
  name: string;
  defaultUnitPrice: number;
  /** Always £0 — shown struck through rather than editable. */
  lockedPrice?: boolean;
}

export const EXTRAS_CATALOG: ExtraCatalogEntry[] = [
  /** Worth £120, but included at no extra charge — shown struck through, charged as £0. */
  { name: "Gateway with Comfort Touch", defaultUnitPrice: 120, lockedPrice: true },
  /** £150 one-off — quantity stays 1. */
  { name: "Roof kit", defaultUnitPrice: 150 },
  /** £55 per metre — quantity is the number of metres. */
  { name: "Gas run per metre", defaultUnitPrice: 55 },
  /** £100 per metre (vertical flue) — quantity is the number of metres. */
  { name: "Flue extension per metre", defaultUnitPrice: 100 },
  /** £500 one-off — quantity stays 1. Independent of the two "Extra ... installation" entries below — a quote can carry any combination of these three. */
  { name: "Relocation", defaultUnitPrice: 500 },
  { name: "Extra half-day installation", defaultUnitPrice: 0 },
  { name: "Extra full-day installation", defaultUnitPrice: 0 },
];

export function findCatalogEntry(name: string): ExtraCatalogEntry | undefined {
  return EXTRAS_CATALOG.find((entry) => entry.name === name);
}
