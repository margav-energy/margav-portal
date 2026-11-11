"use client";

import { useState } from "react";
import { ChevronDown, Download, ImageIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/format";
import { CHECKLIST_ITEMS, CHECKLIST_STAGES, countCompleted, getChecklistItem } from "@/lib/solar-install-checklist";
import type { SolarInstallChecklist } from "@/data/solar-install-checklist-service";

/**
 * What the installer sent back from their "Install photo checklist" (see
 * `InstallerChecklistCard`) — for the office to check on the solar quote
 * page. Read-only: photos open full size in a new tab, N/A items are
 * labelled, and anything with neither a photo nor an N/A is flagged as
 * missing so gaps are obvious at a glance.
 */
export function SolarInstallChecklistCard({
  quoteId,
  checklist,
  hasInstaller,
}: {
  quoteId: string;
  checklist: SolarInstallChecklist;
  hasInstaller: boolean;
}) {
  const [isOpen, setIsOpen] = useState(checklist.status === "submitted");

  if (!checklist.id && !hasInstaller) return null;

  if (!checklist.id) {
    return (
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-900">Install photo checklist</h3>
        <p className="mt-2 text-sm text-slate-500">Not started — the installer fills this in once they&rsquo;ve accepted the job.</p>
      </Card>
    );
  }

  const { done, total } = countCompleted(
    checklist.photos.map((photo) => photo.itemKey),
    checklist.naItems,
  );
  const submitted = checklist.status === "submitted";

  return (
    <Card className="overflow-hidden p-0">
      <button type="button" onClick={() => setIsOpen((open) => !open)} className="flex w-full items-center justify-between px-5 py-4">
        <div className="text-left">
          <h3 className="text-sm font-semibold text-slate-900">Install photo checklist</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {submitted && checklist.submittedAt
              ? `${checklist.submittedByName ? `${checklist.submittedByName} · ` : ""}Submitted ${formatDateTime(checklist.submittedAt)}`
              : checklist.submittedAt
                ? "Installer is updating it — waiting for it to be sent again"
                : "Installer is still filling this in"}
            {` · ${done}/${total} items · ${checklist.photos.length} photo${checklist.photos.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Pill
            label={submitted ? "Submitted" : "In progress"}
            className={submitted ? "bg-brand-green-mid/10 text-brand-green-mid" : "bg-amber-100 text-amber-700"}
          />
          <ChevronDown className={cn("h-4 w-4 text-slate-400 transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-5 border-t border-slate-100 px-5 py-4">
          {checklist.photos.length > 0 && (
            <a
              href={`/api/quotes/${quoteId}/install-checklist/files`}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-brand-blue hover:bg-slate-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download all photos (ZIP)
            </a>
          )}
          {CHECKLIST_STAGES.map((stage) => (
            <section key={stage.stage} className="flex flex-col gap-1">
              <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                <h4 className="text-xs font-semibold tracking-wide text-slate-900 uppercase">{stage.title}</h4>
                {checklist.photos.some((photo) => getChecklistItem(photo.itemKey)?.stage === stage.stage) && (
                  <a
                    href={`/api/quotes/${quoteId}/install-checklist/files?stage=${stage.stage}`}
                    className="flex items-center gap-1 text-xs font-medium text-brand-blue hover:underline"
                  >
                    <Download className="h-3 w-3" />
                    Download folder
                  </a>
                )}
              </div>
              <ul className="divide-y divide-slate-100">
                {CHECKLIST_ITEMS.filter((item) => item.stage === stage.stage).map((item) => {
                  const photos = checklist.photos.filter((photo) => photo.itemKey === item.key);
                  const isNa = checklist.naItems.includes(item.key);
                  return (
                    <li key={item.key} className="flex flex-col gap-2 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn("text-sm", isNa ? "text-slate-400" : "text-slate-800")}>{item.label}</p>
                        {isNa ? (
                          <Pill label="N/A" className="shrink-0 bg-slate-100 text-slate-500" />
                        ) : photos.length === 0 ? (
                          <Pill label="Missing" className="shrink-0 bg-red-100 text-red-700" />
                        ) : (
                          <span className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                            <ImageIcon className="h-3 w-3" />
                            {photos.length}
                          </span>
                        )}
                      </div>
                      {photos.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {photos.map((photo) => (
                            <a
                              key={photo.id}
                              href={photo.url}
                              target="_blank"
                              rel="noreferrer"
                              className="h-20 w-20 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 hover:opacity-90"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a next/image candidate. */}
                              <img src={photo.url} alt={photo.fileName || item.label} className="h-full w-full object-cover" />
                            </a>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
