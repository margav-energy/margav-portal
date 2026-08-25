import { NextResponse } from "next/server";
import { getPublicSignatureRequest } from "@/data/signature-service";
import { renderUnsignedQuotePdf } from "@/lib/esignature/pdf";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * "Download PDF" on the customer's pre-signing page. Nested under `/sign`
 * (not `/api`) so `src/lib/supabase/proxy.ts`'s public-path allowlist
 * covers it without change — same unguessable-token auth as the page
 * itself, no portal login involved.
 *
 * Renders the *locked* snapshot captured at send-time (see
 * `createSignatureRequest`), never a live re-fetch — same rule the sign
 * page itself follows, so the PDF always matches what's on screen.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await getPublicSignatureRequest(token);

  if (!request || request.documentType !== "quote" || request.expired) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const snapshot = request.snapshot as DocumentSnapshot;
  const pdfBuffer = await renderUnsignedQuotePdf(snapshot);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Margav-Energy-Quote-${snapshot.reference}.pdf"`,
    },
  });
}
