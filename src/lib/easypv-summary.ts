import type { EasyPvCartLine, EasyPvComponent, EasyPvLineKind, EasyPvSummary } from "@/types/easypv";

/**
 * Turns Easy PV's `GET /projects/data` response into the small summary we
 * store on the quote. Pure (no server-only imports) so it's easy to test
 * against a saved response. Every field is read defensively — Easy PV's
 * payload is large and some fields are absent on older projects.
 */

type Json = Record<string, unknown>;

function asArray(value: unknown): Json[] {
  return Array.isArray(value) ? (value as Json[]) : [];
}

function toComponents(value: unknown): EasyPvComponent[] {
  return asArray(value)
    .map((item) => ({ name: String(item.name ?? ""), qty: Number(item.qty ?? 0) }))
    .filter((item) => item.name && item.qty > 0);
}

/** "...465W Dual Glass..." → 465. */
export function parsePanelWatts(name: string): number | undefined {
  const match = name.match(/(\d{3,4})\s*W\b/i);
  return match ? Number(match[1]) : undefined;
}

/** "Fox ESS EP5-H 4.66kWh Battery" → 4.66. */
export function parseBatteryKwh(name: string): number | undefined {
  const match = name.match(/(\d+(?:\.\d+)?)\s*kWh/i);
  return match ? Number(match[1]) : undefined;
}

const COMPONENT_KIND: Record<string, EasyPvLineKind> = {
  panels: "panel",
  inverters: "inverter",
  batteries: "battery",
  optimisers: "optimiser",
  ACisolators: "electrical",
  DCisolators: "electrical",
  meters: "electrical",
};

function classifyCart(data: Json): EasyPvCartLine[] {
  const projectData = (data.projectData ?? {}) as Json;
  const components = (data.projectComponents ?? {}) as Record<string, Json>;
  const bom = (data.billOfMaterials ?? {}) as Json;
  // The bill of materials lists every item by the same name the cart uses, grouped by type. That's more
  // reliable than the cart's component UUIDs, which Easy PV doesn't set on projects last saved before 10 Feb 2026.
  const namesIn = (key: string) => new Set(asArray(bom[key]).map((item) => String(item.name)));
  const byBomName: [Set<string>, EasyPvLineKind][] = [
    [namesIn("panels"), "panel"],
    [namesIn("inverters"), "inverter"],
    [namesIn("batteries"), "battery"],
    [namesIn("mounting"), "mounting"],
    [namesIn("electrical"), "electrical"],
  ];

  return asArray(projectData.cart)
    .map((line): EasyPvCartLine => {
      const name = String(line.name ?? "");
      const component = typeof line.UUID === "string" ? components[line.UUID] : undefined;
      let kind: EasyPvLineKind = byBomName.find(([names]) => names.has(name))?.[1] ?? "other";
      if (kind === "other" && component) kind = COMPONENT_KIND[String(component.componentType)] ?? "other";
      return { name, qty: Number(line.qty ?? 0), unitCost: Number(line.item ?? 0), kind };
    })
    .filter((line) => line.name && line.qty > 0);
}

export function summariseProjectData(data: Json): EasyPvSummary {
  const projectData = (data.projectData ?? {}) as Json;
  const bom = (data.billOfMaterials ?? {}) as Json;

  const panels = toComponents(bom.panels);
  const inverters = toComponents(bom.inverters);
  const batteries = toComponents(bom.batteries);

  let kwp = 0;
  for (const panel of panels) {
    const watts = parsePanelWatts(panel.name);
    if (watts) kwp += (watts * panel.qty) / 1000;
  }
  let kwh = 0;
  for (const battery of batteries) {
    const size = parseBatteryKwh(battery.name);
    if (size) kwh += size * battery.qty;
  }

  const cart = asArray(projectData.cart);
  const materialsTotal = cart.reduce((sum, line) => sum + Number(line.line ?? 0), 0);

  return {
    projectName: String(projectData.projectName ?? ""),
    status: String(projectData.status ?? ""),
    panels,
    inverters,
    batteries,
    roofs: asArray(data.projectRoofs).map((roof) => {
      const roofBom = asArray(roof.billOfMaterials);
      return {
        label: String(roof.label ?? ""),
        orientation: typeof roof.orientation === "number" ? roof.orientation : undefined,
        pitch: typeof roof.pitch === "number" ? roof.pitch : undefined,
        mountingType: roof.mountingType ? String(roof.mountingType) : undefined,
        // Only panels carry a uuid in a roof's BOM (clamps/rails/hooks don't).
        panelCount: roofBom
          .filter((item) => item.uuid)
          .reduce((sum, item) => sum + Number(item.qty ?? 0), 0),
        items: roofBom
          .map((item) => ({ name: String(item.name ?? ""), qty: Number(item.qty ?? 0), isPanel: Boolean(item.uuid) }))
          .filter((item) => item.name && item.qty > 0),
      };
    }),
    systemKwp: kwp > 0 ? Math.round(kwp * 100) / 100 : undefined,
    batteryKwh: kwh > 0 ? Math.round(kwh * 100) / 100 : undefined,
    materialsTotal: Math.round(materialsTotal * 100) / 100,
    cart: classifyCart(data),
    otherItems: [...toComponents(bom.mounting), ...toComponents(bom.electrical)],
    midsummerOrderLink: projectData.midsummerOrderLink ? String(projectData.midsummerOrderLink) : undefined,
    modifiedAt: projectData.dateModified ? String(projectData.dateModified) : undefined,
  };
}
