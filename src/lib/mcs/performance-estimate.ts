import { getMcsZone } from "./postcode-zone";
import { lookupKk } from "./kk";
import {
  DEFAULT_ANNUAL_CONSUMPTION_KWH,
  OCCUPANCY_LABELS,
  lookupSelfConsumption,
  parseOccupancyArchetype,
  type OccupancyArchetype,
  type SelfConsumptionResult,
} from "./self-consumption";

/**
 * The MCS annual energy performance estimate — MIS 3002 Issue 6.0 §4.1 and
 * Appendix B (generation), MGD 003 Issue 2.0 (self-consumption) and the §4.1.6
 * output format. MCS 032:2025, which the newer MCS:2025 scheme uses, gives the
 * same method.
 *
 *   Annual AC output (kWh) = kWp × Kk × SF         (per array, then summed)
 *
 * Pure and server-friendly: `getMcsZone` / `lookupKk` pull in the Kk tables
 * (~330 KB), so build the estimate on the server and pass the result to
 * client components.
 */
export interface McsArrayInput {
  id: string;
  label: string;
  moduleWp: number;
  moduleCount: number;
  /** Degrees from due south; undefined until entered. */
  orientationDeg: number | undefined;
  pitchDeg: number;
  shadeFactor: number;
  /** Where a value was read from existing text rather than entered — turned into a "please confirm" warning. */
  derivedFrom?: { module?: string; orientation?: string };
}

export interface McsEstimateInput {
  postcode: string;
  arrays: McsArrayInput[];
  /** Free-text "Occupancy Archetype" from the quote's property details. */
  occupancyText: string;
  /** From the customer's bills; 0 / missing → MCS's 3,500 kWh default. */
  annualConsumptionKwh: number;
  /** Number of batteries on the quote — a battery with no usable capacity entered is a problem. */
  batteryCount: number;
  /** Usable capacity (kWh) used for self-consumption, after depth of discharge / reserved backup (MGD 003 §4.5). */
  batteryUsableKwh: number;
}

export interface McsArrayResult {
  id: string;
  label: string;
  kwp: number;
  orientationDeg: number;
  pitchDeg: number;
  zone: string;
  kk: number;
  shadeFactor: number;
  outputKwh: number;
  orientationClamped: boolean;
}

export interface McsEstimate {
  postcode: string;
  /** SAP / MCS postcode zone, e.g. "6". */
  zone: string | undefined;
  arrays: McsArrayResult[];
  totalKwp: number;
  totalOutputKwh: number;
  shadingPresent: boolean;
  occupancy: { archetype: OccupancyArchetype; label: string; known: boolean };
  annualConsumptionKwh: number;
  consumptionAssumed: boolean;
  batteryUsableKwh: number;
  /** §4.1.6 table, section C — absent while `problems` is non-empty. */
  pvOnly: SelfConsumptionResult | undefined;
  /** §4.1.6 table, section D — only when a battery with a usable capacity is on the quote. */
  withBattery: SelfConsumptionResult | undefined;
  /** Missing inputs that stop an MCS estimate being produced. */
  problems: string[];
  /** Things the customer-facing estimate should mention or the admin should check. */
  warnings: string[];
}

export function computeMcsEstimate(input: McsEstimateInput): McsEstimate {
  const problems: string[] = [];
  const warnings: string[] = [];
  const zone = getMcsZone(input.postcode);

  if (!zone) problems.push(`Could not work out the MCS postcode zone from "${input.postcode || "no postcode"}".`);
  if (input.arrays.length === 0) problems.push("Add at least one solar array.");

  const arrays: McsArrayResult[] = [];
  for (const array of input.arrays) {
    const kwp = (array.moduleWp * array.moduleCount) / 1000;
    const missing: string[] = [];
    if (!(kwp > 0)) missing.push("module rating and count");
    if (array.orientationDeg === undefined) missing.push("orientation");
    if (missing.length > 0) {
      problems.push(`${array.label}: enter ${missing.join(" and ")}.`);
      continue;
    }
    if (!zone) continue;

    const lookup = lookupKk(zone, array.orientationDeg as number, array.pitchDeg);
    if (!lookup) {
      problems.push(`${array.label}: no Kk value for this orientation and pitch.`);
      continue;
    }
    if (array.derivedFrom?.module) {
      warnings.push(`${array.label}: module rating and count (${kwp.toFixed(2)} kWp) were read from "${array.derivedFrom.module}" — confirm they are right.`);
    }
    if (array.derivedFrom?.orientation) {
      warnings.push(`${array.label}: orientation (${array.orientationDeg}° from south) was read from "${array.derivedFrom.orientation}" — confirm it is right.`);
    }
    if (lookup.orientationClamped) {
      warnings.push(`${array.label} faces due north; MCS's workbook stops at 175° so that value was used.`);
    }
    arrays.push({
      id: array.id,
      label: array.label,
      kwp,
      orientationDeg: lookup.orientationDeg,
      pitchDeg: lookup.pitchDeg,
      zone,
      kk: lookup.kk,
      shadeFactor: array.shadeFactor,
      outputKwh: kwp * lookup.kk * array.shadeFactor,
      orientationClamped: lookup.orientationClamped,
    });
  }

  const totalKwp = arrays.reduce((sum, a) => sum + a.kwp, 0);
  const totalOutputKwh = arrays.reduce((sum, a) => sum + a.outputKwh, 0);
  const shadingPresent = arrays.some((a) => a.shadeFactor < 1);

  const occupancy = parseOccupancyArchetype(input.occupancyText);
  if (!occupancy.known) {
    warnings.push('Occupancy is not recorded, so "Home half day" was used (MGD 003 Table 1).');
  }
  const consumptionAssumed = !(input.annualConsumptionKwh > 0);
  const annualConsumptionKwh = consumptionAssumed ? DEFAULT_ANNUAL_CONSUMPTION_KWH : input.annualConsumptionKwh;
  if (consumptionAssumed) {
    warnings.push(`Annual consumption is not recorded, so MCS's default of ${DEFAULT_ANNUAL_CONSUMPTION_KWH.toLocaleString()} kWh was used.`);
  }

  const hasBattery = input.batteryCount > 0;
  if (hasBattery && !(input.batteryUsableKwh > 0)) {
    problems.push("Enter the battery's usable capacity (kWh) for self-consumption.");
  }

  const complete = problems.length === 0;
  const base = { archetype: occupancy.archetype, annualConsumptionKwh, annualGenerationKwh: totalOutputKwh };
  const pvOnly = complete ? lookupSelfConsumption(base) : undefined;
  const withBattery =
    complete && hasBattery ? lookupSelfConsumption({ ...base, batteryUsableKwh: input.batteryUsableKwh }) : undefined;

  return {
    postcode: input.postcode,
    zone,
    arrays,
    totalKwp,
    totalOutputKwh,
    shadingPresent,
    occupancy: { archetype: occupancy.archetype, label: OCCUPANCY_LABELS[occupancy.archetype], known: occupancy.known },
    annualConsumptionKwh,
    consumptionAssumed,
    batteryUsableKwh: hasBattery ? input.batteryUsableKwh : 0,
    pvOnly,
    withBattery,
    problems,
    warnings,
  };
}
