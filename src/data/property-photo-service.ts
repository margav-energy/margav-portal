import "server-only";
import { revalidatePath } from "next/cache";
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
 * earlier fetch) — this only ever fills in an *empty* Property Photo card;
 * see `refreshStreetViewPhotoForQuote` for the address-changed case.
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

  return saveStreetViewPhoto(quoteId, address, undefined);
}

/**
 * For when the customer's address is edited (`updateQuoteCustomer`,
 * src/components/quotes/actions.ts) — swaps a Street View photo of the
 * *old* address for one of the new address. A manually-uploaded photo is
 * left alone (see supabase/migrations/0038_quote_property_photo_source.sql).
 * If Street View has nothing for the new address, the old photo is removed
 * rather than left showing the wrong house; the card falls back to its
 * "Fetch / Upload" empty state.
 */
export async function refreshStreetViewPhotoForQuote(quoteId: string, address: string): Promise<void> {
  if (!isStreetViewConfigured()) return;

  const supabase = await createClient();
  const { data: quote, error: fetchError } = await supabase
    .from("quotes")
    .select("property_photo_path, property_photo_source")
    .eq("id", quoteId)
    .maybeSingle();
  if (fetchError) {
    console.error("refreshStreetViewPhotoForQuote: could not load quote", fetchError);
    return;
  }
  const existingPath = quote?.property_photo_path ?? undefined;
  if (existingPath && quote?.property_photo_source !== "street_view") return; // a rep's own photo — keep it.

  const saved = await saveStreetViewPhoto(quoteId, address, existingPath);
  if (saved || !existingPath) return;

  const { error: clearError } = await supabase
    .from("quotes")
    .update({ property_photo_path: null, property_photo_source: null })
    .eq("id", quoteId);
  if (clearError) {
    console.error("refreshStreetViewPhotoForQuote: could not clear stale photo", clearError);
    return;
  }
  await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([existingPath]);
  revalidatePath(`/quotes/${quoteId}`);
}

/**
 * Fetches + stores a Street View photo and points the quote at it. Each
 * fetch gets its own storage path — overwriting one path in place can keep
 * serving the old image from Storage's CDN cache — and the previous object
 * (`replacingPath`) is deleted once the quote has moved off it.
 */
async function saveStreetViewPhoto(quoteId: string, address: string, replacingPath: string | undefined): Promise<boolean> {
  const photo = await fetchStreetViewPhoto(address);
  if (!photo) return false;

  await ensurePropertyPhotosBucketExists();

  const supabase = await createClient();
  const extension = photo.contentType === "image/png" ? "png" : "jpg";
  const storagePath = `${quoteId}/street-view-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(storagePath, photo.bytes, { contentType: photo.contentType, upsert: true });
  if (uploadError) {
    console.error("saveStreetViewPhoto: storage upload failed", uploadError);
    return false;
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ property_photo_path: storagePath, property_photo_source: "street_view" })
    .eq("id", quoteId);
  if (updateError) {
    console.error("saveStreetViewPhoto: quote update failed", updateError);
    return false;
  }

  if (replacingPath && replacingPath !== storagePath) {
    await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([replacingPath]);
  }

  // The auto-fetch at quote creation runs via `after()`, well past the
  // response that rendered the quote page — without this, a rep who's
  // already on the page has no way to see the photo land short of a
  // manual refresh.
  revalidatePath(`/quotes/${quoteId}`);
  return true;
}
