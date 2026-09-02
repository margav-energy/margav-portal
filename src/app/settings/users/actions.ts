"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { getInitials } from "@/lib/utils";
import { isResendConfigured, sendEmail } from "@/lib/resend";
import { getSiteOrigin } from "@/lib/site-origin";
import { REP_COLOR_PALETTE_HEX } from "@/lib/rep-colors";

export type UserRole = "admin" | "rep" | "installer";

export interface UpdateUserRoleResult {
  error?: string;
}

export interface CreateUserResult {
  error?: string;
  /** True only when a welcome email actually went out. False both when
   *  Resend isn't configured at all and when sending it failed — either
   *  way the admin needs to pass the login on themselves (they already
   *  know the password, since they're the one who set it). */
  emailSent?: boolean;
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
const MIN_PASSWORD_LENGTH = 8;

/**
 * Invite-only signup, automated: creates the `auth.users` row (via the
 * service-role client — this app has no public sign-up page, so there's no
 * end-user session to do this as) and the app-specific role on top of the
 * `profiles` row `handle_new_user` (supabase/schema.sql) creates for it.
 * The admin sets the initial password directly (rather than one being
 * generated for them) so they can hand it over however suits — verbally,
 * on a slip of paper, whatever — the welcome email is just a convenience
 * on top when Resend is configured, not the only way it's ever known.
 */
export async function createUserAction(
  fullName: string,
  email: string,
  password: string,
  role: UserRole,
): Promise<CreateUserResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can add teammates." };

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedName) return { error: "Enter a full name." };
  if (!EMAIL_PATTERN.test(trimmedEmail)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` };

  const serviceClient = createServiceRoleClient();

  const { data, error } = await serviceClient.auth.admin.createUser({
    email: trimmedEmail,
    password,
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
    return { emailSent: false };
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
        `Password: ${password}\n\n` +
        `You can set your own password from Settings once you're in.`,
    });
  } catch (emailError) {
    console.error("createUserAction: welcome email failed", emailError);
    return { emailSent: false };
  }

  return { emailSent: true };
}

export interface UpdateTeammateResult {
  error?: string;
}

/**
 * Edits an existing teammate's name, login email, and phone — the pencil
 * icon on Settings → Team Members. Name/phone live on `profiles` (RLS
 * already lets an admin update any row, see
 * supabase/migrations/0016_profiles_admin_update.sql); email lives on
 * `auth.users`, so it needs the service-role admin API instead.
 */
export async function updateTeammateAction(
  userId: string,
  fullName: string,
  email: string,
  phone: string,
): Promise<UpdateTeammateResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can edit teammates." };

  const trimmedName = fullName.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();
  if (!trimmedName) return { error: "Enter a full name." };
  if (!EMAIL_PATTERN.test(trimmedEmail)) return { error: "Enter a valid email address." };

  const serviceClient = createServiceRoleClient();

  const { error: emailError } = await serviceClient.auth.admin.updateUserById(userId, {
    email: trimmedEmail,
    email_confirm: true,
  });
  if (emailError) {
    console.error("updateTeammateAction: email update failed", emailError);
    const alreadyExists = emailError.message?.toLowerCase().includes("already");
    return { error: alreadyExists ? "Another teammate already uses that email address." : "Could not update this teammate. Please try again." };
  }

  const { error: profileError } = await serviceClient
    .from("profiles")
    .update({
      full_name: trimmedName,
      initials: getInitials(trimmedName) || trimmedName[0]?.toUpperCase() || "?",
      phone: trimmedPhone || null,
    })
    .eq("id", userId);

  if (profileError) {
    console.error("updateTeammateAction: profile update failed", profileError);
    return { error: "Could not update this teammate. Please try again." };
  }

  revalidatePath("/settings/users");
  return {};
}

export interface SetTeammateActiveResult {
  error?: string;
}

/**
 * Deactivates/reactivates a teammate (see
 * supabase/migrations/0021_teammate_active_status.sql) — the icon that
 * replaces a hard delete on Settings → Team Members. A deactivated
 * teammate's `profiles` row (and everything it's referenced from —
 * historical quotes, activity feed entries, uploaded documents) stays
 * intact; only their ability to sign in is cut off (enforced in
 * `signInAction`/`getCurrentUser`, not just hidden in the UI).
 */
export async function setTeammateActiveAction(userId: string, active: boolean): Promise<SetTeammateActiveResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can deactivate teammates." };
  if (userId === user.id) return { error: "You can't deactivate your own account." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ active })
    .eq("id", userId)
    .select("full_name")
    .single();

  if (error) {
    console.error("setTeammateActiveAction failed", error);
    return { error: "Could not update this teammate. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName: data?.full_name || "A teammate",
    description: `${user.firstName} ${active ? "reactivated" : "deactivated"} ${data?.full_name || "a teammate"}'s account`,
    status: active ? "allocated" : "unallocated",
    entityType: "profile_active_status",
    entityId: userId,
  });

  revalidatePath("/settings/users");
  return {};
}

export interface SetTeammateCalendarColorResult {
  error?: string;
}

/**
 * Manually pins a teammate's calendar colour (Settings → Team Members),
 * overriding the automatic name-hash colour every rep gets by default (see
 * `repColorFor` in src/lib/rep-colors.ts). `colorHex: null` clears the
 * override and reverts them to the automatic colour.
 */
export async function setTeammateCalendarColorAction(
  userId: string,
  colorHex: string | null,
): Promise<SetTeammateCalendarColorResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role !== "admin") return { error: "Only admins can set a teammate's calendar colour." };
  if (colorHex && !REP_COLOR_PALETTE_HEX.includes(colorHex)) return { error: "Not a valid colour." };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ calendar_color: colorHex }).eq("id", userId);

  if (error) {
    console.error("setTeammateCalendarColorAction failed", error);
    return { error: "Could not update this teammate's colour. Please try again." };
  }

  revalidatePath("/settings/users");
  revalidatePath("/appointments/calendar");
  return {};
}
