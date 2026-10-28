"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { deleteSolarSurveyFile } from "@/app/quotes/[id]/survey/actions";
import { ALL_SOLAR_FILE_ITEMS } from "@/lib/solar-survey-fields";
import type { SolarSurveyFile } from "@/types/solar-survey";

/**
 * Every uploaded file for a solar survey, grouped by question, with a delete
 * button on each (behind a confirm step — it's irreversible). Rendered by
 * `src/app/quotes/[id]/survey/gallery/page.tsx`.
 */
export function SolarSurveyGallery({ quoteId, files: initialFiles }: { quoteId: string; files: SolarSurveyFile[] }) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [toDelete, setToDelete] = useState<SolarSurveyFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = ALL_SOLAR_FILE_ITEMS.map((item) => ({
    item,
    files: files.filter((file) => file.itemKey === item.key),
  })).filter((group) => group.files.length > 0);

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
      {groups.length === 0 && (
        <Card className="p-5">
          <p className="text-sm text-slate-500">Nothing has been uploaded yet.</p>
        </Card>
      )}

      {groups.map(({ item, files: itemFiles }) => (
        <Card key={item.key} className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">{item.label}</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {itemFiles.map((file) => (
              <div key={file.id} className="group relative">
                {file.contentType.startsWith("video/") ? (
                  <video src={file.url} controls preload="metadata" className="aspect-video w-full rounded-md bg-black" />
                ) : file.contentType.startsWith("image/") ? (
                  <a href={file.url} target="_blank" rel="noopener noreferrer" title={file.fileName}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read. */}
                    <img src={file.url} alt={file.fileName} className="aspect-square w-full rounded-md object-cover" />
                  </a>
                ) : (
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex aspect-square w-full items-center justify-center rounded-md border border-slate-200 bg-slate-50 p-2 text-center text-xs break-all text-slate-600 hover:bg-slate-100"
                  >
                    📄 {file.fileName}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setToDelete(file);
                  }}
                  aria-label={`Delete ${file.fileName}`}
                  title="Delete"
                  className="absolute top-1.5 right-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      ))}

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
