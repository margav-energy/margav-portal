import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** "David Whitfield" -> "DW" */
export function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/**
 * Capitalizes the first letter of each word without touching the rest of
 * its casing — "john o'brien" -> "John O'Brien", "mary-jane" -> "Mary-Jane"
 * — so a name typed all-lowercase gets fixed, but a name already typed with
 * intentional internal capitals (e.g. "McDonald") isn't clobbered. `\b`
 * naturally breaks on apostrophes/hyphens too, not just spaces.
 */
export function toTitleCase(value: string): string {
  return value.replace(/\b\p{L}/gu, (letter) => letter.toUpperCase());
}

/**
 * Normalizes a freely-typed UK postcode to Royal Mail's conventional
 * "OUTWARD INWARD" format — uppercase, single space before the last 3
 * characters — e.g. "ws15 1re" -> "WS15 1RE", "sw1a1aa" -> "SW1A 1AA".
 * Left as-is (just uppercased) if too short to split meaningfully.
 */
export function formatUkPostcode(value: string): string {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (compact.length < 5) return compact;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** Trims and lowercases — emails are case-insensitive, and storing them
 *  consistently avoids "same address, different case" duplicates. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^\S+@\S+\.\S+$/.test(value);
}

/**
 * Normalizes a freely-typed UK phone number — strips punctuation/spacing,
 * folds a `+44`/`0044` international prefix back to a leading `0`, and
 * groups mobile numbers as the familiar "07XXX XXXXXX". Landlines are only
 * de-punctuated (not regrouped): UK area codes range from 2 to 5 digits, so
 * there's no single correct grouping without an area-code lookup table.
 */
export function formatUkPhone(value: string): string {
  let digits = value.trim().replace(/[^\d+]/g, "");
  if (digits.startsWith("+44")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("0044")) digits = `0${digits.slice(4)}`;
  digits = digits.replace(/\D/g, "");

  if (/^07\d{9}$/.test(digits)) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return digits;
}

/** Lenient on purpose — UK landline lengths vary (e.g. some 0800 numbers),
 *  this just catches obviously-wrong input (too short/long), not every
 *  invalid number. */
export function isValidUkPhone(value: string): boolean {
  const digits = formatUkPhone(value).replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11;
}
