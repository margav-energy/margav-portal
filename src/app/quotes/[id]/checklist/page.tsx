import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { assertQuoteOwnedByUser, requireStaffUser } from "@/data/current-user";
import { getQuoteDetail } from "@/data/quotes-service";
import { getSolarInstallChecklist } from "@/data/solar-install-checklist-service";
import { SolarInstallChecklistCard } from "@/components/quotes/solar/SolarInstallChecklistCard";

/** "View online" in the install checklist modal - the whole checklist as a read-only page. */
export default async function InstallChecklistOnlinePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const result = await getQuoteDetail(id);
  if (!result || result.quote.productType !== "solar") notFound();
  assertQuoteOwnedByUser(user, result.detail.assignedRepId);

  const checklist = await getSolarInstallChecklist(id);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <Link href={`/quotes/${id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" />
          Back to quote
        </Link>
        <Link href={`/quotes/${id}/checklist/gallery`} className="text-sm font-medium text-brand-blue hover:underline">
          View gallery →
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-800">Install photo checklist</h1>
        <p className="mt-1 text-sm text-slate-500">{result.detail.customer.name}</p>
      </div>

      <SolarInstallChecklistCard quoteId={id} checklist={checklist} hasInstaller defaultOpen />
    </div>
  );
}
