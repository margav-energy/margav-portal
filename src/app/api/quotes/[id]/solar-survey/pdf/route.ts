import { NextResponse } from "next/server";
import { requireStaffUser } from "@/data/current-user";
import { getSolarSurveyBundle, loadSolarSurveyFileBytes } from "@/data/solar-survey-service";
import { renderSolarSurveyPdf } from "@/lib/solar-survey/pdf";
import { formatDateTime } from "@/lib/format";

/**
 * "Download PDF" in the solar survey modal — rendered on demand from the
 * survey's current answers and uploads. Staff-only; a rep asking for a quote
 * that isn't theirs gets the same 404 as one that doesn't exist (see
 * `getSolarSurveyBundle`).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const bundle = await getSolarSurveyBundle(id, user);
  if (!bundle) return NextResponse.json({ error: "Survey not found" }, { status: 404 });

  const files = await loadSolarSurveyFileBytes(bundle.survey.id);
  const pdf = await renderSolarSurveyPdf({
    job: bundle.job,
    answers: bundle.survey.answers,
    files,
    submittedAtLabel: bundle.survey.submittedAt ? `Submitted ${formatDateTime(bundle.survey.submittedAt)}` : "Not yet submitted",
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Pre-Installation-Survey-${bundle.job.reference}.pdf"`,
    },
  });
}
