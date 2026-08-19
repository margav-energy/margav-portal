import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "@/lib/supabase/env";

/**
 * Privileged Supabase client that bypasses Row Level Security entirely.
 * First (and, as of writing, only) use is the public `/survey/[token]`
 * flow (see `src/app/survey/[token]/actions.ts`) — a surveyor opens that
 * link with no portal login, so there's no authenticated session for the
 * normal `createClient()` in `server.ts` to use, and `boiler_surveys` /
 * `boiler_survey_photos` deliberately have no anon RLS policy (see
 * `supabase/migrations/0007_boiler_surveys.sql` for why).
 *
 * Only reach for this when a route has no user session to work with.
 * Every call site MUST filter by the caller-supplied `access_token` (or
 * another value that isn't guessable/enumerable) itself — this client
 * enforces nothing.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
