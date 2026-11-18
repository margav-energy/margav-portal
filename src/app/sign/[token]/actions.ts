"use server";

import { headers } from "next/headers";
import { declineSignatureBundle, submitSignatureBundle } from "@/data/signature-service";

/**
 * Mutations for the public, unauthenticated `/sign/[token]` form. Mirrors
 * `src/app/survey/[token]/actions.ts` — every call re-derives the request
 * from `token`, never trusts client state for anything that matters.
 */

async function clientMeta(): Promise<{ ip: string; userAgent: string }> {
  const headerList = await headers();
  // `x-forwarded-for` can be a comma-separated chain behind a proxy/CDN — the first entry is the original client.
  const forwardedFor = headerList.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const userAgent = headerList.get("user-agent") || "unknown";
  return { ip, userAgent };
}

export async function submitSignatureAction(
  token: string,
  typedName: string,
  signatureImageDataUrl: string,
  /** Cooling-Off Waiver only — see `SubmitSignatureParams.installDate`'s doc comment. Ignored for every other document type. */
  installDate?: string,
  /** The customer saw the installation agreement and cooling-off waiver together and is signing both - the server looks the second one up itself. */
  includeCompanion = false,
): Promise<{ ok: boolean; error?: string }> {
  if (!typedName.trim()) return { ok: false, error: "Please type your full name." };
  if (!signatureImageDataUrl) return { ok: false, error: "Please draw your signature." };

  const { ip, userAgent } = await clientMeta();
  const result = await submitSignatureBundle({
    token,
    typedName: typedName.trim(),
    signatureImageDataUrl,
    ip,
    userAgent,
    installDate,
    includeCompanion,
  });
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

export async function declineSignatureAction(
  token: string,
  reason: string,
  includeCompanion = false,
): Promise<{ ok: boolean; error?: string }> {
  const result = await declineSignatureBundle(token, reason, includeCompanion);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}
