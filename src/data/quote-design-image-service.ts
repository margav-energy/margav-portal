import "server-only";
import { createHash } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { PROPERTY_PHOTOS_BUCKET } from "@/data/property-photo-service";
import type { DocumentSnapshot } from "@/lib/esignature/document";

/**
 * The solar design image (the quote's "Solar design" card — panels drawn on
 * the roof, usually pulled from Easy PV) as it appears on the quote the
 * customer is sent. Uses the service-role client, so callers MUST have
 * authorised the request first (a staff user who can open the quote, or a
 * valid signing token for `readLockedDesignImage`).
 */

/** The signed-documents bucket name (kept here, not imported from signature-service, to avoid a circular import). */
const SIGNED_DOCUMENTS_BUCKET = "signed-documents";

type DesignImage = NonNullable<DocumentSnapshot["designImage"]>;

function contentTypeFor(path: string): string {
  return path.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
}

/** The quote's current design image, if it has one. */
export async function readLiveDesignImage(quoteId: string): Promise<{ bytes: Buffer; contentType: string } | undefined> {
  const supabase = createServiceRoleClient();
  const { data: quote } = await supabase.from("quotes").select("property_photo_path").eq("id", quoteId).maybeSingle();
  if (!quote?.property_photo_path) return undefined;

  const { data, error } = await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).download(quote.property_photo_path);
  if (error || !data) {
    console.error("readLiveDesignImage failed", error);
    return undefined;
  }
  return { bytes: Buffer.from(await data.arrayBuffer()), contentType: contentTypeFor(quote.property_photo_path) };
}

/**
 * At send-time: copies the current design image into the signed-documents
 * bucket under a content-addressed path, so what the customer is shown (and
 * what ends up in the signed PDF) can't change if the quote's image is
 * replaced afterwards.
 */
export async function lockQuoteDesignImage(quoteId: string): Promise<DesignImage | undefined> {
  const live = await readLiveDesignImage(quoteId);
  if (!live) return undefined;

  const sha256 = createHash("sha256").update(live.bytes).digest("hex");
  const extension = live.contentType === "image/png" ? "png" : "jpg";
  const storagePath = `designs/${quoteId}/${sha256}.${extension}`;
  const supabase = createServiceRoleClient();
  const { error } = await supabase.storage
    .from(SIGNED_DOCUMENTS_BUCKET)
    .upload(storagePath, live.bytes, { contentType: live.contentType, upsert: true });
  if (error) {
    console.error("lockQuoteDesignImage: upload failed", error);
    return undefined;
  }
  return { storagePath, contentType: live.contentType, sha256 };
}

/** A locked copy's bytes, checked against its recorded hash. */
export async function readLockedDesignImage(image: DesignImage): Promise<{ bytes: Buffer; contentType: string } | undefined> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.storage.from(SIGNED_DOCUMENTS_BUCKET).download(image.storagePath);
  if (error || !data) {
    console.error("readLockedDesignImage failed", error);
    return undefined;
  }
  const bytes = Buffer.from(await data.arrayBuffer());
  if (createHash("sha256").update(bytes).digest("hex") !== image.sha256) {
    console.error("readLockedDesignImage: hash mismatch", image.storagePath);
    return undefined;
  }
  return { bytes, contentType: image.contentType };
}
