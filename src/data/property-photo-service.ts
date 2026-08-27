import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { fetchStreetViewPhoto, isStreetViewConfigured } from "@/lib/google-street-view";

/**
 * A quote's site/property photo — shown next to Customer details on the
 * quote detail page (see PropertyPhotoCard.tsx). One photo per quote,
 * replaced in place on re-upload (see supabase/migrations/0023_quote_property_photo.sql
 * and `uploadPropertyPhotoAction`, src/app/quotes/[id]/property-photo-actions.ts)
 * — not a gallery. For "many arbitrary files per quote" instead, see
 * quote-documents-service.ts.
 */

export const PROPERTY_PHOTOS_BUCKET = "property-photos";

/** For the quote detail page's Property Photo card — a short-lived URL to
 *  preview the currently-saved photo, if any. */
export async function getPropertyPhotoUrl(quoteId: string): Promise<string | undefined> {
  const supabase = await createClient();
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("property_photo_path")
    .eq("id", quoteId)
    .maybeSingle();

  if (error) {
    console.error("getPropertyPhotoUrl failed", error);
    return undefined;
  }
  if (!quote?.property_photo_path) return undefined;

  const { data: signed, error: signError } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .createSignedUrl(quote.property_photo_path, 60 * 60);

  if (signError || !signed) {
    console.error("getPropertyPhotoUrl: createSignedUrl failed", signError);
    return undefined;
  }
  return signed.signedUrl;
}

/** Same self-provisioning pattern as `ensureQuoteDocumentsBucketExists`
 *  (src/app/quotes/[id]/documents-actions.ts) — storage buckets can't be
 *  created from a SQL migration, so this removes the one-time manual
 *  "Dashboard → Storage → New bucket" step. Shared by the manual-upload
 *  action and `fetchStreetViewPhotoForQuote` below, since either can be
 *  the first thing to ever write to this bucket. */
export async function ensurePropertyPhotosBucketExists(): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: existing } = await admin.storage.getBucket(PROPERTY_PHOTOS_BUCKET);
  if (existing) return;

  const { error } = await admin.storage.createBucket(PROPERTY_PHOTOS_BUCKET, { public: false });
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    console.error(`ensurePropertyPhotosBucketExists: could not create bucket "${PROPERTY_PHOTOS_BUCKET}"`, error);
  }
}

/**
 * Best-effort auto-fetch of a Street View photo for this quote's address —
 * called right after a quote is created (see `createQuote`/
 * `createQuoteForAppointment` in `src/components/quotes/actions.ts`) and
 * from the Property Photo card's "Fetch from Street View" button for a
 * retry. `address` is whatever full address string is on hand at the call
 * site (e.g. `"123 Elm Street, SW1A 1AA"`) — Street View geocodes it the
 * same way a human would type it into Google Maps, no separate postcode
 * field needed. Never overwrites an existing photo (manual upload or an
 * earlier fetch) — this only ever fills in an *empty* Property Photo card.
 * Returns whether a photo was actually saved, purely so the manual-retry
 * button can show "no Street View imagery for this address" instead of a
 * false "done".
 */
export async function fetchStreetViewPhotoForQuote(quoteId: string, address: string): Promise<boolean> {
  if (!isStreetViewConfigured()) return false;

  const supabase = await createClient();
  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("property_photo_path")
    .eq("id", quoteId)
    .maybeSingle();
  if (fetchError) {
    console.error("fetchStreetViewPhotoForQuote: could not load quote", fetchError);
    return false;
  }
  if (quote?.property_photo_path) return false; // already has a photo — never clobber it.

  const photo = await fetchStreetViewPhoto(address);
  if (!photo) return false;

  await ensurePropertyPhotosBucketExists();

  const extension = photo.contentType === "image/png" ? "png" : "jpg";
  const storagePath = `${quoteId}/photo.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(storagePath, photo.bytes, { contentType: photo.contentType, upsert: true });
  if (uploadError) {
    console.error("fetchStreetViewPhotoForQuote: storage upload failed", uploadError);
    return false;
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ property_photo_path: storagePath })
    .eq("id", quoteId);
  if (updateError) {
    console.error("fetchStreetViewPhotoForQuote: quote update failed", updateError);
    return false;
  }

  return true;
}
