"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SignInState {
  error?: string;
}

export async function signInAction(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "Incorrect email or password." };
  }

  // Deactivated teammates (see supabase/migrations/0021_teammate_active_status.sql
  // and setTeammateActiveAction, src/app/settings/users/actions.ts) can still
  // authenticate — the credentials are still valid — but shouldn't get a
  // session. Sign them straight back out rather than letting them in and
  // relying on every page to notice.
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", data.user.id).single();
  if (profile?.active === false) {
    await supabase.auth.signOut();
    return { error: "This account has been deactivated. Contact an admin." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
