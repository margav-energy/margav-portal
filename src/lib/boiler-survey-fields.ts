import type { BoilerSurveyAnswers } from "@/types/boiler-survey";

/**
 * Section/field layout for the boiler pre-installation survey — shared by
 * the public fill-in form (`src/app/survey/[token]/SurveyForm.tsx`) and the
 * read-only summary shown on the quote detail page
 * (`src/components/quotes/boiler/BoilerSurveyCard.tsx`), so the two never
 * drift out of sync. Field grouping mirrors `Boiler_Installation_Survey_Form.pdf`
 * section-for-section.
 */

export type BoilerSurveyFieldConfig =
  | { key: keyof BoilerSurveyAnswers; label: string; type: "text" | "textarea" }
  | { key: keyof BoilerSurveyAnswers; label: string; type: "number" }
  | { key: keyof BoilerSurveyAnswers; label: string; type: "select"; options: string[] }
  /** Dropdown whose options are generated from the survey's `bathrooms` count (see `bathroomLocationOptions`), rather than a fixed list. */
  | { key: keyof BoilerSurveyAnswers; label: string; type: "bathroom-select" };

export const YES_NO = ["Yes", "No"];

/**
 * Boiler location is tracked as "which bathroom" rather than free text —
 * options are generated from however many bathrooms were entered elsewhere
 * on the survey. "Other" is always included as a fallback for the rare job
 * where the boiler sits outside a bathroom (airing cupboard, kitchen, etc.)
 * or before a bathroom count has been entered yet.
 */
export function bathroomLocationOptions(bathrooms: number | null): string[] {
  const count = Math.max(0, Math.floor(bathrooms ?? 0));
  return [...Array.from({ length: count }, (_, i) => `Bathroom ${i + 1}`), "Other"];
}

export const BOILER_SURVEY_SECTIONS: { title: string; fields: BoilerSurveyFieldConfig[] }[] = [
  {
    title: "Property & Access",
    fields: [
      { key: "propertyType", label: "Property type (house / flat / bungalow)", type: "text" },
      { key: "propertyAge", label: "Approximate age of property", type: "text" },
      // Captured here (ahead of the Current Heating System / New Installation
      // sections) so the "which bathroom" boiler-location dropdowns below have
      // options to offer by the time the surveyor reaches them.
      { key: "bathrooms", label: "Number of bathrooms / showers", type: "number" },
      { key: "occupancy", label: "Owner-occupied or rented?", type: "select", options: ["Owner-occupied", "Rented"] },
      { key: "landlordPermissionConfirmed", label: "If rented, is landlord permission confirmed?", type: "select", options: [...YES_NO, "N/A"] },
      { key: "accessNotes", label: "Parking restrictions or access issues", type: "textarea" },
      { key: "isHmo", label: "Is this a house share / HMO?", type: "select", options: YES_NO },
    ],
  },
  {
    title: "Current Heating System",
    fields: [
      { key: "currentBoilerMakeModel", label: "Current boiler make & model", type: "text" },
      { key: "currentBoilerAge", label: "Approximate age of current boiler", type: "text" },
      { key: "currentBoilerType", label: "Boiler type (combi / system / regular)", type: "text" },
      { key: "currentFuelType", label: "Fuel type (gas / LPG / oil / electric)", type: "text" },
      { key: "knownFaults", label: "Known faults or issues", type: "textarea" },
      { key: "currentBoilerLocation", label: "Current boiler location", type: "bathroom-select" },
      { key: "currentBoilerWorking", label: "Is current boiler still working?", type: "select", options: YES_NO },
    ],
  },
  {
    title: "New Installation Requirements",
    fields: [
      { key: "desiredBoilerLocation", label: "Desired new boiler location", type: "bathroom-select" },
      { key: "reasonForReplacement", label: "Reason for replacement", type: "textarea" },
      { key: "bedrooms", label: "Number of bedrooms", type: "number" },
      { key: "radiators", label: "Number of radiators", type: "number" },
      { key: "occupants", label: "Number of occupants", type: "number" },
      { key: "simultaneousHotWaterDemand", label: "Simultaneous hot water demand (e.g. power shower + bath)", type: "textarea" },
      { key: "plannedExtension", label: "Planned extension / loft conversion?", type: "text" },
    ],
  },
  {
    title: "Gas & Flue",
    fields: [
      { key: "existingGasSupply", label: "Existing gas supply present?", type: "select", options: YES_NO },
      { key: "gasMeterSize", label: "Gas meter size / pipework diameter", type: "text" },
      { key: "currentFlueTermination", label: "Current flue termination point", type: "text" },
      { key: "flueRouteObstructions", label: "Obstructions near proposed flue route (windows, doors, boundaries)", type: "textarea" },
    ],
  },
  {
    title: "Water & Pressure",
    fields: [
      { key: "mainsWaterPressure", label: "Mains water pressure / flow rate", type: "text" },
      { key: "existingColdWaterTank", label: "Existing cold water tank / cylinder present?", type: "select", options: YES_NO },
      { key: "lowPressureHardWaterHistory", label: "History of low pressure or hard water issues?", type: "textarea" },
      { key: "scaleReducerRequired", label: "Scale reducer required?", type: "select", options: YES_NO },
    ],
  },
  {
    title: "Electrics & Controls",
    fields: [
      { key: "fusedSpurPresent", label: "Suitable fused spur near boiler location?", type: "select", options: YES_NO },
      { key: "smartControlsRequested", label: "Smart thermostat / specific controls requested", type: "text" },
    ],
  },
  {
    title: "Other Considerations",
    fields: [
      { key: "asbestosConcerns", label: "Asbestos concerns (pre-2000 flues/pipework)", type: "text" },
      { key: "responsiblePersonSignoff", label: "Responsible person for quote sign-off", type: "text" },
      { key: "additionalNotes", label: "Additional notes", type: "textarea" },
    ],
  },
];
