"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { notifyUser } from "@/lib/notify";
import { formatDateRange } from "@/lib/format";

export interface UpdateHolidayStatusResult {
  error?: string;
}

export async function updateHolidayStatusAction(
  holidayId: string,
  status: "approved" | "rejected",
): Promise<UpdateHolidayStatusResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };

  const supabase = await createClient();

  const { data: holidayData, error: fetchError } = await supabase
    .from("holidays")
    // `holidays` has two FKs to `profiles` (rep_id and decided_by), so the
    // embed needs an explicit constraint-name hint or PostgREST returns a
    // 300 "more than one relationship was found" error.
    .select("id, rep_id, start_date, end_date, rep:profiles!holidays_rep_id_fkey(full_name)")
    .eq("id", holidayId)
    .single();

  if (fetchError || !holidayData) {
    console.error("updateHolidayStatusAction: holiday not found", fetchError);
    return { error: "Holiday request not found." };
  }

  // supabase-js can't infer the cardinality of an embedded resource without
  // generated Database types, so it types `rep:profiles(...)` as an array —
  // it's really a single object given the many-to-one `rep_id` FK.
  const holiday = holidayData as unknown as {
    id: string;
    rep_id: string | null;
    start_date: string;
    end_date: string;
    rep: { full_name: string } | null;
  };

  const { error } = await supabase
    .from("holidays")
    .update({
      status,
      decided_by: user.id,
      decided_at: new Date().toISOString(),
    })
    .eq("id", holidayId);

  if (error) {
    console.error("updateHolidayStatusAction failed", error);
    return { error: "Could not update the holiday request. Please try again." };
  }

  const repName = holiday.rep?.full_name || "The rep";
  const verb = status === "approved" ? "approved" : "rejected";
  const dateRange = formatDateRange(holiday.start_date, holiday.end_date);

  await logActivity({
    actorId: user.id,
    customerName: repName,
    description: `Holiday request for ${repName} (${dateRange}) was ${verb}`,
    // ActivityStatus has no approved/rejected variant — "allocated" and
    // "cancelled" are the closest fits for a positive/negative outcome.
    status: status === "approved" ? "allocated" : "cancelled",
    entityType: "holiday",
    entityId: holidayId,
  });

  if (holiday.rep_id) {
    await notifyUser({
      userId: holiday.rep_id,
      title: `Holiday request ${verb}`,
      body: `Your holiday request for ${dateRange} was ${verb}.`,
    });
  }

  revalidatePath("/holidays");

  return {};
}
