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
  | { key: keyof BoilerSurveyAnswers; label: string; type: "select"; options: string[] };

export const YES_NO = ["Yes", "No"];
export const CURRENT_BOILER_TYPE_OPTIONS = ["Combi", "System", "Regular"];
export const FUEL_TYPE_OPTIONS = ["Gas", "LPG", "Oil", "Electric"];
/** Standard UK property archetypes — covers the vast majority of jobs. Shared
 *  with the boiler quote's property-details card (`BoilerPropertyCard.tsx`)
 *  so the two never drift apart. Not a strict enum on the underlying answer
 *  (still plain `string`): an older quote/survey may already have a
 *  free-text value entered before this became a dropdown, and that value
 *  shouldn't silently disappear or get overwritten just because it isn't on
 *  this list — see the "preserve a pre-existing value" handling in
 *  `SurveyForm.tsx`'s `Field` and `BoilerPropertyCard.tsx`'s dropdown. */
export const PROPERTY_TYPE_OPTIONS = [
  "Detached",
  "Semi-Detached",
  "Terraced",
  "End Terrace",
  "Bungalow",
  "Flat / Apartment",
  "Maisonette",
  "Other",
];

export const BOILER_SURVEY_SECTIONS: { title: string; fields: BoilerSurveyFieldConfig[] }[] = [
  {
    title: "Property & Access",
    fields: [
      { key: "propertyType", label: "Property type", type: "select", options: PROPERTY_TYPE_OPTIONS },
      { key: "propertyAge", label: "Approximate age of property", type: "text" },
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
      { key: "currentBoilerType", label: "Boiler type (combi / system / regular)", type: "select", options: CURRENT_BOILER_TYPE_OPTIONS },
      { key: "currentFuelType", label: "Fuel type (gas / LPG / oil / electric)", type: "select", options: FUEL_TYPE_OPTIONS },
      { key: "knownFaults", label: "Known faults or issues", type: "textarea" },
      { key: "currentBoilerLocation", label: "Current boiler location", type: "text" },
      { key: "currentBoilerWorking", label: "Is current boiler still working?", type: "select", options: YES_NO },
    ],
  },
  {
    title: "New Installation Requirements",
    fields: [
      { key: "desiredBoilerLocation", label: "Desired new boiler location", type: "text" },
      { key: "reasonForReplacement", label: "Reason for replacement", type: "textarea" },
      { key: "bedrooms", label: "Number of bedrooms", type: "number" },
      { key: "bathrooms", label: "Number of bathrooms / showers", type: "number" },
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
