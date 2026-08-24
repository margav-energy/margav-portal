"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";

export type UserRole = "admin" | "rep" | "installer";

export interface UpdateUserRoleResult {
  error?: string;
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
