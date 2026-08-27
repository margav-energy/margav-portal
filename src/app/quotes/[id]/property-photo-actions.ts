"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { PROPERTY_PHOTOS_BUCKET } from "@/data/property-photo-service";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — a phone photo, not a scanned document.

export interface PropertyPhotoActionResult {
  error?: string;
}

/** Same self-provisioning pattern as `ensureQuoteDocumentsBucketExists`
 *  (src/app/quotes/[id]/documents-actions.ts) — storage buckets can't be
 *  created from a SQL migration, so this removes the one-time manual
 *  "Dashboard → Storage → New bucket" step. */
async function ensurePropertyPhotosBucketExists(): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: existing } = await admin.storage.getBucket(PROPERTY_PHOTOS_BUCKET);
  if (existing) return;

  const { error } = await admin.storage.createBucket(PROPERTY_PHOTOS_BUCKET, { public: false });
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    console.error(`ensurePropertyPhotosBucketExists: could not create bucket "${PROPERTY_PHOTOS_BUCKET}"`, error);
  }
}

function extensionFor(file: File): string {
  const fromName = file.name.split(".").pop();
  if (fromName && fromName.length <= 5) return fromName.toLowerCase();
  return file.type === "image/png" ? "png" : "jpg";
}

/**
 * Uploads (or replaces) this quote's one property photo — see
 * supabase/migrations/0023_quote_property_photo.sql. Deterministic path
 * (`${quoteId}/photo.<ext>`), upserted, so a re-upload just overwrites the
 * old one rather than accumulating files — this isn't a gallery, see
 * QuoteDocumentsCard for that. Open to reps as well as admins, same as the
 * other quote-level actions on this page.
 */
export async function uploadPropertyPhotoAction(
  quoteId: string,
  customerName: string,
  formData: FormData,
): Promise<PropertyPhotoActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can upload a property photo." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo to upload." };
  if (!file.type.startsWith("image/")) return { error: "That doesn't look like an image file." };
  if (file.size > MAX_FILE_BYTES) return { error: "That photo is too large — 10MB max." };

  await ensurePropertyPhotosBucketExists();

  const supabase = await createClient();
  const storagePath = `${quoteId}/photo.${extensionFor(file)}`;

  const { error: uploadError } = await supabase.storage
    .from(PROPERTY_PHOTOS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("uploadPropertyPhotoAction: storage upload failed", uploadError);
    return { error: "Could not upload the photo. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ property_photo_path: storagePath })
    .eq("id", quoteId);

  if (updateError) {
    console.error("uploadPropertyPhotoAction: quote update failed", updateError);
    return { error: "Could not save the photo. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName,
    description: `${user.firstName} uploaded a property photo for ${customerName}'s quote`,
    status: "allocated",
    entityType: "quote_property_photo",
    entityId: quoteId,
  });

  revalidatePath(`/quotes/${quoteId}`);
  return {};
}

export async function removePropertyPhotoAction(quoteId: string): Promise<PropertyPhotoActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can remove the property photo." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("quotes")
    .select("property_photo_path")
    .eq("id", quoteId)
    .maybeSingle();

  if (fetchError || !existing?.property_photo_path) return { error: "No photo to remove." };

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ property_photo_path: null })
    .eq("id", quoteId);

  if (updateError) {
    console.error("removePropertyPhotoAction: quote update failed", updateError);
    return { error: "Could not remove the photo. Please try again." };
  }

  // Best-effort — the quote row already stopped pointing at it either way.
  await supabase.storage.from(PROPERTY_PHOTOS_BUCKET).remove([existing.property_photo_path]);

  revalidatePath(`/quotes/${quoteId}`);
  return {};
}
