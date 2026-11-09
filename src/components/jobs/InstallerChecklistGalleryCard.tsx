"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ClipboardCheck, ExternalLink, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { formatDateTime } from "@/lib/format";
import { CHECKLIST_STAGES, countCompleted, getChecklistItem } from "@/lib/solar-install-checklist";
import type { SolarInstallChecklist } from "@/data/solar-install-checklist-service";

/** Thumbnails shown per stage before "+ N more". */
const MAX_THUMBNAILS_PER_STAGE = 4;

/**
 * Sidebar card on /jobs/[id]: a gallery of everything uploaded to the
 * install photo checklist so far, and the button that opens the checklist
 * itself (/jobs/[id]/checklist) in a new tab. Because the checklist lives in
 * another tab, this card re-reads the job whenever the installer comes back
 * to this tab, so new photos show up without a manual refresh.
 */
export function InstallerChecklistGalleryCard({
  quoteId,
  checklist,
}: {
  quoteId: string;
  checklist: SolarInstallChecklist;
}) {
  const router = useRouter();

  useEffect(() => {
    function refreshWhenVisible() {
      if (document.visibilityState === "visible") router.refresh();
    }
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);
    return () => {
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [router]);

  const { done, total } = countCompleted(
    checklist.photos.map((photo) => photo.itemKey),
    checklist.naItems,
  );
  const submitted = checklist.status === "submitted";
  const hasPhotos = checklist.photos.length > 0;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
          <ClipboardCheck className="h-4 w-4 text-slate-400" />
          Install photos
        </h3>
        <Pill
          label={submitted ? "Submitted" : `${done}/${total} done`}
          className={submitted ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
        />
      </div>

      {!hasPhotos ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-200 px-3 py-6 text-center">
          <ImageIcon className="h-5 w-5 text-slate-300" />
          <p className="text-sm text-slate-500">No photos yet</p>
        </div>
      ) : (
        CHECKLIST_STAGES.map((stage) => {
          const stagePhotos = checklist.photos.filter((photo) => getChecklistItem(photo.itemKey)?.stage === stage.stage);
          if (stagePhotos.length === 0) return null;
          const shown = stagePhotos.slice(-MAX_THUMBNAILS_PER_STAGE).reverse();
          const hidden = stagePhotos.length - shown.length;
          return (
            <section key={stage.stage} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-700">{stage.title}</h4>
                <span className="text-xs text-slate-400">
                  {stagePhotos.length} photo{stagePhotos.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {shown.map((photo) => (
                  <a
                    key={photo.id}
                    href={photo.url}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open ${photo.fileName || "photo"}`}
                    className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50 hover:opacity-90"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a next/image candidate. */}
                    <img src={photo.url} alt={photo.fileName || "Checklist photo"} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
              {hidden > 0 && (
                <p className="text-xs text-slate-500">
                  + {hidden} more in {stage.title.toLowerCase()}
                </p>
              )}
            </section>
          );
        })
      )}

      {submitted && checklist.submittedAt && (
        <p className="text-xs text-slate-500">Sent to the office {formatDateTime(checklist.submittedAt)}</p>
      )}

      <Button
        variant="primary"
        href={`/jobs/${quoteId}/checklist`}
        target="_blank"
        className="w-full justify-center gap-1.5"
      >
        Open checklist
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </Card>
  );
}
