/**
 * Splits a quote's free-form address (`customer_address_lines` + `postcode`)
 * into the fields the solar survey's "Customer & job details" block shows.
 * Best-effort: the quote stores no structured city/county, so the postcode is
 * pulled out by pattern, the rest is split on commas/newlines, and parts are
 * assigned from the end (county, then city) with whatever is left becoming
 * address lines 1–3. Anything missing comes back as an empty string.
 */

export interface SolarSurveyAddress {
  line1: string;
  line2: string;
  line3: string;
  city: string;
  county: string;
  postcode: string;
}

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})\b/i;

export function splitSolarSurveyAddress(
  addressLines: string[],
  postcodeColumn = "",
): SolarSurveyAddress {
  let text = addressLines.join(", ");
  let postcode = postcodeColumn.trim();

  const match = text.match(UK_POSTCODE);
  if (match) {
    if (!postcode) postcode = `${match[1]} ${match[2]}`.toUpperCase();
    text = text.replace(match[0], "");
  }

  const parts = text
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);

  let county = "";
  let city = "";
  if (parts.length >= 3) county = parts.pop() ?? "";
  if (parts.length >= 2) city = parts.pop() ?? "";

  // Anything beyond three leading lines is folded into line 3 rather than dropped.
  const [line1 = "", line2 = "", ...rest] = parts;
  return { line1, line2, line3: rest.join(", "), city, county, postcode };
}

/** "Eddie Wright" → { firstName: "Eddie", lastName: "Wright" }; a single word is treated as the first name. */
export function splitCustomerName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const [firstName = "", ...rest] = fullName.trim().split(/\s+/);
  return { firstName, lastName: rest.join(" ") };
}
