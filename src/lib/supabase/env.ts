/**
 * Central place that reads the Supabase env vars and fails loudly (in dev)
 * if they're missing, instead of every call site getting a cryptic
 * "supabaseUrl is required" error from the client library.
 *
 * Before the user has created a Supabase project and filled in
 * `.env.local`, `isSupabaseConfigured()` lets `src/proxy.ts` and
 * `src/app/layout.tsx` short-circuit to a friendly setup notice instead of
 * every request crashing on a missing env var.
 *
 * Every `NEXT_PUBLIC_*` read below is a *static* `process.env.NEXT_PUBLIC_X`
 * member access, deliberately not routed through a shared `readEnv(name)`
 * helper that does `process.env[name]` — Next.js can only inline a
 * `NEXT_PUBLIC_*` var into the client bundle when it can find the literal
 * `process.env.NEXT_PUBLIC_X` expression at build time; a dynamic/computed
 * lookup like `process.env[name]` can't be statically analyzed, so it
 * silently resolves to `undefined` in the browser even when the var is
 * genuinely set — this used to be exactly that bug (getSupabaseUrl/
 * getSupabaseAnonKey funnelled through one dynamic `requireEnv(name)`),
 * which is why client components calling `createClient()` (src/lib/supabase/
 * client.ts) threw "Missing NEXT_PUBLIC_SUPABASE_URL" unconditionally,
 * regardless of whether .env actually had it. `SUPABASE_SERVICE_ROLE_KEY`
 * has no such constraint — it's server-only (never bundled for the
 * browser), so a dynamic lookup there is harmless.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

function missingEnvError(name: string): Error {
  return new Error(
    `Missing ${name}. Copy .env.local.example to .env.local and fill in your Supabase project's ` +
      `URL/keys (Project Settings → API in the Supabase dashboard).`,
  );
}

export function getSupabaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value) throw missingEnvError("NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

export function getSupabaseAnonKey(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) throw missingEnvError("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return value;
}

export function getSupabaseServiceRoleKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) throw missingEnvError("SUPABASE_SERVICE_ROLE_KEY");
  return value;
}
