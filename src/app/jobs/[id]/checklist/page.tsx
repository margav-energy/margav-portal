import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { requireInstallerUser } from "@/data/current-user";
import { getInstallerJobDetail } from "@/data/installer-jobs-service";
import { getSolarInstallChecklist } from "@/data/solar-install-checklist-service";
import { InstallerChecklistCard } from "@/components/jobs/InstallerChecklistCard";

/**
 * The install photo checklist on its own page — opened in a new tab from the
 * gallery card on /jobs/[id], so the installer can keep the job open
 * alongside it. Solar jobs only, and only once the installer has accepted
 * (the same rule the server actions enforce, see checklist-actions.ts).
 */
export default async function JobChecklistPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireInstallerUser();
  const { id } = await params;

  const job = await getInstallerJobDetail(user.id, id);
  if (!job || job.productType !== "solar") notFound();
  if (job.acceptanceStatus !== "accepted") redirect(`/jobs/${id}`);

  const checklist = await getSolarInstallChecklist(id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <Link
        href={`/jobs/${id}`}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to job
      </Link>

      <div>
        <h2 className="text-2xl font-semibold text-slate-900">{job.customerName}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" />
          {job.address || job.postcode}
        </p>
      </div>

      <InstallerChecklistCard quoteId={job.quoteId} initial={checklist} />
    </div>
  );
}
