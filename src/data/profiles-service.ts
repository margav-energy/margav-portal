import { createClient } from "@/lib/supabase/server";

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
