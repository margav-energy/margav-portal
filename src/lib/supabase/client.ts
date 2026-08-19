import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

/** Supabase client for Client Components — reads/writes the browser's cookies. */
export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
}
