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
  /** At most one entry from the same group can be on a quote at once. */
  group?: string;
}

export const INSTALLATION_ALTERNATIVE_GROUP = "installation-alternative";

export const EXTRAS_CATALOG: ExtraCatalogEntry[] = [
  { name: "Gateway with Comfort Touch", defaultUnitPrice: 0, lockedPrice: true },
  { name: "Roof kit", defaultUnitPrice: 0 },
  { name: "Gas run", defaultUnitPrice: 0 },
  { name: "Flue extension", defaultUnitPrice: 0 },
  { name: "Relocation", defaultUnitPrice: 0, group: INSTALLATION_ALTERNATIVE_GROUP },
  { name: "Extra half-day installation", defaultUnitPrice: 0, group: INSTALLATION_ALTERNATIVE_GROUP },
  { name: "Extra full-day installation", defaultUnitPrice: 0, group: INSTALLATION_ALTERNATIVE_GROUP },
];

export function findCatalogEntry(name: string): ExtraCatalogEntry | undefined {
  return EXTRAS_CATALOG.find((entry) => entry.name === name);
}
