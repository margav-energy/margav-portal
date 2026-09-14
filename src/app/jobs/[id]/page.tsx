import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireInstallerUser } from "@/data/current-user";
import { getInstallerJobDetail } from "@/data/installer-jobs-service";
import { getBoilerSurveyForQuote, getSurveyDocumentUrl } from "@/data/boiler-survey-service";
import { getPropertyPhotoUrl } from "@/data/property-photo-service";
import { PRODUCT_TYPE_LABELS } from "@/lib/status-colors";
import { Card } from "@/components/ui/Card";
import { BoilerSurveyCard } from "@/components/quotes/boiler/BoilerSurveyCard";
import { JobResponseCard } from "@/components/jobs/JobResponseCard";
import { InstallerEquipmentCard } from "@/components/jobs/InstallerEquipmentCard";
import { InstallerCustomerCard } from "@/components/jobs/InstallerCustomerCard";
import { InstallerPropertyCard } from "@/components/jobs/InstallerPropertyCard";
import { InstallerPropertyPhotoCard } from "@/components/jobs/InstallerPropertyPhotoCard";
import { InstallerNotesPanel } from "@/components/jobs/InstallerNotesPanel";

export default async function JobDetailPage({
  params,
}: PageProps<"/jobs/[id]">) {
  const user = await requireInstallerUser();
  const { id } = await params;

  const job = await getInstallerJobDetail(user.id, id);
  if (!job) notFound();

  const isBoiler = job.productType === "boiler";
  const [survey, surveyDocumentUrl, propertyPhotoUrl] = await Promise.all([
    isBoiler ? getBoilerSurveyForQuote(id) : Promise.resolve(undefined),
    isBoiler ? getSurveyDocumentUrl(id) : Promise.resolve(undefined),
    getPropertyPhotoUrl(id),
  ]);

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
        {/* Main column — same shape as the admin/rep quote detail page
            (property photo + customer, property details, equipment,
            notes), minus anything priced. */}
        <div className="flex flex-col gap-4 md:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <InstallerPropertyPhotoCard customerName={job.customerName} photoUrl={propertyPhotoUrl} />
            <InstallerCustomerCard customer={job.customer} />
          </div>
          <InstallerPropertyCard property={job.property} />
          <InstallerEquipmentCard job={job} />
          <InstallerNotesPanel quoteId={job.quoteId} customerName={job.customerName} notes={job.notes} />
        </div>

        {/* Sidebar — respond to the job, then the survey. */}
        <div className="flex flex-col gap-4">
          <JobResponseCard
            quoteId={job.quoteId}
            installDate={job.installDate}
            acceptanceStatus={job.acceptanceStatus}
            productLabel={PRODUCT_TYPE_LABELS[job.productType]}
            reference={job.reference}
          />
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
