import "server-only";
import { headers } from "next/headers";

/** `x-forwarded-proto`/`host` off the incoming request — there's no
 *  NEXT_PUBLIC_SITE_URL configured, and this works correctly in any
 *  environment (local/staging/prod) without one. */
export async function getSiteOrigin(): Promise<string> {
  const headerList = await headers();
  const host = headerList.get("host") ?? "localhost:3000";
  const proto = headerList.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
