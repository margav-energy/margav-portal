import { createClient } from "@/lib/supabase/server";
import type { Activity, ActivityStatus } from "@/types/activity";

// supabase-js can't infer the cardinality of an embedded resource without
// generated Database types (this project has none), so it types
// `actor:profiles(...)` as an array even though `activities.actor_id` is a
// many-to-one FK. Assert the real (single-object) shape instead.
interface ActivityRow {
  id: string;
  is_system: boolean;
  customer_name: string;
  description: string;
  status: ActivityStatus;
  created_at: string;
  actor: { full_name: string; initials: string } | null;
}

export async function getAllActivities(): Promise<Activity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activities")
    .select(
      "id, is_system, customer_name, description, status, created_at, actor:profiles(full_name, initials)",
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAllActivities failed", error);
    return [];
  }

  const rows = (data ?? []) as unknown as ActivityRow[];

  return rows.map((row) => ({
    id: row.id,
    actorName: row.is_system ? "System" : row.actor?.full_name || "Unknown",
    actorInitials: row.is_system ? undefined : (row.actor?.initials ?? undefined),
    isSystem: row.is_system,
    customerName: row.customer_name,
    description: row.description,
    status: row.status,
    timestamp: row.created_at,
  }));
}

/** Distinct non-system actor names, in first-seen order, for the user filter. */
export async function getActivityActors(): Promise<string[]> {
  const activities = await getAllActivities();
  const actors: string[] = [];
  for (const activity of activities) {
    if (!activity.isSystem && !actors.includes(activity.actorName)) {
      actors.push(activity.actorName);
    }
  }
  return actors;
}
