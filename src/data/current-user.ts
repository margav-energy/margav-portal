import { createClient } from "@/lib/supabase/server";

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string;
  initials: string;
  role: "admin" | "rep" | "installer";
  teamMemberCount: number;
}

/**
 * Reads the signed-in user's session + profile row. Returns `null` when
 * signed out — the only route that can render with a null user is
 * `/login` itself; every other route is redirected there by `src/proxy.ts`
 * before it ever renders.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [{ data: profile }, { count }] = await Promise.all([
    supabase.from("profiles").select("full_name, initials, role").eq("id", user.id).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  const fullName = profile?.full_name || user.email?.split("@")[0] || "there";
  const firstName = fullName.split(" ")[0];

  return {
    id: user.id,
    email: user.email ?? "",
    firstName,
    initials: profile?.initials || firstName[0]?.toUpperCase() || "?",
    role: (profile?.role as "admin" | "rep" | "installer") ?? "rep",
    teamMemberCount: count ?? 1,
  };
}
