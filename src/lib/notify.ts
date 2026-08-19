import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Shared notification writer — inserts a row into `notifications` for a
 * given user so it shows up in their `NotificationBell` dropdown. Mirrors
 * `logActivity` in spirit: fire-and-forget, a failure here should never
 * fail the mutation that triggered it.
 */
export async function notifyUser(entry: {
  userId: string;
  title: string;
  body?: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("notifications").insert({
      user_id: entry.userId,
      title: entry.title,
      body: entry.body ?? null,
    });
  } catch (error) {
    console.error("notifyUser failed", error);
  }
}
