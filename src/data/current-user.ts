import { notFound, redirect } from "next/navigation";
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

  // Same "stale/invalid refresh token throws instead of returning null"
  // hazard as `updateSession` (src/lib/supabase/proxy.ts) — that's the
  // primary defense (it clears the bad cookie so this rarely even fires),
  // but this is called from plenty of places `src/proxy.ts` doesn't gate
  // (e.g. `/login` itself), so it needs its own net rather than crashing
  // the page.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    console.error("getCurrentUser: getUser failed — treating as signed out", error);
  }

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

/**
 * A rep only gets to open a quote's detail/view/presenter pages if it's
 * assigned to them; admins can open any quote. Call after
 * `requireStaffUser()`, once the quote's `assignedRepId` is known (from
 * `getQuoteDetail`, src/data/quotes-service.ts). 404s rather than
 * redirecting, so a rep guessing/bookmarking another rep's quote URL sees
 * "not found" instead of a bounce that would confirm the quote exists —
 * same reasoning as `getInstallerJobDetail`'s ownership check
 * (src/data/installer-jobs-service.ts) for installers and their jobs.
 */
export function assertQuoteOwnedByUser(user: CurrentUser, assignedRepId: string | undefined): void {
  if (user.role === "rep" && assignedRepId !== user.id) notFound();
}
