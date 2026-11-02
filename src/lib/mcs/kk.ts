import kkData from "./data/kk.json";

/**
 * kWh/kWp (Kk) for a postcode zone, orientation and pitch — MIS 3002 / MCS
 * 032 Appendix B. Values are MCS's "Irradiance Datasets" workbook (Climate-
 * SAF-PVGIS × 0.8, so the performance ratio is already included — never
 * apply it again). Tables: one per zone, a row per 1° of pitch (0–90) and a
 * column per 5° of orientation from south (0–175).
 */
const TABLES = kkData as Record<string, number[][]>;

export interface KkLookup {
  kk: number;
  /** The values actually looked up, after MCS rounding. */
  orientationDeg: number;
  pitchDeg: number;
  /** True if orientation had to be held at 175° because the workbook has no 180° (due north) column. */
  orientationClamped: boolean;
}

/**
 * Orientation is degrees from due south (0 south, 90 east or west, 180 north)
 * and is rounded to the nearest 5°; pitch is rounded to the nearest 1°.
 */
export function lookupKk(zone: string, orientationDeg: number, pitchDeg: number): KkLookup | undefined {
  const table = TABLES[zone];
  if (!table || !Number.isFinite(orientationDeg) || !Number.isFinite(pitchDeg)) return undefined;

  let azimuth = Math.abs(orientationDeg) % 360;
  if (azimuth > 180) azimuth = 360 - azimuth;
  const orientation = Math.round(azimuth / 5) * 5;
  const orientationClamped = orientation > 175;
  const column = Math.min(orientation, 175) / 5;
  const pitch = Math.min(90, Math.max(0, Math.round(pitchDeg)));

  return { kk: table[pitch][column], orientationDeg: orientationClamped ? 175 : orientation, pitchDeg: pitch, orientationClamped };
}
