"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { addDays, toISODate } from "@/lib/date-utils";
import type { InstallerAvailabilityStatus } from "@/types/installer-availability";

export interface SetAvailabilityResult {
  error?: string;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
  const end = new Date(endYear, endMonth - 1, endDay);

  const dates: string[] = [];
  let cursor = new Date(startYear, startMonth - 1, startDay);
  while (cursor <= end) {
    dates.push(toISODate(cursor));
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** Single-day toggle — called from a day row's available/unavailable buttons. */
export async function setAvailabilityDayAction(
  date: string,
  status: InstallerAvailabilityStatus,
): Promise<SetAvailabilityResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "installer") return { error: "Only installers can set their own availability." };

  const supabase = await createClient();
  const { error } = await supabase.from("installer_availability").upsert(
    {
      installer_id: user.id,
      date,
      status,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "installer_id,date" },
  );

  if (error) {
    console.error("setAvailabilityDayAction failed", error);
    return { error: "Could not save your availability. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName: user.firstName,
    description: `${user.firstName} marked ${date} as ${status}`,
    // ActivityStatus has no available/unavailable variant — "allocated" and
    // "cancelled" are the closest positive/negative fits (same trick
    // src/app/holidays/actions.ts uses for approved/rejected).
    status: status === "available" ? "allocated" : "cancelled",
    entityType: "installer_availability",
    entityId: `${user.id}:${date}`,
  });

  revalidatePath("/availability");
  revalidatePath("/appointments/installer-availability");
  return {};
}

/** Bulk range set — e.g. a "mark this whole week unavailable" shortcut. */
export async function setAvailabilityRangeAction(
  startDate: string,
  endDate: string,
  status: InstallerAvailabilityStatus,
): Promise<SetAvailabilityResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "installer") return { error: "Only installers can set their own availability." };

  const dates = enumerateDates(startDate, endDate);
  const supabase = await createClient();
  const { error } = await supabase.from("installer_availability").upsert(
    dates.map((date) => ({
      installer_id: user.id,
      date,
      status,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "installer_id,date" },
  );

  if (error) {
    console.error("setAvailabilityRangeAction failed", error);
    return { error: "Could not save your availability. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName: user.firstName,
    description: `${user.firstName} marked ${startDate} to ${endDate} as ${status}`,
    status: status === "available" ? "allocated" : "cancelled",
    entityType: "installer_availability",
    entityId: `${user.id}:${startDate}:${endDate}`,
  });

  revalidatePath("/availability");
  revalidatePath("/appointments/installer-availability");
  return {};
}
