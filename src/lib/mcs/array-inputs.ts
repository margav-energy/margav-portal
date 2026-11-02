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

  const withDegrees = /(\d+(?:\.\d+)?)\s*°?\s*(south|north|east|west)?/.exec(value);
  if (withDegrees && /\d/.test(value) && /°|south|north|east|west|deg/.test(value)) {
    const degrees = Number(withDegrees[1]);
    if (Number.isFinite(degrees) && degrees <= 360) {
      const fromSouth = withDegrees[2] === "north" ? 180 - degrees : degrees;
      return Math.min(180, Math.max(0, fromSouth));
    }
  }

  const compass: [RegExp, number][] = [
    [/north[\s-]*(east|west)|(north|n)[\s-]*(e|w)\b|\bn[ew]\b/, 135],
    [/south[\s-]*(east|west)|(south|s)[\s-]*(e|w)\b|\bs[ew]\b/, 45],
    [/\b(east|west|e|w)\b/, 90],
    [/\bnorth|\bn\b/, 180],
    [/\bsouth|\bs\b/, 0],
  ];
  return compass.find(([pattern]) => pattern.test(value))?.[1];
}

/**
 * Finds the module line item — a name ending in a watt rating like
 * "AIKO Neostar 3S 485w" — and returns its rating and quantity. "5kw"
 * inverters and the like don't match: a rating is 3–4 digits straight
 * before "w".
 */
export function parseModuleFromItems(items: LineItem[]): { wp: number; count: number; itemName: string } | undefined {
  for (const item of items) {
    const match = /(?:^|[^\d.])(\d{3,4})\s?w(?:p|att|atts)?\b/i.exec(item.name);
    if (match && item.quantity > 0) return { wp: Number(match[1]), count: Math.round(item.quantity), itemName: item.name };
  }
  return undefined;
}
