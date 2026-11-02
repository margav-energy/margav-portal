"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteSolarSurveyFile } from "@/app/quotes/[id]/survey/actions";
import { ALL_SOLAR_FILE_ITEMS } from "@/lib/solar-survey-fields";
import type { SolarSurveyFile } from "@/types/solar-survey";

/**
 * Every uploaded file for a solar survey, as a flat card grid (question label + filename
 * under each), with download and delete on hover (behind a confirm step — it's irreversible). Rendered by
 * `src/app/quotes/[id]/survey/gallery/page.tsx`.
 */
export function SolarSurveyGallery({ quoteId, files: initialFiles }: { quoteId: string; files: SolarSurveyFile[] }) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [toDelete, setToDelete] = useState<SolarSurveyFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Flat list in question order (roof photos first), so each card carries its own question label.
  const ordered = ALL_SOLAR_FILE_ITEMS.flatMap((item) =>
    files.filter((file) => file.itemKey === item.key).map((file) => ({ file, label: item.label })),
  );

  async function confirmDelete() {
    if (!toDelete) return;
    setIsDeleting(true);
    setError(null);
    const result = await deleteSolarSurveyFile(quoteId, toDelete.id);
    setIsDeleting(false);
    if (!result.ok) {
      setError(result.error ?? "Could not delete the file.");
      return;
    }
    setFiles((current) => current.filter((file) => file.id !== toDelete.id));
    setToDelete(null);
    router.refresh();
  }

  return (
    <>
      {ordered.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">Nothing has been uploaded yet.</p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {ordered.map(({ file, label }) => {
          const isVideo = file.contentType.startsWith("video/");
          const isImage = file.contentType.startsWith("image/");
          return (
            <div
              key={file.id}
              className="group relative overflow-hidden rounded-sm bg-white shadow-[0_2px_10px_rgba(15,23,42,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.14)]"
            >
              <div className="relative aspect-[9/10] w-full overflow-hidden bg-slate-100">
                {isVideo ? (
                  <video src={file.url} controls preload="metadata" className="h-full w-full bg-black object-cover" />
                ) : isImage ? (
                  <a href={file.url} target="_blank" rel="noopener noreferrer" title={file.fileName}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read. */}
                    <img src={file.url} alt={file.fileName} className="h-full w-full object-cover" />
                  </a>
                ) : (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full w-full items-center justify-center p-3 text-center text-xs break-all text-slate-600 hover:bg-slate-200"
                  >
                    📄 {file.fileName}
                  </a>
                )}

                <div className="absolute top-2 right-2 flex gap-2 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  <a
                    href={file.downloadUrl ?? file.url}
                    download={file.fileName}
                    aria-label={`Download ${file.fileName}`}
                    title="Download"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-700 shadow hover:bg-slate-100"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setToDelete(file);
                    }}
                    aria-label={`Delete ${file.fileName}`}
                    title="Delete"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-white shadow hover:bg-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="px-3 py-4 text-center">
                <p className="text-base font-semibold text-slate-800">{label}</p>
                <p className="mt-1 truncate text-sm text-slate-500" title={file.fileName}>
                  {file.fileName}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {toDelete && (
        <Modal title="Delete this file?" onClose={() => !isDeleting && setToDelete(null)}>
          <div className="flex flex-col gap-3 px-5 py-5">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{toDelete.fileName}</span> will be permanently removed from this survey. This can&apos;t be undone.
            </p>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
            <Button variant="secondary" onClick={() => setToDelete(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
