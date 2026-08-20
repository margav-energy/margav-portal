import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isResendConfigured, sendEmail } from "@/lib/resend";

/**
 * Shared notification writer — inserts a row into `notifications` for a
 * given user so it shows up in their `NotificationBell` dropdown, and (when
 * `RESEND_API_KEY` is configured) mirrors the same notification to their
 * email. Mirrors `logActivity` in spirit: fire-and-forget, a failure here
 * should never fail the mutation that triggered it.
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

  await emailNotification(entry);
}

/**
 * Best-effort email mirror of the in-app notification above. Separate try
 * block from the insert above — an email failure (or Resend not being
 * configured at all, the common case in dev) must never affect the in-app
 * notification, which is why this always runs after that insert has
 * already been attempted.
 *
 * `notifications.user_id` only gives us a profile id, and `profiles` has no
 * email column (see supabase/schema.sql) — the real address lives on
 * `auth.users`, which only the service-role client can look up for a user
 * other than the current session's own.
 */
async function emailNotification(entry: { userId: string; title: string; body?: string }): Promise<void> {
  if (!isResendConfigured()) return;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.getUserById(entry.userId);
    if (error || !data?.user?.email) {
      if (error) console.error("notifyUser: failed to look up recipient email", error);
      return;
    }

    await sendEmail({
      to: data.user.email,
      subject: entry.title,
      text: entry.body ?? entry.title,
    });
  } catch (error) {
    console.error("notifyUser: email mirror failed", error);
  }
}
