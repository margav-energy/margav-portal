"use client";

/**
 * Downscales/re-encodes a photo client-side before it's ever uploaded or
 * queued (see `src/app/survey/[token]/SurveyForm.tsx`) — a full-res phone
 * camera photo is routinely 3–8MB, and the survey's photo checklist asks
 * for up to 15 of them. Compressing up front means:
 *   - a much smaller upload over a weak signal (less likely to time out or
 *     hit `next.config.ts`'s 25MB server action body limit),
 *   - a much smaller footprint in the offline queue's IndexedDB store
 *     (`src/lib/survey-offline-queue.ts`) if a rep fills in the whole
 *     checklist while offline before anything syncs.
 *
 * 1920px longest edge / JPEG quality 0.82 keeps small print (a boiler's
 * data badge, a serial plate) legible while cutting a typical 12MP photo
 * down to a few hundred KB.
 *
 * Fails soft: any decode/encode error (e.g. a HEIC photo picked from the
 * library on a browser that can't decode HEIC — camera captures via this
 * form's `capture="environment"` input are JPEG already) returns the
 * original, unresized file rather than blocking the upload.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1) {
      bitmap.close();
      return file; // already small enough — resizing further would only lose quality
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file; // re-encoding didn't actually help — keep the original

    const jpegName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], jpegName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
