import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

// Routes reachable while signed out. Everything else redirects to /login.
// `/survey` is the on-site pre-installation survey form — surveyors open it
// via a QR code / link with no portal account, authenticated instead by the
// unguessable token in the URL (see supabase/migrations/0007_boiler_surveys.sql).
// `/sign` is the self-hosted e-signature flow (see
// supabase/migrations/0010_self_signed_documents.sql /
// src/data/signature-service.ts) — same token-authenticated shape as
// `/survey`, replacing the old Dropbox Sign webhook (removed).
// `/api/agreement-templates` serves the static (no customer data) Boiler
// Installation Agreement / Cooling-Off Waiver template PDFs that
// `/sign/[token]` links to.
const PUBLIC_PATHS = ["/login", "/survey", "/sign", "/api/agreement-templates"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Called from the root `src/proxy.ts` on every request (Next.js 16 renamed
 * `middleware.ts` to `proxy.ts` — see node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
 * Refreshes the Supabase session cookie and gates access to the app.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // Do not remove — re-fetches the session and keeps the cookie fresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
