import type { LineItem } from "@/types/quote-detail-shared";

/**
 * Best-effort reads of what an existing solar array already says, so quotes
 * made before the MCS inputs existed don't have to be retyped. Anything read
 * this way is flagged on the MCS estimate for someone to confirm.
 */

/**
 * Orientation text such as "0° South" or "90° South" (the portal's own
 * convention: degrees from due south) → degrees from south, 0–180. Falls back
 * to plain compass words ("South", "South-East", …). Returns undefined if it
 * can't tell.
 */
export function parseOrientationDegrees(text: string): number | undefined {
  const value = text.trim().toLowerCase();
  if (!value) return undefined;

  // The direction word may come before or after the number ("45° North", "North 45°").
  // Only a number written as a degree value counts ("45°", "45 deg", "45 degrees"), or the whole text being a bare number — so "Roof 2 South" isn't read as 2°.
  const withDegrees = /(\d+(?:\.\d+)?)\s*(?:°|º|deg)/.exec(value) ?? /^(\d+(?:\.\d+)?)\s*(?:south|north|east|west)?$/.exec(value);
  if (withDegrees) {
    const degrees = Number(withDegrees[1]);
    if (Number.isFinite(degrees) && degrees <= 360) {
      const fromSouth = /\bnorth\b/.test(value) ? 180 - degrees : degrees;
      return Math.min(180, Math.max(0, fromSouth));
    }
  }

  const compass: [RegExp, number][] = [
    [/\bnorth[\s-]*(east|west)|\bn[\s-]*(e|w)\b/, 135],
    [/\bsouth[\s-]*(east|west)|\bs[\s-]*(e|w)\b/, 45],
    [/\b(east|west|e|w)\b/, 90],
    [/\bnorth|\bn\b/, 180],
    [/\bsouth|\bs\b/, 0],
  ];
  return compass.find(([pattern]) => pattern.test(value))?.[1];
}

const NOT_A_MODULE = /inverter|optimi[sz]er|battery|charger|micro/i;

/**
 * Finds the module line item — a name ending in a watt rating like
 * "AIKO Neostar 3S 485w" — and returns its rating and quantity. "5kw"
 * inverters and the like don't match: a rating is 3–4 digits straight
 * before "w".
 */
export function parseModuleFromItems(items: LineItem[]): { wp: number; count: number; itemName: string } | undefined {
  for (const item of items) {
    if (NOT_A_MODULE.test(item.name)) continue;
    const match = /(?:^|[^\d.])(\d{3,4})\s?w(?:p|att|atts)?\b/i.exec(item.name);
    if (match && item.quantity > 0) return { wp: Number(match[1]), count: Math.round(item.quantity), itemName: item.name };
  }
  return undefined;
}
