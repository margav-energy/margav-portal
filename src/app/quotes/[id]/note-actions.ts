"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service";
import { getCurrentUser } from "@/data/current-user";
import { logActivity } from "@/lib/activity";
import { getQuoteNotes, NOTE_ATTACHMENTS_BUCKET } from "@/data/quote-notes-service";
import type { QuoteNote } from "@/types/quote-detail-shared";

// Server Actions are capped at 25MB per request (next.config.ts), so that is the budget for a note's files together.
const MAX_TOTAL_BYTES = 24 * 1024 * 1024;

export interface NoteActionResult {
  /** The quote's full, refreshed notes list. */
  notes?: QuoteNote[];
  error?: string;
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

function isAllowedAttachment(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("video/") || file.type === "application/pdf";
}

/** Buckets can't be created from a SQL migration, so the first upload creates it (same as quote documents). */
async function ensureBucketExists(): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: existing } = await admin.storage.getBucket(NOTE_ATTACHMENTS_BUCKET);
  if (existing) return;
  const { error } = await admin.storage.createBucket(NOTE_ATTACHMENTS_BUCKET, { public: false });
  if (error && !error.message?.toLowerCase().includes("already exists")) {
    console.error(`note-actions: could not create bucket "${NOTE_ATTACHMENTS_BUCKET}"`, error);
  }
}

function filesFrom(formData: FormData): File[] {
  return formData.getAll("files").filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function checkFiles(files: File[]): string | undefined {
  if (files.some((file) => !isAllowedAttachment(file))) return "Only PDFs, images and videos can be attached.";
  if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL_BYTES) return "Those files are too large — 24MB in total per note.";
  return undefined;
}

/** Uploads each file and records it against the note; on any failure undoes what it did and returns an error. */
async function attachFiles(supabase: Supabase, quoteId: string, noteId: string, files: File[]): Promise<string | undefined> {
  if (files.length === 0) return undefined;
  await ensureBucketExists();

  const uploaded: string[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^\w.\- ]+/g, "_");
    const storagePath = `${quoteId}/${noteId}/${randomUUID()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from(NOTE_ATTACHMENTS_BUCKET)
      .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
    if (uploadError) {
      console.error("note-actions: upload failed", uploadError);
      await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove(uploaded);
      return "Could not upload an attachment. Please try again.";
    }
    uploaded.push(storagePath);
  }

  const { error: insertError } = await supabase.from("quote_note_attachments").insert(
    files.map((file, index) => ({
      note_id: noteId,
      storage_path: uploaded[index],
      original_filename: file.name,
      content_type: file.type || "application/octet-stream",
      size_bytes: file.size,
    })),
  );
  if (insertError) {
    console.error("note-actions: attachment insert failed", insertError);
    await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove(uploaded);
    return "Could not save the attachments. Please try again.";
  }
  return undefined;
}

function revalidate(quoteId: string) {
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath(`/jobs/${quoteId}`);
}

async function recordHistory(supabase: Supabase, quoteId: string, actorId: string, customerName: string, description: string) {
  await Promise.all([
    supabase.from("quote_history").insert({ quote_id: quoteId, actor_id: actorId, description }),
    logActivity({
      actorId,
      customerName,
      description: `${description} — ${customerName}`,
      status: "allocated",
      entityType: "quote",
      entityId: quoteId,
    }),
  ]);
}

/** Loads a note and checks the signed-in user may change it (its author, or an admin). */
async function loadModifiableNote(supabase: Supabase, quoteId: string, noteId: string, user: { id: string; role: string }) {
  const { data: note } = await supabase
    .from("quote_notes")
    .select("id, author_id, quote_id")
    .eq("id", noteId)
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (!note) return { error: "That note no longer exists." } as const;
  if (user.role !== "admin" && note.author_id !== user.id) return { error: "You can only change your own notes." } as const;
  return { note } as const;
}

/** A new note, or — with `parentId` — a reply to one. `formData`: `body`, optional `parentId`, any number of `files`. */
export async function addNoteAction(quoteId: string, customerName: string, formData: FormData): Promise<NoteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };

  const body = String(formData.get("body") ?? "").trim();
  const requestedParentId = String(formData.get("parentId") ?? "") || null;
  const files = filesFrom(formData);
  if (!body && files.length === 0) return { error: "Write something or attach a file." };
  const fileError = checkFiles(files);
  if (fileError) return { error: fileError };

  const supabase = await createClient();

  // One level of replies: answering a reply answers the note it hangs from.
  let parentId: string | null = null;
  if (requestedParentId) {
    const { data: parent } = await supabase
      .from("quote_notes")
      .select("id, parent_id")
      .eq("id", requestedParentId)
      .eq("quote_id", quoteId)
      .maybeSingle();
    if (!parent) return { error: "The note you're replying to no longer exists." };
    parentId = (parent.parent_id as string | null) ?? (parent.id as string);
  }

  const { data, error } = await supabase
    .from("quote_notes")
    .insert({ quote_id: quoteId, author_id: user.id, body, parent_id: parentId })
    .select("id")
    .single();
  if (error || !data) {
    console.error("addNoteAction failed", error);
    return { error: "Could not save the note. Please try again." };
  }

  const attachError = await attachFiles(supabase, quoteId, data.id as string, files);
  if (attachError) {
    await supabase.from("quote_notes").delete().eq("id", data.id);
    return { error: attachError };
  }

  await recordHistory(supabase, quoteId, user.id, customerName, parentId ? "Replied to a note" : "Left a note");
  revalidate(quoteId);
  return { notes: await getQuoteNotes(quoteId) };
}

/** `formData`: `body`, `remove` (attachment ids to drop, repeatable), any number of new `files`. */
export async function editNoteAction(quoteId: string, noteId: string, customerName: string, formData: FormData): Promise<NoteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };

  const supabase = await createClient();
  const loaded = await loadModifiableNote(supabase, quoteId, noteId, user);
  if ("error" in loaded) return { error: loaded.error };

  const body = String(formData.get("body") ?? "").trim();
  const removeIds = formData.getAll("remove").map(String);
  const files = filesFrom(formData);
  const fileError = checkFiles(files);
  if (fileError) return { error: fileError };

  const { data: existing } = await supabase
    .from("quote_note_attachments")
    .select("id, storage_path")
    .eq("note_id", noteId);
  const toRemove = (existing ?? []).filter((attachment) => removeIds.includes(attachment.id as string));
  const remaining = (existing ?? []).length - toRemove.length + files.length;
  if (!body && remaining === 0) return { error: "A note needs some text or an attachment — delete it instead." };

  const attachError = await attachFiles(supabase, quoteId, noteId, files);
  if (attachError) return { error: attachError };

  if (toRemove.length > 0) {
    await supabase
      .from("quote_note_attachments")
      .delete()
      .in(
        "id",
        toRemove.map((attachment) => attachment.id),
      );
    await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove(toRemove.map((attachment) => attachment.storage_path as string));
  }

  const { error } = await supabase.from("quote_notes").update({ body, edited_at: new Date().toISOString() }).eq("id", noteId);
  if (error) {
    console.error("editNoteAction failed", error);
    return { error: "Could not save your changes. Please try again." };
  }

  await recordHistory(supabase, quoteId, user.id, customerName, "Edited a note");
  revalidate(quoteId);
  return { notes: await getQuoteNotes(quoteId) };
}

/** Deletes a note, its replies and all their attachments. */
export async function deleteNoteAction(quoteId: string, noteId: string, customerName: string): Promise<NoteActionResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in to do that." };

  const supabase = await createClient();
  const loaded = await loadModifiableNote(supabase, quoteId, noteId, user);
  if ("error" in loaded) return { error: loaded.error };

  // Replies go with the note (database cascade), so collect their files first.
  const { data: replies } = await supabase.from("quote_notes").select("id").eq("parent_id", noteId);
  const noteIds = [noteId, ...(replies ?? []).map((reply) => reply.id as string)];
  const { data: attachments } = await supabase.from("quote_note_attachments").select("storage_path").in("note_id", noteIds);

  const { error } = await supabase.from("quote_notes").delete().eq("id", noteId);
  if (error) {
    console.error("deleteNoteAction failed", error);
    return { error: "Could not delete the note. Please try again." };
  }
  if ((attachments ?? []).length > 0) {
    await supabase.storage.from(NOTE_ATTACHMENTS_BUCKET).remove((attachments ?? []).map((attachment) => attachment.storage_path as string));
  }

  await recordHistory(supabase, quoteId, user.id, customerName, "Deleted a note");
  revalidate(quoteId);
  return { notes: await getQuoteNotes(quoteId) };
}
