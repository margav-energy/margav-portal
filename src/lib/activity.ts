import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityStatus } from "@/types/activity";

/**
 * Shared audit-log writer — call this from every mutating Server Action
 * across the app so the Activity Feed (`activities` table) is a real log
 * instead of static data. Fire-and-forget by design: a logging failure
 * should never fail the mutation it's describing.
 */
export async function logActivity(entry: {
  actorId?: string | null;
  customerName: string;
  description: string;
  status: ActivityStatus;
  entityType?: string;
  entityId?: string;
  isSystem?: boolean;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("activities").insert({
      actor_id: entry.actorId ?? null,
      is_system: entry.isSystem ?? !entry.actorId,
      customer_name: entry.customerName,
      description: entry.description,
      status: entry.status,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
    });
  } catch (error) {
    console.error("logActivity failed", error);
  }
}
