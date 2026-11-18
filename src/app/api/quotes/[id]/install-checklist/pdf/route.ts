import { NextResponse } from "next/server";
import { getCurrentUser } from "@/data/current-user";
import { getInstallerJobDetail } from "@/data/installer-jobs-service";
import { getQuoteDetail } from "@/data/quotes-service";
import { getSolarInstallChecklist, loadChecklistPhotoBytes } from "@/data/solar-install-checklist-service";
import { renderInstallChecklistPdf } from "@/lib/install-checklist/pdf";
import { CORE_CHECKLIST_STAGES } from "@/lib/solar-install-checklist";

const unsafe = /[\/:*?"<>|]/g;

/**
 * "Download PDF" on the install photo checklist - rendered on demand from the
 * checklist's current photos. Same access as the ZIP route beside it: the
 * office (admin, or the rep who owns the quote) and the installer/electrician
 * assigned to the job; anyone else gets the same 404 as a nonexistent quote.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const { id } = await params;

  let customerName: string;
  let reference: string | null | undefined;
  let address: string;
  if (user.role === "installer" || user.role === "electrician") {
    const job = await getInstallerJobDetail(user.id, id);
    if (!job || job.productType === "boiler") return NextResponse.json({ error: "Not found" }, { status: 404 });
    customerName = job.customerName;
    reference = job.reference;
    address = job.address || job.postcode;
  } else {
    const result = await getQuoteDetail(id);
    if (!result || result.quote.productType !== "solar" || (user.role === "rep" && result.detail.assignedRepId !== user.id)) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    customerName = result.detail.customer.name;
    reference = result.detail.reference;
    address = [result.detail.customer.addressLines?.[0], result.quote.postcode].filter(Boolean).join(", ");
  }

  const [checklist, photos] = await Promise.all([getSolarInstallChecklist(id), loadChecklistPhotoBytes(id)]);
  if (!checklist.id) return NextResponse.json({ error: "The checklist hasn't been started yet" }, { status: 404 });

  const sent = CORE_CHECKLIST_STAGES.filter((stage) => checklist.submittedStages[stage.stage]).length;
  const statusLabel = checklist.status === "submitted" ? "All stages submitted" : `${sent} of ${CORE_CHECKLIST_STAGES.length} stages submitted`;
  const pdf = await renderInstallChecklistPdf({
    customerName,
    reference: reference ?? id,
    address,
    naItems: checklist.naItems,
    photos,
    statusLabel,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Install-Photo-Checklist-${(reference ?? id).replace(unsafe, "-")}.pdf"`,
    },
  });
}
