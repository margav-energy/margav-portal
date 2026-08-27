"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import {
  removePropertyPhotoAction,
  uploadPropertyPhotoAction,
} from "@/app/quotes/[id]/property-photo-actions";

/**
 * The site/property photo shown alongside Customer details — replaces the
 * old static `PropertyImagePlaceholder`. There's no automated fetch of
 * this from the address (no Street View/maps integration anywhere in this
 * app); it's a plain manual upload, one photo per quote, replaced in place
 * on re-upload (see supabase/migrations/0023_quote_property_photo.sql).
 */
export function PropertyPhotoCard({
  quoteId,
  customerName,
  photoUrl,
}: {
  quoteId: string;
  customerName: string;
  photoUrl: string | undefined;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function handleFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    setError(null);
    startTransition(async () => {
      const result = await uploadPropertyPhotoAction(quoteId, customerName, formData);
      if (result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    });
  }

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removePropertyPhotoAction(quoteId);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  if (photoUrl) {
    return (
      <Card className="group relative min-h-[220px] overflow-hidden p-0">
        {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed Storage URL, not a static/local asset next/image can optimize. */}
        <img src={photoUrl} alt={`${customerName}'s property`} className="h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-slate-900/60 px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
            className="flex items-center gap-1 text-xs font-medium text-white hover:underline disabled:opacity-50"
          >
            <UploadCloud className="h-3.5 w-3.5" />
            Replace
          </button>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isPending}
            className="flex items-center gap-1 text-xs font-medium text-white hover:underline disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Remove
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChosen} className="hidden" />
        {error && (
          <p className="absolute inset-x-0 top-0 bg-red-600 px-3 py-1.5 text-xs font-medium text-white">{error}</p>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex min-h-[220px] flex-col items-center justify-center gap-2 bg-slate-50 p-5 text-slate-300">
      <ImageIcon className="h-8 w-8" />
      <p className="text-xs font-medium text-slate-400">No site photo available</p>
      <label className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
        <UploadCloud className="h-3.5 w-3.5" />
        {isPending ? "Uploading…" : "Upload photo"}
        <input type="file" accept="image/*" onChange={handleFileChosen} disabled={isPending} className="hidden" />
      </label>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
  );
}
