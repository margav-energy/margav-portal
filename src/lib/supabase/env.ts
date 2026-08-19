/**
 * Central place that reads the Supabase env vars and fails loudly (in dev)
 * if they're missing, instead of every call site getting a cryptic
 * "supabaseUrl is required" error from the client library.
 *
 * Before the user has created a Supabase project and filled in
 * `.env.local`, `isSupabaseConfigured()` lets `src/proxy.ts` and
 * `src/app/layout.tsx` short-circuit to a friendly setup notice instead of
 * every request crashing on a missing env var.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase project's ` +
        `URL/keys (Project Settings → API in the Supabase dashboard).`,
    );
  }
  return value;
}

export function getSupabaseUrl(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_URL");
}

export function getSupabaseAnonKey(): string {
  return requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export function getSupabaseServiceRoleKey(): string {
  return requireEnv("SUPABASE_SERVICE_ROLE_KEY");
}
