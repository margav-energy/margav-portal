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
 * Both redirect branches below build a brand-new `NextResponse.redirect(...)`
 * — which does NOT carry whatever cookies `getUser()`'s `setAll` handler
 * wrote onto `supabaseResponse` (a refreshed session token, or a cleared
 * invalid one — see the `catch` below). Without this, a redirect always
 * drops that write, so a browser with a stale/invalid refresh-token cookie
 * that gets redirected to /login never actually sheds that cookie: it just
 * sends the same broken token again on the next request, forever. Copying
 * the cookies across is what makes the "clear it" half of that fix real.
 */
function withCookiesFrom(response: NextResponse, source: NextResponse): NextResponse {
  for (const cookie of source.cookies.getAll()) {
    response.cookies.set(cookie.name, cookie.value, cookie);
  }
  return response;
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
  //
  // A stale/invalid refresh-token cookie (an old session, a token revoked
  // server-side, one left over from a different Supabase project on this
  // domain) makes `getUser()` *throw* an `AuthApiError` instead of
  // returning `{ user: null }`. Left uncaught, that's an unhandled error on
  // every single request from that browser — this proxy runs on every
  // request — which both spammed the logs and, worse, meant that browser
  // never got a chance to shed the bad cookie: it just kept sending the
  // same broken token forever. Treat a thrown auth error the same as
  // "signed out" and clear it (`scope: "local"` — no network round trip,
  // just drops the cookie via the `setAll` handler above) so the *next*
  // request from this browser is clean instead of repeating the failure.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (error) {
    console.error("updateSession: getUser failed — treating as signed out", error);
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (signOutError) {
      console.error("updateSession: signOut after failed getUser also failed", signOutError);
    }
  }

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return withCookiesFrom(NextResponse.redirect(url), supabaseResponse);
  }

  if (user && pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return withCookiesFrom(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}
