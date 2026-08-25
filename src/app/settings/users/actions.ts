"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { getInitials } from "@/lib/utils";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { getSiteOrigin } from "@/lib/site-origin";

export type UserRole = "admin" | "rep" | "installer";

export interface UpdateUserRoleResult {
  error?: string;
}

export interface CreateUserResult {
  error?: string;
  /** Set when the account was created but the credentials couldn't be
   *  emailed — the caller needs to hand the temporary password over some
   *  other way (shown inline, since this is the only place it ever exists
   *  in plaintext). */
  temporaryPassword?: string;
}

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  rep: "Rep",
  installer: "Installer",
};

/**
 * Promotes/demotes a teammate between admin, rep, and installer. This is
 * the only place `profiles.role` can be changed from the app — previously
 * an installer account could only be provisioned with a manual SQL update.
 */
export async function updateUserRoleAction(userId: string, role: UserRole): Promise<UpdateUserRoleResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can change a teammate's role." };
  // Prevents an admin from locking themselves out by demoting their own
  // only-admin account — same self-service line the UI also disables.
  if (userId === user.id) return { error: "You can't change your own role." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("full_name")
    .single();

  if (error) {
    console.error("updateUserRoleAction failed", error);
    return { error: "Could not update this teammate's role. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName: data?.full_name || "A teammate",
    description: `${user.firstName} changed ${data?.full_name || "a teammate"}'s role to ${ROLE_LABELS[role]}`,
    status: "allocated",
    entityType: "profile_role",
    entityId: userId,
  });

  revalidatePath("/settings/users");
  return {};
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 16 hex chars (64 bits of entropy) — good enough for a one-time password
 *  that gets emailed once and is meant to be changed on first login (see
 *  the "Password" form on /settings, backed by `updatePasswordAction`). */
function generateTemporaryPassword(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Invite-only signup, automated: creates the `auth.users` row (via the
 * service-role client — this app has no public sign-up page, so there's no
 * end-user session to do this as) and the app-specific role on top of the
 * `profiles` row `handle_new_user` (supabase/schema.sql) creates for it.
 * Mails the teammate their login and a one-time password if Resend is
 * configured; otherwise hands the password back to the admin to pass on.
 */
export async function createUserAction(
  fullName: string,
  email: string,
  role: UserRole,
): Promise<CreateUserResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can add teammates." };

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) return { error: "Enter a full name." };
  if (!EMAIL_PATTERN.test(trimmedEmail)) return { error: "Enter a valid email address." };

  const temporaryPassword = generateTemporaryPassword();
  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: trimmedEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: trimmedName },
  });

  if (error || !data.user) {
    console.error("createUserAction failed", error);
    const alreadyExists = error?.message?.toLowerCase().includes("already");
    return { error: alreadyExists ? "A teammate with that email already exists." : "Could not create this teammate. Please try again." };
  }

  // handle_new_user already inserted a profiles row defaulted to role
  // 'rep' with single-letter initials — fill in the role picked here and
  // the app's normal two-letter initials convention (see getInitials,
  // src/app/settings/actions.ts).
  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({ role, initials: getInitials(trimmedName) || trimmedName[0]?.toUpperCase() || "?" })
    .eq("id", data.user.id);

  if (profileError) {
    console.error("createUserAction: role/initials update failed", profileError);
    return { error: "Account created, but couldn't set their role — edit it in the list below." };
  }

  await logActivity({
    actorId: user.id,
    customerName: trimmedName,
    description: `${user.firstName} added ${trimmedName} as ${ROLE_LABELS[role].toLowerCase() === "admin" ? "an" : "a"} ${ROLE_LABELS[role]}`,
    status: "allocated",
    entityType: "profile_created",
    entityId: data.user.id,
  });

  revalidatePath("/settings/users");

  if (!isResendConfigured()) {
    return { temporaryPassword };
  }

  const origin = await getSiteOrigin();
  try {
    await sendEmail({
      to: trimmedEmail,
      subject: "Your Margav Portal account",
      text:
        `Hi ${trimmedName},\n\n` +
        `An account has been created for you on Margav Portal.\n\n` +
        `Log in at ${origin}/login\n` +
        `Email: ${trimmedEmail}\n` +
        `Temporary password: ${temporaryPassword}\n\n` +
        `You can set your own password from Settings once you're in.`,
    });
  } catch (emailError) {
    console.error("createUserAction: welcome email failed", emailError);
    return { temporaryPassword };
  }

  return {};
}
