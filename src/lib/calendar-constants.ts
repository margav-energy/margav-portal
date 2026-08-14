export const CALENDAR_START_HOUR = 8;
export const CALENDAR_END_HOUR = 21;
export const CALENDAR_ROW_HEIGHT = 64;
export const CALENDAR_TIME_COL_WIDTH = 56;

export const CALENDAR_HOURS = Array.from(
  { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR + 1 },
  (_, i) => CALENDAR_START_HOUR + i,
);

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** @param time 24h "HH:mm" */
export function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}
