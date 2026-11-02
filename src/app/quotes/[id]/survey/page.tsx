import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffUser } from "@/data/current-user";
import { getSolarSurveyBundle } from "@/data/solar-survey-service";
import { SolarSurveyOnlineView } from "@/components/quotes/solar/SolarSurveyOnlineView";
import { formatDateTime } from "@/lib/format";

/** "View online" in the solar survey modal — the whole survey as a read-only page. */
export default async function SolarSurveyOnlinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const bundle = await getSolarSurveyBundle(id, user);
  if (!bundle) notFound();
  const { survey, job } = bundle;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/quotes/${id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to quote
        </Link>
        <Link href={`/quotes/${id}/survey/gallery`} className="text-sm font-medium text-brand-blue hover:underline">
          View gallery →
        </Link>
      </div>

      <SolarSurveyOnlineView
        job={job}
        answers={survey.answers}
        files={survey.files}
        submittedAtLabel={
          survey.submittedAt
            ? `${survey.answers.completedBy ? `${survey.answers.completedBy} · ` : ""}Submitted ${formatDateTime(survey.submittedAt)}`
            : "Not yet submitted"
        }
      />
    </div>
  );
}
