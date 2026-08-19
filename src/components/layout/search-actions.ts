"use server";

import { createClient } from "@/lib/supabase/server";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

/**
 * Backs the topbar `SearchBar`. Scoped to quotes for now — quotes are the
 * only entity in the portal with a stable per-record detail page
 * (`/quotes/[id]`) to land a search result on; appointments are only ever
 * viewed as filtered lists, not individual detail pages.
 */
export async function searchPortal(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("id, customer_name, postcode, address")
    .is("archived_at", null)
    .or(`customer_name.ilike.%${trimmed}%,postcode.ilike.%${trimmed}%,address.ilike.%${trimmed}%`)
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.error("searchPortal failed", error);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.customer_name,
    subtitle: [row.postcode, row.address].filter(Boolean).join(" · "),
    href: `/quotes/${row.id}`,
  }));
}
