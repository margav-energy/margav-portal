import { redirect } from "next/navigation";
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
    supabase.from("profiles").select("full_name, initials, role, active").eq("id", user.id).single(),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  // Covers a teammate deactivated mid-session (signInAction only blocks a
  // *new* login) — the next request after `active` flips to false signs
  // them straight back out, same as a signed-out visitor from here on.
  if (profile?.active === false) {
    await supabase.auth.signOut();
    return null;
  }

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

/**
 * For every rep/admin-oriented page (Quotes, Appointments, Activity Feed,
 * Holidays, Quick Links, ...) — installers have no business need for any
 * of it, their whole app is the availability calendar + whatever job
 * they're booked into (see src/app/availability/page.tsx). Hiding these
 * behind role-gated nav (src/lib/nav-config.ts) only stops the sidebar
 * from linking there; this stops a direct/bookmarked visit too.
 */
export async function requireStaffUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "installer") redirect("/availability");
  return user;
}

/** The installer-only counterpart of `requireStaffUser` — for pages that
 *  only make sense for the installer role (My Availability, Upcoming Jobs).
 *  Sends anyone else to the dashboard rather than looping them back here. */
export async function requireInstallerUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "installer") redirect("/");
  return user;
}
