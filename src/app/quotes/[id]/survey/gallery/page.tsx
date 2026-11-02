import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireStaffUser } from "@/data/current-user";
import { getSolarSurveyBundle } from "@/data/solar-survey-service";
import { SolarSurveyGallery } from "@/components/quotes/solar/SolarSurveyGallery";

/** "View gallery" in the solar survey modal — every uploaded photo, video and document, grouped by question, each deletable. */
export default async function SolarSurveyGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const bundle = await getSolarSurveyBundle(id, user);
  if (!bundle) notFound();
  const { survey, job } = bundle;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link href={`/quotes/${id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to quote
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Pre-Installation Survey</h1>
          <p className="mt-1 text-sm text-slate-500">
            {[job.customerName, job.address.postcode].filter(Boolean).join(" · ")}
          </p>
        </div>
        {survey.files.length > 0 && (
          <a
            href={`/api/quotes/${id}/solar-survey/files`}
            className="shrink-0 rounded-lg bg-brand-green-gradient px-5 py-3 text-sm font-semibold text-black hover:brightness-95"
          >
            Download all files
          </a>
        )}
      </div>

      <SolarSurveyGallery quoteId={id} files={survey.files} />
    </div>
  );
}
