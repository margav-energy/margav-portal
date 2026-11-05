import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/data/current-user";
import { getAllProfiles } from "@/data/profiles-service";
import { buildProfileMap, type ProfileMap } from "@/data/quotes-mappers";
import type { NoteAttachment, QuoteNote } from "@/types/quote-detail-shared";

/** Private Storage bucket for note attachments, created on first upload (see note-actions.ts). */
export const NOTE_ATTACHMENTS_BUCKET = "quote-note-attachments";

const SIGNED_URL_SECONDS = 60 * 60;

interface NoteRow {
  id: string;
  author_id: string | null;
  body: string;
  created_at: string;
  parent_id: string | null;
  edited_at: string | null;
}

interface AttachmentRow {
  id: string;
  note_id: string;
  storage_path: string;
  original_filename: string;
  content_type: string;
  size_bytes: number | string;
}

/**
 * A quote's notes and replies, newest first, each with its attachments (signed URLs) and whether the
 * signed-in user may edit or delete it. Shared by the admin/rep quote page, the installer job page and
 * every note action, so they all return the same shape.
 */
export async function getQuoteNotes(quoteId: string, profiles?: ProfileMap): Promise<QuoteNote[]> {
  const supabase = await createClient();
  const [{ data: noteRows, error }, user, profileMap] = await Promise.all([
    supabase
      .from("quote_notes")
      .select("id, author_id, body, created_at, parent_id, edited_at")
      .eq("quote_id", quoteId)
      .order("created_at", { ascending: false }),
    getCurrentUser(),
    profiles ? Promise.resolve(profiles) : getAllProfiles().then(buildProfileMap),
  ]);
  if (error) console.error("getQuoteNotes failed", error);

  const rows = (noteRows ?? []) as NoteRow[];
  if (rows.length === 0) return [];

  const { data: attachmentRows, error: attachmentError } = await supabase
    .from("quote_note_attachments")
    .select("id, note_id, storage_path, original_filename, content_type, size_bytes")
    .in(
      "note_id",
      rows.map((row) => row.id),
    )
    .order("created_at", { ascending: true });
  if (attachmentError) console.error("getQuoteNotes: attachments failed", attachmentError);

  const attachments = (attachmentRows ?? []) as AttachmentRow[];
  const urlByPath = new Map<string, string>();
  if (attachments.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from(NOTE_ATTACHMENTS_BUCKET)
      .createSignedUrls(
        attachments.map((attachment) => attachment.storage_path),
        SIGNED_URL_SECONDS,
      );
    if (signError) console.error("getQuoteNotes: signing failed", signError);
    for (const entry of signed ?? []) {
      if (entry.path && entry.signedUrl) urlByPath.set(entry.path, entry.signedUrl);
    }
  }

  return rows.map((row) => {
    const author = row.author_id ? profileMap.get(row.author_id) : undefined;
    const noteAttachments: NoteAttachment[] = attachments
      .filter((attachment) => attachment.note_id === row.id)
      .map((attachment) => ({
        id: attachment.id,
        filename: attachment.original_filename,
        contentType: attachment.content_type,
        sizeBytes: Number(attachment.size_bytes),
        url: urlByPath.get(attachment.storage_path),
      }));
    return {
      id: row.id,
      parentId: row.parent_id ?? undefined,
      editedAt: row.edited_at ?? undefined,
      authorName: author?.fullName ?? "Unknown",
      authorInitials: author?.initials ?? "?",
      timestamp: row.created_at,
      body: row.body,
      canModify: Boolean(user && (user.role === "admin" || user.id === row.author_id)),
      attachments: noteAttachments,
    };
  });
}
