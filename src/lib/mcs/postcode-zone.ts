import zoneEntries from "./data/postcode-zones.json";

/**
 * MCS / SAP postcode zone for a UK postcode — MIS 3002 Issue 6.0, Appendix B,
 * Table 2 (the same zones as SAP). The zone selects the Kk table in
 * `kk.ts`. A district-specific row (e.g. "LS24 → 10") wins over the area row
 * ("LS → 11"). Entries are `[area, firstDistrict, lastDistrict, zone]`.
 *
 * Note: the published table has one row reading "NPS 13", which is almost
 * certainly a typo; it can never match a real postcode here, so those NP
 * districts fall back to the NP area zone (5W). Raise it with MCS if it matters.
 */
const ENTRIES = zoneEntries as [string, number | null, number | null, string][];

const POSTCODE = /^([A-Z]{1,2})(\d{1,2})[A-Z]?\s*(?:\d[A-Z]{2})?$/;

export function getMcsZone(postcode: string): string | undefined {
  const match = POSTCODE.exec(postcode.trim().toUpperCase());
  if (!match) return undefined;
  const area = match[1];
  const district = Number(match[2]);

  let areaZone: string | undefined;
  for (const [entryArea, first, last, zone] of ENTRIES) {
    if (entryArea !== area) continue;
    if (first === null) areaZone = zone;
    else if (last !== null && district >= first && district <= last) return zone;
  }
  return areaZone;
}
