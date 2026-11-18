import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { assertQuoteOwnedByUser, requireStaffUser } from "@/data/current-user";
import { getQuoteDetail } from "@/data/quotes-service";
import { getSolarInstallChecklist } from "@/data/solar-install-checklist-service";
import { InstallChecklistGallery } from "@/components/quotes/solar/InstallChecklistGallery";
import { CHECKLIST_ITEMS, CHECKLIST_STAGES } from "@/lib/solar-install-checklist";

/** "View gallery" in the install checklist modal - every photo, grouped by stage and item, each opening full size. */
export default async function InstallChecklistGalleryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser();
  const { id } = await params;

  const result = await getQuoteDetail(id);
  if (!result || result.quote.productType !== "solar") notFound();
  assertQuoteOwnedByUser(user, result.detail.assignedRepId);

  const checklist = await getSolarInstallChecklist(id);
  // Flat list in checklist order, so each card carries its own item label and stage.
  const ordered = CHECKLIST_ITEMS.flatMap((item) =>
    checklist.photos
      .filter((photo) => photo.itemKey === item.key)
      .map((photo) => ({ photo, label: item.label, stage: CHECKLIST_STAGES.find((s) => s.stage === item.stage)?.title ?? "" })),
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <Link href={`/quotes/${id}`} className="flex w-fit items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" />
        Back to quote
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Install photo checklist</h1>
          <p className="mt-1 text-sm text-slate-500">{result.detail.customer.name}</p>
        </div>
        {ordered.length > 0 && (
          <a
            href={`/api/quotes/${id}/install-checklist/files`}
            className="shrink-0 rounded-lg bg-brand-green-gradient px-5 py-3 text-sm font-semibold text-black hover:brightness-95"
          >
            Download all photos
          </a>
        )}
      </div>

      {ordered.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">No photos have been uploaded yet.</p>
        </Card>
      )}

      <InstallChecklistGallery
        photos={ordered.map(({ photo, label, stage }) => ({ id: photo.id, url: photo.url, fileName: photo.fileName, label, stage }))}
      />
    </div>
  );
}
