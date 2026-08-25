"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import type { InstallerAvailabilityStatus } from "@/types/installer-availability";

export interface SetAvailabilityResult {
  error?: string;
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
