"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";

export interface LightboxImage {
  id: string;
  url: string;
  /** Large line under the photo, e.g. the checklist item. */
  title: string;
  /** Smaller line, e.g. the file name. */
  subtitle?: string;
  /** Link for the download button - defaults to `url`. */
  downloadUrl?: string;
}

/**
 * Full-screen photo viewer for the galleries: step through with the on-screen
 * arrows or the left/right arrow keys, Esc (or the backdrop / X) closes. Keeps
 * you on the page instead of opening each photo in a new tab.
 */
export function ImageLightbox({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: LightboxImage[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const count = images.length;
  const image = images[index];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      else if (event.key === "ArrowRight" && index < count - 1) onIndexChange(index + 1);
    }
    window.addEventListener("keydown", onKeyDown);
    // Stop the page behind scrolling while the viewer is open.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [index, count, onIndexChange, onClose]);

  if (!image) return null;

  const navButton =
    "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-white/15";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={image.title}
      className="fixed inset-0 z-[60] flex flex-col bg-black/90"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-4 py-3 text-white" onClick={(event) => event.stopPropagation()}>
        <span className="text-sm text-white/70">
          {index + 1} / {count}
        </span>
        <div className="flex items-center gap-2">
          <a
            href={image.downloadUrl ?? image.url}
            download={image.subtitle}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Download photo"
            title="Download"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"
          >
            <Download className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close (Esc)"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed Storage URL, not a next/image candidate. */}
        <img
          key={image.id}
          src={image.url}
          alt={image.subtitle || image.title}
          className="max-h-full max-w-full object-contain"
          onClick={(event) => event.stopPropagation()}
        />
        <button
          type="button"
          aria-label="Previous photo"
          disabled={index === 0}
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index - 1);
          }}
          className={`${navButton} left-3`}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <button
          type="button"
          aria-label="Next photo"
          disabled={index === count - 1}
          onClick={(event) => {
            event.stopPropagation();
            onIndexChange(index + 1);
          }}
          className={`${navButton} right-3`}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>

      <div className="px-4 py-4 text-center text-white" onClick={(event) => event.stopPropagation()}>
        <p className="text-base font-semibold">{image.title}</p>
        {image.subtitle && <p className="mt-0.5 text-sm text-white/60">{image.subtitle}</p>}
      </div>
    </div>
  );
}
