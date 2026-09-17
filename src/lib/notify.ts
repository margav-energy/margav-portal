import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { getSiteOrigin } from "@/lib/site-origin";

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
  /** Where the emailed "Open in Margav Portal" button should land — a
   *  path relative to the site root (e.g. `/quotes/${quoteId}`), not a full
   *  URL. Defaults to the portal's root if omitted. */
  link?: string;
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
 * Inline-styled HTML fragment for the email mirror below — same
 * "Margav Heating" header + single centered button pattern as
 * `src/lib/esignature/email-templates.ts`, so a rep/installer notification
 * matches the look of the customer-facing sign emails instead of arriving
 * as a bare, unstyled line of text.
 */
function notificationEmailHtml(params: { title: string; body: string; portalUrl: string }): string {
  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:480px;">` +
    `<p style="font-size:18px;font-weight:bold;margin:0 0 4px;">Margav Heating</p>` +
    `<p style="font-size:16px;font-weight:600;margin:20px 0 4px;">${params.title}</p>` +
    `<p style="margin:0 0 8px;">${params.body}</p>` +
    `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">` +
    `<tr><td style="border-radius:8px;background-color:#2563eb;">` +
    `<a href="${params.portalUrl}" target="_blank" rel="noreferrer" ` +
    `style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;` +
    `font-weight:bold;color:#ffffff;text-decoration:none;border-radius:8px;">Open in Margav Portal</a>` +
    `</td></tr></table>` +
    `<p style="font-size:13px;color:#64748b;">Or copy this link: <a href="${params.portalUrl}">${params.portalUrl}</a></p>` +
    `<p style="font-size:12px;color:#94a3b8;margin-top:32px;">Margav Heating</p>` +
    `</div>`
  );
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
async function emailNotification(entry: { userId: string; title: string; body?: string; link?: string }): Promise<void> {
  if (!isResendConfigured()) return;

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin.auth.admin.getUserById(entry.userId);
    if (error || !data?.user?.email) {
      if (error) console.error("notifyUser: failed to look up recipient email", error);
      return;
    }

    const body = entry.body ?? entry.title;
    const portalUrl = `${await getSiteOrigin()}${entry.link ?? "/"}`;

    await sendEmail({
      to: data.user.email,
      subject: entry.title,
      text: `${body}\n\nOpen in Margav Portal: ${portalUrl}`,
      html: notificationEmailHtml({ title: entry.title, body, portalUrl }),
    });
  } catch (error) {
    console.error("notifyUser: email mirror failed", error);
  }
}
