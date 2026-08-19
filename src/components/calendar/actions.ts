"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/data/current-user";
import {
  createSavedCalendarView,
  deleteSavedCalendarView,
  type SavedCalendarView,
} from "@/data/appointments-service";

export async function saveFavouriteViewAction(
  name: string,
  stages: string[],
  reps: string[],
): Promise<SavedCalendarView | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const view = await createSavedCalendarView(user.id, name, { stages, reps });
  revalidatePath("/appointments/calendar");
  return view;
}

export async function deleteFavouriteViewAction(id: string): Promise<{ ok: boolean }> {
  const ok = await deleteSavedCalendarView(id);
  revalidatePath("/appointments/calendar");
  return { ok };
}
