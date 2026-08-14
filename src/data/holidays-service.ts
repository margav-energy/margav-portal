import { holidays } from "@/data/holidays";
import type { HolidayRequest } from "@/types/holiday";

export async function getAllHolidays(): Promise<HolidayRequest[]> {
  return holidays;
}

/** Distinct rep names, in first-seen order, for the Representative filter. */
export async function getHolidayReps(): Promise<string[]> {
  const reps: string[] = [];
  for (const holiday of holidays) {
    if (!reps.includes(holiday.repName)) reps.push(holiday.repName);
  }
  return reps;
}
