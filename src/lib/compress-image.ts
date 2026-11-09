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
 * library on a browser that can't decode HEIC — iOS normally converts
 * library picks to JPEG for `accept="image/*"` inputs anyway) returns the
 * original, unresized file rather than blocking the upload.
 */

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.82;

function isHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/**
 * HEIC/HEIF (an iPhone photo, or a Mac screenshot saved as HEIC) can't be
 * displayed by Chrome, Edge or Firefox — a stored one would just download
 * when someone clicked it. So it's converted to JPEG here, before upload.
 * `heic2any` is loaded on demand (it's large) and only for these files.
 * Returns null if the conversion fails, leaving the caller to carry on with
 * whatever else it can do.
 */
async function convertHeicToJpeg(file: File): Promise<File | null> {
  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: JPEG_QUALITY });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!blob) return null;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return null;
  }
}

export async function compressPhoto(inputFile: File): Promise<File> {
  if (!inputFile.type.startsWith("image/") && !isHeic(inputFile)) return inputFile;

  let file = inputFile;
  if (isHeic(file)) {
    const converted = await convertHeicToJpeg(file);
    if (converted) file = converted;
  }
  const stillHeic = isHeic(file);

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale >= 1 && !stillHeic) {
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
    // Re-encoding didn't actually help — keep the original (unless it's a HEIC that other browsers can't show).
    if (!blob || (blob.size >= file.size && !stillHeic)) return file;

    const jpegName = file.name.replace(/\.\w+$/, "") + ".jpg";
    return new File([blob], jpegName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
