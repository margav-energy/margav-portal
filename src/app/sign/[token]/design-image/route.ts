import { NextResponse } from "next/server";
import { getPublicSignatureRequest } from "@/data/signature-service";
import { readLockedDesignImage } from "@/data/quote-design-image-service";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * The solar design image locked into a quote's snapshot at send-time (see
 * `lockQuoteDesignImage`), for the customer's `/sign/[token]` page. Nested
 * under `/sign` so `src/lib/supabase/proxy.ts`'s public-path allowlist covers
 * it, with the same unguessable-token auth as the page itself.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await getPublicSignatureRequest(token);
  if (!request || request.documentType !== "quote" || request.expired) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const image = (request.snapshot as DocumentSnapshot).designImage;
  if (!image) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const locked = await readLockedDesignImage(image);
  if (!locked) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return new NextResponse(new Uint8Array(locked.bytes), {
    headers: { "Content-Type": locked.contentType, "Cache-Control": "private, max-age=3600" },
  });
}
