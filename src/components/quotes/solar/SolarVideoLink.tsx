"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { Modal } from "@/components/ui/Modal";

/** Pill that plays a survey video in a modal over the blurred page instead of opening a new tab. Children render inside the trigger. */
export function SolarVideoLink({
  url,
  fileName,
  className,
  children,
}: {
  url: string;
  fileName: string;
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={`Play ${fileName}`}
        className={
          className ??
          "inline-flex h-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-brand-blue hover:bg-slate-200"
        }
      >
        {children ?? (
          <>
            <Play className="h-3.5 w-3.5" />
            {fileName}
          </>
        )}
      </button>

      {open && (
        <Modal title={fileName} onClose={() => setOpen(false)} maxWidthClassName="max-w-4xl">
          <video src={url} controls autoPlay playsInline className="max-h-[70vh] w-full bg-black" />
        </Modal>
      )}
    </>
  );
}
