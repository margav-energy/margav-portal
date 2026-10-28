import type { SolarSurveyAnswers } from "@/types/solar-survey";

/**
 * The slice of a solar quote's `property_details` that a submitted survey
 * fills in (the optional fields on `SolarPropertyDetails`, `src/types/solar-quote.ts`).
 * Only answers the customer actually gave are included, so merging this over
 * the existing details never blanks something out.
 */
export function buildPropertyPatchFromSurvey(answers: SolarSurveyAnswers): Record<string, string> {
  const supplier = answers.energySupplier === "Other" ? answers.energySupplierOther.trim() : answers.energySupplier.trim();

  const candidates: Record<string, string> = {
    mpan: answers.mpan.trim(),
    propertyType: answers.propertyType.trim(),
    energySupplier: supplier,
    meterPhase: answers.meterPhase.trim(),
    rearAccess: answers.rearAccess.trim(),
    hasWifi: answers.hasWifi.trim(),
    hasPets: answers.hasPets.trim(),
    existingEvCharger: answers.existingEvCharger.trim(),
    existingSolarOrBattery: answers.existingSolarOrBattery.trim(),
    roofCount: answers.roofCount.trim(),
  };

  return Object.fromEntries(Object.entries(candidates).filter(([, value]) => value !== ""));
}
