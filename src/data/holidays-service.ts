import { createClient } from "@/lib/supabase/server";
import type { HolidayRequest, HolidayStatus } from "@/types/holiday";

// supabase-js can't infer the cardinality of an embedded resource without
// generated Database types (this project has none — see other *-service.ts
// files), so it types `rep:profiles(...)` as an array even though
// `holidays.rep_id` is a many-to-one FK. Assert the real (single-object)
// shape instead of fighting the inferred one.
interface HolidayRow {
  id: string;
  postcodes: string[];
  start_date: string;
  end_date: string;
  status: HolidayStatus;
  rep: { full_name: string; initials: string } | null;
}

export async function getAllHolidays(): Promise<HolidayRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("holidays")
    // `holidays` has two FKs to `profiles` (rep_id and decided_by), so the
    // embed needs an explicit constraint-name hint or PostgREST returns a
    // 300 "more than one relationship was found" error.
    .select("id, postcodes, start_date, end_date, status, rep:profiles!holidays_rep_id_fkey(full_name, initials)")
    .order("start_date", { ascending: false });

  if (error) {
    console.error("getAllHolidays failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as HolidayRow[];

  return rows.map((row) => ({
    id: row.id,
    repName: row.rep?.full_name || "Unknown",
    repInitials: row.rep?.initials || "?",
    postcodes: row.postcodes ?? [],
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
  }));
}

/** Distinct rep names, in first-seen order, for the Representative filter. */
export async function getHolidayReps(): Promise<string[]> {
  const holidays = await getAllHolidays();
  const reps: string[] = [];
  for (const holiday of holidays) {
    if (!reps.includes(holiday.repName)) reps.push(holiday.repName);
  }
  return reps;
}
