import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireInstallerUser } from "@/data/current-user";
import { getInstallerJobDetail } from "@/data/installer-jobs-service";
import { getBoilerSurveyForQuote, getSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { PRODUCT_TYPE_LABELS } from "@/lib/status-colors";
import { Card } from "@/components/ui/Card";
import { BoilerSurveyCard } from "@/components/quotes/boiler/BoilerSurveyCard";
import { JobResponseCard } from "@/components/jobs/JobResponseCard";
import { InstallerEquipmentCard } from "@/components/jobs/InstallerEquipmentCard";

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[id]">) {
  const user = await requireInstallerUser();
  const { id } = await params;

  const job = await getInstallerJobDetail(user.id, id);
  if (!job) notFound();

  const isBoiler = job.productType === "boiler";
  const [survey, surveyDocumentUrl] = isBoiler
    ? await Promise.all([getBoilerSurveyForQuote(id), getSurveyDocumentUrl(id)])
    : [undefined, undefined];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link
        href="/jobs"
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Upcoming Jobs
      </Link>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{job.customerName}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" />
          {job.address || job.postcode}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Main column — what's happening and what's being installed. */}
        <div className="flex flex-col gap-4 md:col-span-2">
          <JobResponseCard
            quoteId={job.quoteId}
            installDate={job.installDate}
            acceptanceStatus={job.acceptanceStatus}
            productLabel={PRODUCT_TYPE_LABELS[job.productType]}
            reference={job.reference}
          />
          <InstallerEquipmentCard job={job} />
        </div>

        {/* Sidebar — the survey, same card the quote detail page uses. */}
        <div className="flex flex-col gap-4">
          {isBoiler ? (
            <BoilerSurveyCard survey={survey} documentUrl={surveyDocumentUrl} />
          ) : (
            <Card className="p-5 text-sm text-slate-500">Solar installs have no on-site survey step.</Card>
          )}
        </div>
      </div>
    </div>
  );
}
