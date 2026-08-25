import { NextResponse } from "next/server";
import { requireStaffUser } from "@/data/current-user";
import { getQuoteDetail } from "@/data/quotes-service";
import { buildDocumentSnapshot } from "@/lib/esignature/document";
import { renderUnsignedQuotePdf } from "@/lib/esignature/pdf";

/**
 * "Download PDF" on the internal "View Quote" page — a live render of the
 * quote's *current* data (same live-vs-locked distinction as
 * src/app/quotes/[id]/view/page.tsx itself). `requireStaffUser` both gates
 * this to admin/rep (installers can't reach /quotes/[id] either) and
 * redirects signed-out requests to /login.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireStaffUser();

  const { id } = await params;
  const result = await getQuoteDetail(id);
  if (!result) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const snapshot = await buildDocumentSnapshot(result.quote, result.detail);
  const pdfBuffer = await renderUnsignedQuotePdf(snapshot);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Margav-Energy-Quote-${snapshot.reference}.pdf"`,
    },
  });
}
