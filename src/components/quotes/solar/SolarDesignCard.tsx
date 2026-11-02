"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Image as ImageIcon, Trash2, UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { removePropertyPhotoAction, uploadPropertyPhotoAction } from "@/app/quotes/[id]/property-photo-actions";

/**
 * The solar counterpart of `PropertyPhotoCard`: instead of a Street View
 * photo of the address, an admin uploads the solar design drawn onto the
 * customer's roof. Stored exactly like the boiler site photo (one image per
 * quote, replaced in place — see `uploadPropertyPhotoAction`), so the
 * installer's job page shows it too. Reps and installers see it read-only;
 * the server actions enforce the admin-only rule for solar quotes.
 */
export function SolarDesignCard({
  quoteId,
  customerName,
  photoUrl,
  canEdit,
}: {
  quoteId: string;
  customerName: string;
  photoUrl: string | undefined;
  canEdit: boolean;
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
      if (result.error) setError(result.error);
      else router.refresh();
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
        <a href={photoUrl} target="_blank" rel="noopener noreferrer" title="Open full size">
          {/* eslint-disable-next-line @next/next/no-img-element -- a short-lived signed Storage URL, not a static/local asset next/image can optimize. */}
          <img src={photoUrl} alt={`Solar design for ${customerName}'s roof`} className="h-full w-full object-cover" />
        </a>
        <p className="absolute top-2 left-2 rounded-md bg-slate-900/60 px-2 py-1 text-[11px] font-medium text-white">
          Solar design
        </p>
        {canEdit && (
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
        )}
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
      <p className="text-xs font-medium text-slate-400">No solar design uploaded yet</p>
      {canEdit ? (
        <label className="mt-1 flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
          <UploadCloud className="h-3.5 w-3.5" />
          {isPending ? "Uploading…" : "Upload solar design"}
          <input type="file" accept="image/*" onChange={handleFileChosen} disabled={isPending} className="hidden" />
        </label>
      ) : (
        <p className="text-[11px] text-slate-400">An admin will add the design for this roof.</p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </Card>
  );
}
