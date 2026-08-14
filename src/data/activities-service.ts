import { activities } from "@/data/activities";
import type { Activity } from "@/types/activity";

export async function getAllActivities(): Promise<Activity[]> {
  return activities;
}

/** Distinct non-system actor names, in first-seen order, for the user filter. */
export async function getActivityActors(): Promise<string[]> {
  const actors: string[] = [];
  for (const activity of activities) {
    if (!activity.isSystem && !actors.includes(activity.actorName)) {
      actors.push(activity.actorName);
    }
  }
  return actors;
}
