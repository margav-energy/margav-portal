/**
 * The pre-installation boiler survey filled in on-site via the public
 * `/survey/[token]` link (see `src/app/survey/[token]`). Field grouping
 * mirrors `Boiler_Installation_Survey_Form.pdf` section-for-section.
 */

export type BoilerSurveyStatus = "pending" | "submitted";

export const PHOTO_CHECKLIST_ITEMS = [
  { key: "current_boiler_full", label: "Current boiler — full unit" },
  { key: "current_boiler_badge", label: "Current boiler — close-up of data badge / serial plate" },
  { key: "boiler_location_wide", label: "Boiler location — wide shot of surrounding space/cupboard" },
  { key: "flue_internal", label: "Flue — internal, where it exits the boiler" },
  { key: "flue_external", label: "Flue — external termination point" },
  { key: "gas_meter", label: "Gas meter — including make/model" },
  { key: "gas_pipework_run", label: "Gas pipework run — from meter to boiler location" },
  { key: "mains_stopcock", label: "Incoming mains stopcock" },
  { key: "visible_pipework", label: "Visible pipework near boiler" },
  { key: "existing_cylinder", label: "Existing cylinder / tank (if applicable)" },
  { key: "loft_tank", label: "Loft tank (if applicable)" },
  { key: "radiators_general", label: "Radiators — general shots (note any older cast iron radiators)" },
  { key: "proposed_location_wide", label: "Proposed new boiler location — wide shot" },
  { key: "electrical_supply_point", label: "Electrical supply point (fused spur / socket)" },
  { key: "obstructions_hazards", label: "Any obstructions or hazards (e.g. suspected asbestos, damp, structural concerns)" },
] as const;

export type PhotoChecklistItemKey = (typeof PHOTO_CHECKLIST_ITEMS)[number]["key"];

export interface BoilerSurveyPhoto {
  itemKey: PhotoChecklistItemKey;
  /** Signed, short-lived — regenerate on every read, never persist it. */
  url: string;
  uploadedAt: string;
}

/** Everything the surveyor fills in — every field is optional since the form can be part-completed. */
export interface BoilerSurveyAnswers {
  propertyType: string;
  propertyAge: string;
  occupancy: string;
  landlordPermissionConfirmed: string;
  accessNotes: string;
  isHmo: string;

  currentBoilerMakeModel: string;
  currentBoilerAge: string;
  currentBoilerType: string;
  currentFuelType: string;
  knownFaults: string;
  currentBoilerLocation: string;
  currentBoilerWorking: string;

  desiredBoilerLocation: string;
  reasonForReplacement: string;
  bedrooms: number | null;
  bathrooms: number | null;
  radiators: number | null;
  occupants: number | null;
  simultaneousHotWaterDemand: string;
  plannedExtension: string;

  existingGasSupply: string;
  gasMeterSize: string;
  currentFlueTermination: string;
  flueRouteObstructions: string;

  mainsWaterPressure: string;
  existingColdWaterTank: string;
  lowPressureHardWaterHistory: string;
  scaleReducerRequired: string;

  fusedSpurPresent: string;
  smartControlsRequested: string;

  asbestosConcerns: string;
  responsiblePersonSignoff: string;
  additionalNotes: string;

  surveyorName: string;
  /** ISO date, e.g. "2026-08-19" — doubles as the surveyor sign-off date. */
  surveyDate: string;
}

/** Read-only job/customer context shown at the top of the public form — pulled from the owning quote, not editable there. */
export interface BoilerSurveyJobContext {
  quoteId: string;
  reference: string;
  repName: string;
  customerName: string;
  phone: string;
  email: string;
  addressLines: string[];
}

export interface BoilerSurveyDetail {
  id: string;
  status: BoilerSurveyStatus;
  accessToken: string;
  answers: BoilerSurveyAnswers;
  photos: BoilerSurveyPhoto[];
  submittedAt?: string;
}

export function emptyBoilerSurveyAnswers(): BoilerSurveyAnswers {
  return {
    propertyType: "",
    propertyAge: "",
    occupancy: "",
    landlordPermissionConfirmed: "",
    accessNotes: "",
    isHmo: "",
    currentBoilerMakeModel: "",
    currentBoilerAge: "",
    currentBoilerType: "",
    currentFuelType: "",
    knownFaults: "",
    currentBoilerLocation: "",
    currentBoilerWorking: "",
    desiredBoilerLocation: "",
    reasonForReplacement: "",
    bedrooms: null,
    bathrooms: null,
    radiators: null,
    occupants: null,
    simultaneousHotWaterDemand: "",
    plannedExtension: "",
    existingGasSupply: "",
    gasMeterSize: "",
    currentFlueTermination: "",
    flueRouteObstructions: "",
    mainsWaterPressure: "",
    existingColdWaterTank: "",
    lowPressureHardWaterHistory: "",
    scaleReducerRequired: "",
    fusedSpurPresent: "",
    smartControlsRequested: "",
    asbestosConcerns: "",
    responsiblePersonSignoff: "",
    additionalNotes: "",
    surveyorName: "",
    surveyDate: "",
  };
}
