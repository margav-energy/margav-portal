import { NextResponse } from "next/server";
import { canViewCustomerPhone, requireStaffUser } from "@/data/current-user";
import { getQuoteDetail } from "@/data/quotes-service";
import { buildDocumentSnapshot } from "@/lib/esignature/document";
import { frontPageCount, renderUnsignedQuotePdf } from "@/lib/esignature/pdf";
import { buildBoilerQuotePdf } from "@/lib/esignature/boiler-quote-pdf";
import { readLiveDesignImage } from "@/data/quote-design-image-service";
import { getProposalSkipPages, readLiveProposal } from "@/data/easypv-proposal-service";
import { composeProposalPdf } from "@/lib/esignature/compose-proposal";

/**
 * "Download PDF" on the internal "View Quote" page — a live render of the
 * quote's *current* data (same live-vs-locked distinction as
 * src/app/quotes/[id]/view/page.tsx itself). `requireStaffUser` both gates
 * this to admin/rep (installers can't reach /quotes/[id] either) and
 * redirects signed-out requests to /login. A rep hitting this directly for
 * a quote that isn't theirs gets the same 404 as a nonexistent quote — see
 * `assertQuoteOwnedByUser`'s doc comment (src/data/current-user.ts); that
 * helper itself isn't used here since it calls `notFound()`, which is for
 * page/layout rendering, not Route Handlers.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();

  const { id } = await params;
  const result = await getQuoteDetail(id);
  if (!result) return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  if (user.role === "rep" && result.detail.assignedRepId !== user.id) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }
  if (!canViewCustomerPhone(user)) result.detail.customer.phone = "";

  const snapshot = await buildDocumentSnapshot(result.quote, result.detail);
  const isBoiler = snapshot.productTypeLabel === "Boiler";
  const proposal = isBoiler ? undefined : await readLiveProposal(id);
  // The cover page carries the design image.
  const designImage = isBoiler ? undefined : (await readLiveDesignImage(id))?.bytes;
  let pdfBuffer = isBoiler ? await buildBoilerQuotePdf(snapshot) : await renderUnsignedQuotePdf(snapshot, designImage);
  if (proposal) pdfBuffer = await composeProposalPdf(proposal.bytes, pdfBuffer, await getProposalSkipPages(id), frontPageCount(snapshot), 1);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Margav-Energy-Quote-${snapshot.reference}.pdf"`,
    },
  });
}
