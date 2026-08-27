import "server-only";
import { createClient } from "@/lib/supabase/server";

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
