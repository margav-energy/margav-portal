import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";

/**
 * Shared teammate/rep directory — used anywhere the app needs to show or
 * pick a real signed-up user (quote "assigned rep" dropdown, appointment
 * rep assignment, holiday requester, notes/history author names, ...).
 * Backed by the `profiles` table (1:1 with `auth.users`, see
 * supabase/schema.sql).
 */

export interface RepProfile {
  id: string;
  fullName: string;
  initials: string;
  role: "admin" | "rep" | "installer";
  /** Self-service, same as full_name — shown in "Get In Touch" on the
   *  quote document. Absent until the person sets one in Settings. */
  phone?: string;
}

export async function getAllProfiles(): Promise<RepProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, initials, role, phone")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getAllProfiles failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name || "Unnamed",
    initials: row.initials || "?",
    role: (row.role as "admin" | "rep" | "installer") ?? "rep",
    phone: row.phone || undefined,
  }));
}

export interface TeammateProfile extends RepProfile {
  /** Lives on `auth.users`, not `profiles` — only fetched here (via the
   *  service-role admin API) because Settings → Team Members is the one
   *  place the app needs to show/edit it. */
  email: string;
  active: boolean;
}

/**
 * Admin-only: the full team roster for Settings → Team Members, including
 * each teammate's login email and active/deactivated status (see
 * supabase/migrations/0021_teammate_active_status.sql). Everywhere else in
 * the app that just needs a name/role/avatar keeps using `getAllProfiles`.
 */
export async function getTeammatesForAdmin(): Promise<TeammateProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, initials, role, phone, active")
    .order("full_name", { ascending: true });

  if (error) {
    console.error("getTeammatesForAdmin failed", error);
    return [];
  }

  const emailById = new Map<string, string>();
  const serviceClient = createServiceRoleClient();
  // listUsers is paginated (200/page here) — a real team roster won't come
  // close, but page through defensively rather than silently dropping
  // anyone past the first page.
  for (let page = 1; ; page += 1) {
    const { data: usersPage, error: usersError } = await serviceClient.auth.admin.listUsers({ page, perPage: 200 });
    if (usersError) {
      console.error("getTeammatesForAdmin: listUsers failed", usersError);
      break;
    }
    usersPage.users.forEach((authUser) => emailById.set(authUser.id, authUser.email ?? ""));
    if (usersPage.users.length < 200) break;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name || "Unnamed",
    initials: row.initials || "?",
    role: (row.role as "admin" | "rep" | "installer") ?? "rep",
    phone: row.phone || undefined,
    email: emailById.get(row.id) ?? "",
    active: row.active ?? true,
  }));
}

export async function getProfileById(id: string | null | undefined): Promise<RepProfile | null> {
  if (!id) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, initials, role, phone")
    .eq("id", id)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    fullName: data.full_name || "Unnamed",
    initials: data.initials || "?",
    role: (data.role as "admin" | "rep" | "installer") ?? "rep",
    phone: data.phone || undefined,
  };
}
