"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";

const BUCKET = "quote-documents";
const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

export interface QuoteDocumentActionResult {
  error?: string;
}

/**
 * Storage buckets can't be created from a SQL migration (see
 * supabase/migrations/0019_quote_documents.sql) — normally that means a
 * one-time manual "Dashboard → Storage → New bucket" step before this
 * feature works at all. Self-provisioning it here on first upload removes
 * that step: the *bucket* needs the service-role client (creating buckets
 * is an admin-level Storage operation, not something RLS on `storage.objects`
 * grants to a regular authenticated user), but every object written inside
 * it afterward still goes through the normal RLS-bound client below, same
 * as any other upload.
 */
async function ensureQuoteDocumentsBucketExists(): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: existing } = await admin.storage.getBucket(BUCKET);
  if (existing) return;

  const { error } = await admin.storage.createBucket(BUCKET, { public: false });
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    console.error(`ensureQuoteDocumentsBucketExists: could not create bucket "${BUCKET}"`, error);
  }
}

/**
 * Attaches an arbitrary file to a quote — see
 * supabase/migrations/0019_quote_documents.sql. Open to reps as well as
 * admins, same as the other quote-level actions in this app (assigning a
 * rep/installer, sending a quote, ...) — installers are the only role with
 * no business reason to be on a quote page at all (see requireStaffUser).
 */
export async function uploadQuoteDocumentAction(
  quoteId: string,
  customerName: string,
  formData: FormData,
): Promise<QuoteDocumentActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can upload documents." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_FILE_BYTES) return { error: "That file is too large — 20MB max." };

  await ensureQuoteDocumentsBucketExists();

  const supabase = await createClient();
  // Randomized prefix, not just the original filename — two uploads of
  // "quote.pdf" for the same job must not collide/overwrite each other.
  const storagePath = `${quoteId}/${randomUUID()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

  if (uploadError) {
    console.error("uploadQuoteDocumentAction: storage upload failed", uploadError);
    return { error: "Could not upload the file. Please try again." };
  }

  const { error: insertError } = await supabase.from("quote_documents").insert({
    quote_id: quoteId,
    storage_path: storagePath,
    original_filename: file.name,
    uploaded_by: user.id,
  });

  if (insertError) {
    console.error("uploadQuoteDocumentAction: insert failed", insertError);
    // Don't leave an orphaned file in storage with no DB row pointing at it.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return { error: "Could not save this document. Please try again." };
  }

  await logActivity({
    actorId: user.id,
    customerName,
    description: `${user.firstName} uploaded "${file.name}" to ${customerName}'s quote`,
    status: "allocated",
    entityType: "quote_document",
    entityId: quoteId,
  });

  revalidatePath(`/quotes/${quoteId}`);
  return {};
}

export async function deleteQuoteDocumentAction(
  documentId: string,
  quoteId: string,
): Promise<QuoteDocumentActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };
  if (user.role === "installer") return { error: "Only admins and reps can remove documents." };

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("quote_documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();

  if (fetchError || !existing) return { error: "Document not found." };

  const { error: deleteError } = await supabase.from("quote_documents").delete().eq("id", documentId);
  if (deleteError) {
    console.error("deleteQuoteDocumentAction failed", deleteError);
    return { error: "Could not remove this document. Please try again." };
  }

  // Best-effort — the DB row is already gone either way, so a leftover
  // storage object (rather than a dangling DB reference) is the safer
  // failure mode here.
  await supabase.storage.from(BUCKET).remove([existing.storage_path]);

  revalidatePath(`/quotes/${quoteId}`);
  return {};
}
