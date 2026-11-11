import type { EasyPvCartLine, EasyPvRoof, EasyPvSummary } from "@/types/easypv";
import type { LineItem } from "@/types/quote-detail-shared";
import type { SolarEquipmentKind } from "@/types/solar-quote";
import { parsePanelWatts } from "@/lib/easypv-summary";

/**
 * Turns an Easy PV summary's priced cart into the quote's own structure:
 * one solar array per roof (its panels + that roof's mounting), one piece of
 * equipment per inverter / battery / optimiser, and everything else as
 * "extra" line items. Prices are Midsummer's cost plus the caller's markup.
 * Pure — the Server Action (importEasyPvItems in
 * src/components/quotes/easypv-actions.ts) does the database work.
 */

export interface ImportedArray {
  label: string;
  orientation: string;
  orientationDegrees?: number;
  pitchDegrees: number;
  moduleWp: number;
  moduleCount: number;
  items: Omit<LineItem, "id">[];
}

export interface ImportedEquipment {
  kind: SolarEquipmentKind;
  label: string;
  items: Omit<LineItem, "id">[];
}

export interface ImportPlan {
  arrays: ImportedArray[];
  equipment: ImportedEquipment[];
  extras: Omit<LineItem, "id">[];
  /** Sum of qty x Midsummer cost over everything imported (ex VAT) — goes in the Profit card's cost price. */
  costTotal: number;
  /** Panel/mounting lines no roof claimed, put in extras — shown to the rep as a heads-up. */
  unmatchedRoofItems: string[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Easy PV's orientation is degrees from south, signed: west = +90, south-east = -45. */
export function orientationLabel(signedDegrees: number | undefined): string {
  if (signedDegrees === undefined) return "";
  const abs = Math.abs(signedDegrees);
  const side = signedDegrees >= 0 ? "West" : "East";
  if (abs <= 22.5) return "South";
  if (abs <= 67.5) return `South-${side}`;
  if (abs <= 112.5) return side;
  if (abs <= 157.5) return `North-${side}`;
  return "North";
}

export function buildImportPlan(summary: EasyPvSummary, markupPct: number): ImportPlan {
  const cart = summary.cart ?? [];
  const factor = 1 + markupPct / 100;
  const toItem = (line: EasyPvCartLine, qty = line.qty): Omit<LineItem, "id"> => ({
    name: line.name,
    quantity: qty,
    unitPrice: round2(line.unitCost * factor),
  });

  // How much of each cart line has been placed on a roof, so the rest falls to "extras".
  const remaining = new Map(cart.map((line) => [line.name, line.qty]));
  const lineByName = new Map(cart.map((line) => [line.name, line]));
  const take = (name: string, qty: number): number => {
    const left = remaining.get(name) ?? 0;
    const used = Math.min(left, qty);
    remaining.set(name, left - used);
    return used;
  };

  const arrays: ImportedArray[] = summary.roofs.map((roof: EasyPvRoof, index) => {
    const items: Omit<LineItem, "id">[] = [];
    let moduleWp = 0;
    for (const roofItem of roof.items) {
      const line = lineByName.get(roofItem.name);
      if (!line) continue;
      // Panels and the mounting that rides on the roof; skip anything the cart classed otherwise.
      if (line.kind !== "panel" && line.kind !== "mounting") continue;
      const qty = take(line.name, roofItem.qty);
      if (qty > 0) items.push(toItem(line, qty));
      if (line.kind === "panel") moduleWp = parsePanelWatts(line.name) ?? moduleWp;
    }
    return {
      label: roof.label || `Roof ${index + 1}`,
      orientation: orientationLabel(roof.orientation),
      orientationDegrees: roof.orientation === undefined ? undefined : Math.min(180, Math.abs(roof.orientation)),
      pitchDegrees: roof.pitch ?? 0,
      moduleWp,
      moduleCount: roof.panelCount,
      items,
    };
  });

  const equipment: ImportedEquipment[] = [];
  const extras: Omit<LineItem, "id">[] = [];
  const unmatchedRoofItems: string[] = [];
  const equipmentKind: Partial<Record<EasyPvCartLine["kind"], SolarEquipmentKind>> = {
    inverter: "inverter",
    battery: "battery",
    optimiser: "optimiser",
  };

  for (const line of cart) {
    const qty = remaining.get(line.name) ?? 0;
    if (qty <= 0) continue;
    const kind = equipmentKind[line.kind];
    if (kind) {
      equipment.push({ kind, label: line.name, items: [toItem(line, qty)] });
      continue;
    }
    // Panels that weren't on any roof, or mounting no roof claimed — keep, but tell the rep.
    if (line.kind === "panel" || line.kind === "mounting") unmatchedRoofItems.push(line.name);
    extras.push(toItem(line, qty));
  }

  const costTotal = round2(cart.reduce((sum, line) => sum + line.qty * line.unitCost, 0));
  return { arrays, equipment, extras, costTotal, unmatchedRoofItems };
}
