import selfConsumptionData from "./data/self-consumption.json";

/**
 * Solar PV self-consumption with and without a battery — MGD 003 Issue 2.0,
 * which MIS 3002 §4.1.2 requires (MCS 032:2025 §5 repeats the same method). Values come from MCS's
 * "MGD003 Lookup Tables" workbook: per occupancy archetype and annual-
 * consumption band, a row per generation band (300 kWh wide) and a column
 * per usable battery capacity (PV only, then 1 kWh bands from ≥1.1 to <15.1).
 * Each cell is the share of annual generation that is used on site. The
 * unrounded workbook values are used, as MCS permits (MGD 003 §4.6 note).
 */
export type OccupancyArchetype = "home_all_day" | "in_half_day" | "out_all_day";

export const OCCUPANCY_LABELS: Record<OccupancyArchetype, string> = {
  home_all_day: "Home all day",
  in_half_day: "Home half day",
  out_all_day: "Out all day",
};

const TABLES = selfConsumptionData as Record<OccupancyArchetype, Record<string, number[][]>>;

/** MGD 003 §4.3: consumption to assume when it can't be established. */
export const DEFAULT_ANNUAL_CONSUMPTION_KWH = 3500;
/** MGD 003 §4.6: self-consumption can't exceed this share of generation. */
const MAX_SELF_CONSUMPTION_SHARE = 0.95;
/** MGD 003 §4.7: grid independence is capped here. */
const MAX_GRID_INDEPENDENCE = 0.9;

export const SELF_CONSUMPTION_LIMITS = {
  minConsumptionKwh: 1500,
  maxConsumptionKwh: 6000,
  maxGenerationKwh: 6000,
  maxBatteryKwh: 15.1,
};

export interface SelfConsumptionInput {
  archetype: OccupancyArchetype;
  annualConsumptionKwh: number;
  annualGenerationKwh: number;
  /** Usable capacity used for self-consumption; 0 / undefined for PV only. */
  batteryUsableKwh?: number;
}

export type SelfConsumptionResult =
  | { ok: true; selfConsumptionKwh: number; sharePercent: number; gridIndependencePercent: number }
  | { ok: false; reason: string };

export function lookupSelfConsumption(input: SelfConsumptionInput): SelfConsumptionResult {
  const { archetype, annualConsumptionKwh: consumption, annualGenerationKwh: generation } = input;
  const battery = input.batteryUsableKwh ?? 0;
  const limits = SELF_CONSUMPTION_LIMITS;

  if (consumption < limits.minConsumptionKwh || consumption >= limits.maxConsumptionKwh) {
    return {
      ok: false,
      reason: `Annual consumption of ${Math.round(consumption).toLocaleString()} kWh is outside the MCS lookup range (1,500–5,999 kWh).`,
    };
  }
  if (generation >= limits.maxGenerationKwh) {
    return {
      ok: false,
      reason: `Annual generation of ${Math.round(generation).toLocaleString()} kWh is outside the MCS lookup range (under 6,000 kWh).`,
    };
  }
  if (battery >= limits.maxBatteryKwh) {
    return { ok: false, reason: `Usable battery capacity of ${battery} kWh is outside the MCS lookup range (under 15.1 kWh).` };
  }

  const band = 1500 + Math.floor((consumption - 1500) / 500) * 500;
  const row = Math.floor(generation / 300);
  // Column 0 is "PV only"; columns 1–14 are ≥1.1<2.1 … ≥14.1<15.1. Below 1.1 kWh there is no band, so PV only applies.
  const column = battery >= 1.1 ? Math.floor(battery - 0.1) : 0;

  const share = Math.min(MAX_SELF_CONSUMPTION_SHARE, TABLES[archetype][String(band)][row][column]);
  const selfConsumptionKwh = share * generation;
  const gridIndependence = Math.min(MAX_GRID_INDEPENDENCE, selfConsumptionKwh / consumption);

  return {
    ok: true,
    selfConsumptionKwh,
    sharePercent: share * 100,
    gridIndependencePercent: gridIndependence * 100,
  };
}

/** Maps the free-text "Occupancy Archetype" on the quote to an MCS archetype; unknown → "Home half day" (MGD 003 Table 1). */
export function parseOccupancyArchetype(text: string): { archetype: OccupancyArchetype; known: boolean } {
  const value = text.toLowerCase();
  if (/out/.test(value)) return { archetype: "out_all_day", known: true };
  if (/half/.test(value)) return { archetype: "in_half_day", known: true };
  if (/home|all day|in all|most of the day/.test(value)) return { archetype: "home_all_day", known: true };
  return { archetype: "in_half_day", known: false };
}
