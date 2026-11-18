"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/ImageLightbox";

export interface InstallChecklistGalleryPhoto {
  id: string;
  url: string;
  fileName: string;
  label: string;
  stage: string;
}

/** The install checklist's photo grid - a click opens the photo in a viewer you can step through with the arrows (see `ImageLightbox`). Rendered by `src/app/quotes/[id]/checklist/gallery/page.tsx`. */
export function InstallChecklistGallery({ photos }: { photos: InstallChecklistGalleryPhoto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {photos.map((photo, index) => (
          <div key={photo.id} className="overflow-hidden rounded-sm bg-white shadow-[0_2px_10px_rgba(15,23,42,0.08)]">
            <button
              type="button"
              onClick={() => setOpenIndex(index)}
              title={photo.fileName}
              className="block aspect-[9/10] w-full cursor-zoom-in overflow-hidden bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, refreshed on every server read. */}
              <img src={photo.url} alt={photo.fileName || photo.label} className="h-full w-full object-cover" />
            </button>
            <div className="px-3 py-4 text-center">
              <p className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{photo.stage}</p>
              <p className="mt-1 text-base font-semibold text-slate-800">{photo.label}</p>
              <p className="mt-1 truncate text-sm text-slate-500" title={photo.fileName}>
                {photo.fileName}
              </p>
            </div>
          </div>
        ))}
      </div>

      {openIndex !== null && (
        <ImageLightbox
          images={photos.map((photo) => ({
            id: photo.id,
            url: photo.url,
            title: `${photo.stage} · ${photo.label}`,
            subtitle: photo.fileName,
          }))}
          index={openIndex}
          onIndexChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </>
  );
}
