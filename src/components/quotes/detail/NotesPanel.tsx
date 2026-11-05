"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ActionIcon } from "@/components/ui/ActionIcon";
import { Button } from "@/components/ui/Button";
import { InitialsAvatar } from "@/components/ui/InitialsAvatar";
import { inputClassName } from "@/components/ui/FormField";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addNoteAction, deleteNoteAction, editNoteAction } from "@/app/quotes/[id]/note-actions";
import { clearDraft, useAutosaveDraft, useDraftRestore } from "@/hooks/useAutosaveDraft";
import type { NoteAttachment, QuoteNote } from "@/types/quote-detail-shared";

const ACCEPT = "image/*,video/*,application/pdf";

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function Attachments({ attachments }: { attachments: NoteAttachment[] }) {
  if (attachments.length === 0) return null;
  const media = attachments.filter((a) => a.url && (a.contentType.startsWith("image/") || a.contentType.startsWith("video/")));
  const files = attachments.filter((a) => !media.includes(a));
  return (
    <div className="mt-3 flex flex-col gap-2">
      {media.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {media.map((attachment) =>
            attachment.contentType.startsWith("video/") ? (
              <video key={attachment.id} src={attachment.url} controls preload="metadata" className="max-h-56 max-w-full rounded-lg bg-black" />
            ) : (
              <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" title={attachment.filename}>
                {/* Signed Storage URLs, so plain <img> rather than next/image. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={attachment.url} alt={attachment.filename} className="max-h-40 max-w-full rounded-lg border border-slate-200 object-cover" />
              </a>
            ),
          )}
        </div>
      )}
      {files.map((attachment) => (
        <a
          key={attachment.id}
          href={attachment.url}
          target="_blank"
          rel="noreferrer"
          className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-brand-blue hover:bg-slate-100"
        >
          <FileText className="h-4 w-4 shrink-0" />
          <span className="truncate">{attachment.filename}</span>
          <span className="shrink-0 text-slate-400">{formatSize(attachment.sizeBytes)}</span>
        </a>
      ))}
    </div>
  );
}

/**
 * Text box plus attachments, used to write a note, a reply, or edit one. For an edit, `existing` are the
 * note's current attachments, which can be removed; new files are added alongside.
 */
function NoteEditor({
  initialBody = "",
  existing = [],
  placeholder,
  submitLabel,
  rows = 4,
  onChangeBody,
  onSubmit,
  onCancel,
}: {
  initialBody?: string;
  existing?: NoteAttachment[];
  placeholder: string;
  submitLabel: string;
  rows?: number;
  /** Lets the caller autosave the draft text. */
  onChangeBody?: (body: string) => void;
  onSubmit: (input: { body: string; files: File[]; removeIds: string[] }) => Promise<string | undefined>;
  onCancel: () => void;
}) {
  const [body, setBody] = useState(initialBody);
  const [files, setFiles] = useState<File[]>([]);
  const [removeIds, setRemoveIds] = useState<string[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function submit() {
    setIsSaving(true);
    setError(undefined);
    const message = await onSubmit({ body, files, removeIds });
    setIsSaving(false);
    if (message) setError(message);
  }

  const kept = existing.filter((attachment) => !removeIds.includes(attachment.id));

  return (
    <div>
      <textarea
        autoFocus
        rows={rows}
        className={cn(inputClassName, "resize-y")}
        placeholder={placeholder}
        value={body}
        onChange={(event) => {
          setBody(event.target.value);
          onChangeBody?.(event.target.value);
        }}
      />

      {(kept.length > 0 || files.length > 0) && (
        <ul className="mt-2 flex flex-col gap-1">
          {kept.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2 text-xs text-slate-600">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{attachment.filename}</span>
              <button
                type="button"
                aria-label={`Remove ${attachment.filename}`}
                className="shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => setRemoveIds((current) => [...current, attachment.id])}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex items-center gap-2 text-xs text-slate-600">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-slate-400">{formatSize(file.size)}</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                className="shrink-0 text-slate-400 hover:text-red-600"
                onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          const picked = Array.from(event.target.files ?? []);
          if (picked.length > 0) setFiles((current) => [...current, ...picked]);
          event.target.value = "";
        }}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <Button variant="ghost" className="gap-1.5 px-2.5 py-1.5 text-xs" onClick={() => fileInput.current?.click()}>
          <Paperclip className="h-3.5 w-3.5" />
          Attach PDF, image or video
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="success" onClick={submit} disabled={isSaving}>
            {isSaving ? "Saving…" : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function NoteHeader({ note, actions }: { note: QuoteNote; actions: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <InitialsAvatar name={note.authorName} initials={note.authorInitials} className="h-9 w-9 text-xs" />
        <div>
          <p className="text-sm font-semibold text-slate-900">{note.authorName}</p>
          <p className="text-xs text-slate-400">
            {formatDateTime(note.timestamp)}
            {note.editedAt && <span title={formatDateTime(note.editedAt)}> · edited</span>}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">{actions}</div>
    </div>
  );
}

export function NotesPanel({
  quoteId,
  customerName,
  notes,
  onNotesChange,
}: {
  quoteId: string;
  customerName: string;
  notes: QuoteNote[];
  /** Called with the quote's full, refreshed notes list after any add, reply, edit or delete. */
  onNotesChange: (notes: QuoteNote[]) => void;
}) {
  const draftKey = `quote-note-draft-${quoteId}`;
  const [draft, setDraft] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | undefined>();

  // A restored draft with something in it should reopen the composer instead of hiding the recovered text.
  useDraftRestore<string>(draftKey, (restored) => {
    setDraft(restored);
    setIsComposing(true);
  });

  useAutosaveDraft(draftKey, draft, isComposing);

  function toFormData(input: { body: string; files: File[]; removeIds?: string[]; parentId?: string }): FormData {
    const formData = new FormData();
    formData.set("body", input.body);
    if (input.parentId) formData.set("parentId", input.parentId);
    for (const file of input.files) formData.append("files", file);
    for (const id of input.removeIds ?? []) formData.append("remove", id);
    return formData;
  }

  async function handleAdd(input: { body: string; files: File[] }, parentId?: string): Promise<string | undefined> {
    const result = await addNoteAction(quoteId, customerName, toFormData({ ...input, parentId }));
    if (result.error || !result.notes) return result.error ?? "Could not save the note.";
    onNotesChange(result.notes);
    if (parentId) {
      setReplyingTo(null);
    } else {
      setDraft("");
      setIsComposing(false);
      clearDraft(draftKey);
    }
    return undefined;
  }

  async function handleEdit(noteId: string, input: { body: string; files: File[]; removeIds: string[] }): Promise<string | undefined> {
    const result = await editNoteAction(quoteId, noteId, customerName, toFormData(input));
    if (result.error || !result.notes) return result.error ?? "Could not save your changes.";
    onNotesChange(result.notes);
    setEditing(null);
    return undefined;
  }

  async function handleDelete(note: QuoteNote) {
    const hasReplies = notes.some((candidate) => candidate.parentId === note.id);
    const message = hasReplies ? "Delete this note and its replies? This can't be undone." : "Delete this note? This can't be undone.";
    if (!window.confirm(message)) return;
    setDeleteError(undefined);
    const result = await deleteNoteAction(quoteId, note.id, customerName);
    if (result.error || !result.notes) {
      setDeleteError(result.error ?? "Could not delete the note.");
      return;
    }
    onNotesChange(result.notes);
  }

  const topLevel = notes.filter((note) => !note.parentId);
  const repliesFor = (id: string) =>
    notes
      .filter((note) => note.parentId === id)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  function renderNote(note: QuoteNote, isReply: boolean, rootId: string) {
    if (editing === note.id) {
      return (
        <NoteEditor
          initialBody={note.body}
          existing={note.attachments ?? []}
          placeholder="Edit your note…"
          submitLabel="Save changes"
          rows={3}
          onSubmit={(input) => handleEdit(note.id, input)}
          onCancel={() => setEditing(null)}
        />
      );
    }
    return (
      <>
        <NoteHeader
          note={note}
          actions={
            <>
              <ActionIcon action="reply" subtle onClick={() => setReplyingTo(rootId)} />
              {note.canModify && (
                <>
                  <ActionIcon action="edit" subtle onClick={() => setEditing(note.id)} />
                  <ActionIcon action="delete" subtle onClick={() => handleDelete(note)} />
                </>
              )}
            </>
          }
        />
        {note.body && <p className={cn("text-sm whitespace-pre-line text-slate-700", isReply ? "mt-2" : "mt-3")}>{note.body}</p>}
        <Attachments attachments={note.attachments ?? []} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {deleteError && <p className="text-xs text-red-600">{deleteError}</p>}

      {topLevel.map((note) => {
        const replies = repliesFor(note.id);
        return (
          <Card key={note.id} className="p-5">
            {renderNote(note, false, note.id)}

            {(replies.length > 0 || replyingTo === note.id) && (
              <div className="mt-4 flex flex-col gap-4 border-l-2 border-slate-100 pl-4">
                {replies.map((reply) => (
                  <div key={reply.id}>{renderNote(reply, true, note.id)}</div>
                ))}
                {replyingTo === note.id && (
                  <NoteEditor
                    placeholder="Write a reply…"
                    submitLabel="Reply"
                    rows={3}
                    onSubmit={(input) => handleAdd(input, note.id)}
                    onCancel={() => setReplyingTo(null)}
                  />
                )}
              </div>
            )}
          </Card>
        );
      })}

      {isComposing ? (
        <Card className="p-5">
          <NoteEditor
            initialBody={draft}
            placeholder="Add a note against this quote…"
            submitLabel="Save note"
            onChangeBody={setDraft}
            onSubmit={(input) => handleAdd(input)}
            onCancel={() => {
              setIsComposing(false);
              setDraft("");
              clearDraft(draftKey);
            }}
          />
        </Card>
      ) : (
        <Button variant="primary" className="w-fit" onClick={() => setIsComposing(true)}>
          Leave a note
        </Button>
      )}
    </div>
  );
}
