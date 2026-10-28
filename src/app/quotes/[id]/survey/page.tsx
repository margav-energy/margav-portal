import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffUser } from "@/data/current-user";
import { getSolarSurveyBundle } from "@/data/solar-survey-service";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { SolarSurveyAnswers } from "@/components/quotes/solar/SolarSurveyAnswers";
import { formatDateTime } from "@/lib/format";

/** "View online" in the solar survey modal — the whole survey as a read-only page. */
export default async function SolarSurveyOnlinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const bundle = await getSolarSurveyBundle(id, user);
  if (!bundle) notFound();
  const { survey, job } = bundle;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4">
      <Link href={`/quotes/${id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to quote
      </Link>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Pre-Installation Survey</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              {job.customerName} · {job.addressLines.join(", ")} · Ref {job.reference}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {survey.answers.completedBy ? `${survey.answers.completedBy} · ` : ""}
              {survey.submittedAt ? formatDateTime(survey.submittedAt) : "Not yet submitted"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Pill
              label={survey.status === "submitted" ? "Submitted" : "Pending"}
              className={survey.status === "submitted" ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
            />
            <Link href={`/quotes/${id}/survey/gallery`} className="text-sm font-medium text-brand-blue hover:underline">
              View gallery →
            </Link>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <SolarSurveyAnswers answers={survey.answers} files={survey.files} />
      </Card>
    </div>
  );
}
