import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { updateSession } from "@/lib/supabase/proxy";

// Next.js 16 renamed `middleware.ts` to `proxy.ts` (same NextRequest/NextResponse
// API, only the file/export name changed) — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
export async function proxy(request: NextRequest) {
  // Before .env.local has real Supabase values, let every request through —
  // src/app/layout.tsx shows a setup notice instead of an auth gate no
  // client can actually satisfy yet.
  if (!isSupabaseConfigured()) return NextResponse.next();

  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and image optimization requests; run on everything else
    // (including the favicon route) so auth is enforced everywhere.
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
