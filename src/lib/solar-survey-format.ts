import { toTitleCase } from "@/lib/utils";
import type { SolarSurveyAnswers } from "@/types/solar-survey";

/**
 * Text clean-up and validation for the solar survey's typed answers, shared
 * by the public form (applied as the user types / leaves a field) and
 * `saveSolarSurvey` (re-applied server-side, since the client can't be
 * trusted). Pure functions, so safe in both places.
 *
 *  - "mpan":     digits only, at most 13 (see `isValidMpan`)
 *  - "name":     Title Case — "JOHN SMITH" and "john smith" both become "John Smith"
 *  - "title":    Title Case, for short names such as a supplier
 *  - "sentence": first letter of each sentence/line capitalised, whitespace tidied
 */
export type SolarSurveyTextFormat = "mpan" | "name" | "title" | "sentence";

export const MPAN_LENGTH = 13;

export function formatMpan(value: string): string {
  return value.replace(/\D/g, "").slice(0, MPAN_LENGTH);
}

/** A pasted full MPAN label ("S 12 345 678 91 0112 1214 151") carries the top row too — keep the bottom 13 digits. */
export function formatPastedMpan(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.slice(-MPAN_LENGTH);
}

export function isValidMpan(value: string): boolean {
  return /^\d{13}$/.test(value);
}

function tidy(value: string): string {
  return value.replace(/[ \t]+/g, " ").trim();
}

export function formatTitle(value: string): string {
  const cleaned = tidy(value);
  if (!cleaned) return "";
  return toTitleCase(cleaned);
}

export function formatName(value: string): string {
  const cleaned = tidy(value);
  if (!cleaned) return "";
  // Each word is judged on its own: "JOHN" and "smith" are normalised, but a deliberately mixed-case word like "McDonald" is left alone.
  return cleaned
    .split(" ")
    .map((word) => {
      const isUniformCase =
        word === word.toUpperCase() || word === word.toLowerCase();
      return toTitleCase(isUniformCase ? word.toLowerCase() : word);
    })
    .join(" ");
}

export function formatSentence(value: string): string {
  const cleaned = value
    .split("\n")
    .map((line) => tidy(line))
    .join("\n")
    .trim();
  return cleaned.replace(
    /(^|[.!?]\s+|\n)(\p{Ll})/gu,
    (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
  );
}

export function applyTextFormat(
  format: SolarSurveyTextFormat,
  value: string,
): string {
  switch (format) {
    case "mpan":
      return formatMpan(value);
    case "name":
      return formatName(value);
    case "title":
      return formatTitle(value);
    case "sentence":
      return formatSentence(value);
  }
}

/** Applies each field's format to a whole answers object — run before saving. */
export function formatSolarSurveyAnswers(
  answers: SolarSurveyAnswers,
): SolarSurveyAnswers {
  return {
    ...answers,
    mpan: formatMpan(answers.mpan),
    energySupplierOther: formatTitle(answers.energySupplierOther),
    meterLocation: formatSentence(answers.meterLocation),
    consumerUnitLocation: formatSentence(answers.consumerUnitLocation),
    inverterLocation: formatSentence(answers.inverterLocation),
    notes: formatSentence(answers.notes),
    completedBy: formatName(answers.completedBy),
    roofs: answers.roofs.map((roof) => ({
      ...roof,
      name: formatSentence(roof.name),
      notes: formatSentence(roof.notes),
    })),
  };
}
