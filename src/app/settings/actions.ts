"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getInitials } from "@/lib/utils";

export interface ProfileFormState {
  error?: string;
  success?: boolean;
}

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) return { error: "Enter your full name." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName,
      initials: getInitials(fullName) || fullName[0]?.toUpperCase() || "?",
    })
    .eq("id", user.id);

  if (error) {
    console.error("updateProfileAction failed", error);
    return { error: "Could not update your profile. Please try again." };
  }

  // The header (initials/first name) is fetched at the root layout — refresh
  // the whole layout so it picks up the new name without a hard reload.
  revalidatePath("/", "layout");
  return { success: true };
}

export interface PasswordFormState {
  error?: string;
  success?: boolean;
}

export async function updatePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }
  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    console.error("updatePasswordAction failed", error);
    return { error: error.message || "Could not update your password." };
  }

  return { success: true };
}
