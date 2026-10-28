/**
 * The pre-installation survey for solar quotes, filled in via the public
 * `/survey/[token]` link (see `src/app/survey/[token]`). Mirrors
 * `Pre-Installation Survey _ Margav.pdf` section-for-section; the field
 * layout itself lives in `src/lib/solar-survey-fields.ts`.
 */

import type { SolarSurveyAddress } from "@/lib/solar-survey-address";

export type SolarSurveyStatus = "pending" | "submitted";

export const MAX_ROOFS = 3;

export interface SolarSurveyRoof {
  name: string;
  height: string;
  shape: string;
  covering: string;
  suspectedAsbestos: string;
  roomsInRoof: string;
  timbersCut: string;
  heavierCovering: string;
  damage: string;
  loftAccess: string;
  notes: string;
}

export interface SolarSurveyAnswers {
  // 02 Property details
  propertyType: string;
  rearAccess: string;
  hasWifi: string;
  hasPets: string;
  existingEvCharger: string;
  existingSolarOrBattery: string;
  mpan: string;
  energySupplier: string;
  /** Free-typed supplier name, only used when `energySupplier` is "Other". */
  energySupplierOther: string;
  meterPhase: string;
  roofCount: string;
  // 03–05 Roof A–C (always MAX_ROOFS long; only the first `roofCount` are shown)
  roofs: SolarSurveyRoof[];
  // 06 Key locations
  meterLocation: string;
  consumerUnitLocation: string;
  inverterLocation: string;
  // 10 Notes
  notes: string;
  /** Who filled the form in — the customer or the surveyor. */
  completedBy: string;
}

/** Keys of the per-roof text answers, for generic rendering. */
export type SolarSurveyRoofKey = keyof SolarSurveyRoof;

export interface SolarSurveyFile {
  id: string;
  itemKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number | null;
  /** Signed, short-lived — regenerate on every read, never persist it. */
  url: string;
  uploadedAt: string;
}

/** Read-only job/customer/system context shown at the top of the form — pulled from the owning quote, not editable there. */
export interface SolarSurveyJobContext {
  quoteId: string;
  reference: string;
  repName: string;
  customerName: string;
  phone: string;
  email: string;
  addressLines: string[];
  firstName: string;
  lastName: string;
  address: SolarSurveyAddress;
  panelModel: string;
  mountingSystem: string;
  panelQuantity: number | null;
}

export interface SolarSurveyDetail {
  id: string;
  status: SolarSurveyStatus;
  accessToken: string;
  answers: SolarSurveyAnswers;
  files: SolarSurveyFile[];
  submittedAt?: string;
}

export function emptySolarSurveyRoof(): SolarSurveyRoof {
  return {
    name: "",
    height: "",
    shape: "",
    covering: "",
    suspectedAsbestos: "",
    roomsInRoof: "",
    timbersCut: "",
    heavierCovering: "",
    damage: "",
    loftAccess: "",
    notes: "",
  };
}

export function emptySolarSurveyAnswers(): SolarSurveyAnswers {
  return {
    propertyType: "",
    rearAccess: "",
    hasWifi: "",
    hasPets: "",
    existingEvCharger: "",
    existingSolarOrBattery: "",
    mpan: "",
    energySupplier: "",
    energySupplierOther: "",
    meterPhase: "",
    roofCount: "",
    roofs: Array.from({ length: MAX_ROOFS }, emptySolarSurveyRoof),
    meterLocation: "",
    consumerUnitLocation: "",
    inverterLocation: "",
    notes: "",
    completedBy: "",
  };
}

/**
 * Coerces whatever's stored in `solar_surveys.answers` (possibly `{}`, or a
 * document written by an older version of the form) into a complete answers
 * object — unknown keys are dropped, missing ones become empty.
 */
export function normalizeSolarSurveyAnswers(raw: unknown): SolarSurveyAnswers {
  const base = emptySolarSurveyAnswers();
  if (!raw || typeof raw !== "object") return base;
  const source = raw as Record<string, unknown>;

  for (const key of Object.keys(base) as (keyof SolarSurveyAnswers)[]) {
    if (key === "roofs") continue;
    if (typeof source[key] === "string") (base[key] as string) = source[key] as string;
  }

  const rawRoofs = Array.isArray(source.roofs) ? source.roofs : [];
  base.roofs = base.roofs.map((emptyRoof, index) => {
    const rawRoof = rawRoofs[index];
    if (!rawRoof || typeof rawRoof !== "object") return emptyRoof;
    const roof = { ...emptyRoof };
    for (const key of Object.keys(roof) as SolarSurveyRoofKey[]) {
      const value = (rawRoof as Record<string, unknown>)[key];
      if (typeof value === "string") roof[key] = value;
    }
    return roof;
  });

  return base;
}
